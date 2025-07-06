"""
API router for the Vista IoT Gateway.
Provides RESTful endpoints for configuration and control.
"""
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from pydantic import BaseModel
import psutil
import shutil

from .hardware_router import router as hardware_router
from ..database.db_connector import DBConnector

logger = logging.getLogger(__name__)

# API models for request/response
class ConfigUpdateRequest(BaseModel):
    """Request model for updating configuration"""
    config: Dict[str, Any]
    save: bool = True

class TagValueRequest(BaseModel):
    """Request model for updating tag values"""
    value: Any

class TagValueResponse(BaseModel):
    """Response model for tag values"""
    id: str
    name: str
    value: Any
    timestamp: str
    quality: str

class SystemStatusResponse(BaseModel):
    """Response model for system status"""
    running: bool
    uptime: float
    system: Dict[str, Any]
    modules: Dict[str, str]
    last_update: str

# Create the main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Create sub-router for gateway endpoints
gateway_router = APIRouter(
    prefix="",
    tags=["gateway"],
    responses={404: {"description": "Not found"}},
)

# Include sub-routers
api_router.include_router(gateway_router)
api_router.include_router(hardware_router)

# Alias for backward compatibility
router = gateway_router

# Gateway instance will be injected as a dependency
class GatewayDependency:
    """Dependency for getting the gateway instance"""
    def __init__(self):
        self.gateway = None
    
    def set_gateway(self, gateway):
        """Set the gateway instance"""
        self.gateway = gateway
    
    def get_gateway(self):
        """Get the gateway instance"""
        if not self.gateway:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gateway not initialized"
            )
        return self.gateway

# Create dependency
gateway_dependency = GatewayDependency()

def get_gateway():
    """Dependency to get the gateway instance"""
    return gateway_dependency.get_gateway()

def get_db():
    db = DBConnector()
    db.connect()
    return db

# API endpoints
@gateway_router.get("/status", response_model=SystemStatusResponse)
async def get_status(gateway=Depends(get_gateway)):
    """Get the current status of the gateway"""
    return gateway.get_status()

@gateway_router.post("/launch")
async def launch_backend(background_tasks: BackgroundTasks, request: Request):
    """Launch the backend with the specified configuration"""
    data = await request.json()
    config_path = data.get("configPath")
    
    # In a real implementation, this would launch a new backend process
    # For now, we'll just return success and let the client refresh
    logger.info(f"Request to launch backend with config: {config_path}")
    
    # Since we're already running (this endpoint is part of the backend),
    # we'll just simulate a restart in the background
    background_tasks.add_task(gateway_dependency.get_gateway().restart)
    
    return {"status": "success", "message": "Backend launch initiated"}

@gateway_router.get("/config")
async def get_config(gateway=Depends(get_gateway)):
    """Get the current configuration"""
    return gateway.get_config()

@gateway_router.put("/config")
async def update_config(
    request: ConfigUpdateRequest,
    background_tasks: BackgroundTasks,
    gateway=Depends(get_gateway)
):
    """Update the configuration"""
    success = gateway.update_config(request.config, request.save)
    
    if success:
        # Schedule a restart if required
        if request.config.get("restart", False):
            background_tasks.add_task(gateway.restart)
        
        return {"status": "success", "message": "Configuration updated"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update configuration"
        )

@gateway_router.post("/restart")
async def restart_gateway(background_tasks: BackgroundTasks, gateway=Depends(get_gateway)):
    """Restart the gateway"""
    # Schedule restart in background to allow API to respond
    background_tasks.add_task(gateway.restart)
    return {"status": "success", "message": "Gateway restart scheduled"}

@gateway_router.get("/tags")
async def get_all_tags(gateway=Depends(get_gateway)):
    """Get all tags and their current values"""
    # Assuming the gateway has an IO module with a get_all_tags method
    if "io" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IO module not available"
        )
    
    io_module = gateway.modules["io"]
    return io_module.get_all_tags()

@gateway_router.get("/tags/{tag_id}", response_model=TagValueResponse)
async def get_tag(tag_id: str, gateway=Depends(get_gateway)):
    """Get a specific tag value"""
    # Assuming the gateway has an IO module with a get_tag method
    if "io" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IO module not available"
        )
    
    io_module = gateway.modules["io"]
    tag = io_module.get_tag(tag_id)
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tag {tag_id} not found"
        )
    
    return tag

@gateway_router.put("/tags/{tag_id}")
async def update_tag(tag_id: str, request: TagValueRequest, gateway=Depends(get_gateway)):
    """Update a tag value"""
    # Assuming the gateway has an IO module with an update_tag method
    if "io" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IO module not available"
        )
    
    io_module = gateway.modules["io"]
    success = io_module.update_tag_value(tag_id, request.value)
    
    if success:
        return {"status": "success", "message": f"Tag {tag_id} updated"}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to update tag {tag_id}"
        )

# Protocol-specific endpoints
@gateway_router.get("/protocols")
async def get_protocols(gateway=Depends(get_gateway)):
    """Get information about active protocols"""
    protocols = {}
    
    # Collect information from each protocol module
    for module_name, module in gateway.modules.items():
        if module_name in ["modbus", "mqtt"]:
            protocols[module_name] = module.get_status()
    
    return protocols

@gateway_router.get("/protocols/modbus/registers")
async def get_modbus_registers(gateway=Depends(get_gateway)):
    """Get Modbus register values"""
    if "modbus" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modbus module not available"
        )
    
    modbus_module = gateway.modules["modbus"]
    return {
        "coils": modbus_module.registers["coils"],
        "discrete_inputs": modbus_module.registers["discrete_inputs"],
        "holding": modbus_module.registers["holding"],
        "input": modbus_module.registers["input"]
    }

@gateway_router.put("/protocols/modbus/registers/{register_type}/{address}")
async def update_modbus_register(
    register_type: str,
    address: int,
    request: TagValueRequest,
    gateway=Depends(get_gateway)
):
    """Update a Modbus register value"""
    if "modbus" not in gateway.modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modbus module not available"
        )
    
    modbus_module = gateway.modules["modbus"]
    
    # Validate register type
    if register_type not in ["coil", "holding"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot write to register type: {register_type}"
        )
    
    success = modbus_module.write_register(register_type, address, request.value)
    
    if success:
        return {"status": "success", "message": f"Register {register_type}:{address} updated"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update register {register_type}:{address}"
        )

# --- System Tag CRUD Endpoints ---
@api_router.get("/system-tags")
def list_system_tags(db: DBConnector = Depends(get_db)):
    return db.get_system_tags()

@api_router.get("/system-tags/{tag_id}")
def get_system_tag(tag_id: str, db: DBConnector = Depends(get_db)):
    tags = db.get_system_tags()
    for tag in tags:
        if tag["id"] == tag_id:
            return tag
    raise HTTPException(status_code=404, detail="System tag not found")

@api_router.post("/system-tags")
def create_system_tag(tag: dict, db: DBConnector = Depends(get_db)):
    try:
        db.cursor.execute(
            """
            INSERT INTO SystemTag (id, name, dataType, unit, spanHigh, spanLow, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tag.get("id"),
                tag.get("name"),
                tag.get("dataType"),
                tag.get("unit"),
                tag.get("spanHigh"),
                tag.get("spanLow"),
                tag.get("description"),
            )
        )
        db.conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/system-tags/{tag_id}")
def update_system_tag(tag_id: str, tag: dict, db: DBConnector = Depends(get_db)):
    try:
        db.cursor.execute(
            """
            UPDATE SystemTag SET name=?, dataType=?, unit=?, spanHigh=?, spanLow=?, description=? WHERE id=?
            """,
            (
                tag.get("name"),
                tag.get("dataType"),
                tag.get("unit"),
                tag.get("spanHigh"),
                tag.get("spanLow"),
                tag.get("description"),
                tag_id,
            )
        )
        db.conn.commit()
        if db.cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="System tag not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/system-tags/{tag_id}")
def delete_system_tag(tag_id: str, db: DBConnector = Depends(get_db)):
    try:
        db.cursor.execute(
            "DELETE FROM SystemTag WHERE id=?",
            (tag_id,)
        )
        db.conn.commit()
        if db.cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="System tag not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Dashboard Overview Endpoint ---
@api_router.get("/dashboard/overview", response_model=Dict[str, Any], tags=["dashboard"])
async def dashboard_overview():
    """
    Get system, protocol, and network overview for the dashboard.
    Returns a dict with status and data keys, matching /hardware/detect style.
    """
    try:
        logger.info("Processing dashboard overview request")
        
        # System info - Using native commands for better accuracy
        import subprocess
        
        # Get CPU usage
        cpu = psutil.cpu_percent()
        logger.debug(f"CPU usage: {cpu}%")
        
        # Get memory info using 'free' command
        try:
            mem_output = subprocess.check_output(['free', '-b']).decode('utf-8')
            mem_lines = mem_output.split('\n')
            if len(mem_lines) > 1:
                mem_info = mem_lines[1].split()
                if len(mem_info) >= 7:  # Modern 'free' output
                    total_mem = int(mem_info[1])
                    used_mem = int(mem_info[2])
                    free_mem = int(mem_info[3])
                    mem_percent = (used_mem / total_mem) * 100 if total_mem > 0 else 0
                else:  # Fallback to psutil if output format is unexpected
                    mem = psutil.virtual_memory()
                    total_mem = mem.total
                    used_mem = mem.used
                    free_mem = mem.available
                    mem_percent = mem.percent
            else:
                raise Exception("Unexpected 'free' command output")
        except Exception as e:
            logger.warning(f"Error getting memory info: {str(e)}")
            mem = psutil.virtual_memory()
            total_mem = mem.total
            used_mem = mem.used
            free_mem = mem.available
            mem_percent = mem.percent
        
        # Get disk info using 'df' command
        try:
            df_output = subprocess.check_output(['df', '-B1', '--output=size,used,avail,pcent', '/']).decode('utf-8')
            df_lines = df_output.strip().split('\n')
            if len(df_lines) > 1:
                # Get the second line which contains the actual values
                size, used, avail, pct = df_lines[1].split()
                total_disk = int(size)
                used_disk = int(used)
                free_disk = int(avail)
                disk_percent = float(pct.rstrip('%'))
            else:
                raise Exception("Unexpected 'df' command output")
        except Exception as e:
            logger.warning(f"Error getting disk info: {str(e)}")
            disk = shutil.disk_usage("/")
            total_disk = disk.total
            used_disk = disk.used
            free_disk = disk.free
            disk_percent = (used_disk / total_disk) * 100 if total_disk > 0 else 0
        
        logger.debug(f"Memory: {mem_percent:.1f}% used ({used_mem//(1024*1024)}/{total_mem//(1024*1024)} MB)")
        logger.debug(f"Disk: {disk_percent:.1f}% used ({used_disk//(1024*1024*1024)}/{total_disk//(1024*1024*1024)} GB)")
        
        # Network interfaces
        net = psutil.net_if_addrs()
        net_stats = psutil.net_io_counters(pernic=True)
        interfaces = []
        
        for name, addrs in net.items():
            try:
                ip = next((a.address for a in addrs if getattr(a, 'family', None) == 2), None)  # AF_INET == 2
                stats = net_stats.get(name)
                interfaces.append({
                    "name": name,
                    "ip": ip or "N/A",
                    "status": "connected" if stats and (stats.bytes_sent > 0 or stats.bytes_recv > 0) else "disconnected",
                    "tx": f"{(stats.bytes_sent/1024/1024):.2f} MB" if stats else "0 MB",
                    "rx": f"{(stats.bytes_recv/1024/1024):.2f} MB" if stats else "0 MB",
                })
                logger.debug(f"Network interface {name} - IP: {ip}")
            except Exception as e:
                logger.warning(f"Error processing network interface {name}: {str(e)}")
                continue
        
        # Protocols: stubbed for now
        protocols = {
            "network": "connected",
            "vpn": "connected",
            "modbus": "partial",
            "opcua": "connected",
            "dnp3": "disconnected",
            "watchdog": "active"
        }
        
        # Uptime calculation
        import time
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        
        # Calculate days, hours, minutes, seconds
        days = uptime_seconds // (24 * 3600)
        hours = (uptime_seconds % (24 * 3600)) // 3600
        minutes = (uptime_seconds % 3600) // 60
        seconds = uptime_seconds % 60
        
        # Format the uptime string
        if days > 0:
            uptime = f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            uptime = f"{hours}h {minutes}m {seconds}s"
        else:
            uptime = f"{minutes}m {seconds}s"
        
        response = {
            "status": "success",
            "data": {
                "system_uptime": uptime,
                "cpu_load": cpu,
                "memory": {
                    "used": int(used_mem // (1024*1024)),
                    "free": int(free_mem // (1024*1024)),
                    "total": int(total_mem // (1024*1024)),
                    "percent": float(mem_percent),
                    "unit": "MB"
                },
                "storage": {
                    "used": int(used_disk // (1024*1024*1024)),
                    "free": int(free_disk // (1024*1024*1024)),
                    "total": int(total_disk // (1024*1024*1024)),
                    "percent": float(disk_percent),
                    "unit": "GB"
                },
                "protocols": protocols,
                "network_interfaces": interfaces,
            }
        }
        
        logger.debug(f"Dashboard response prepared: {response}")
        return response
        
    except Exception as e:
        error_msg = f"Error in dashboard_overview: {str(e)}"
        logger.exception(error_msg)
        return {
            "status": "error",
            "error": error_msg,
            "details": str(e)
        }

@gateway_router.get("/vmm")
async def get_vmm(gateway=Depends(get_gateway)):
    """Get the entire in-memory Virtual Memory Map."""
    return list(gateway.virtual_memory_map.values())

@gateway_router.get("/vmm/{address}")
async def get_vmm_value(address: str, gateway=Depends(get_gateway)):
    """Get a specific VMM value by address."""
    entry = gateway.virtual_memory_map.get(address)
    if not entry:
        raise HTTPException(status_code=404, detail=f"VMM address {address} not found")
    return entry

@gateway_router.put("/vmm/{address}")
async def update_vmm_value(address: str, request: TagValueRequest, gateway=Depends(get_gateway)):
    """Update a VMM value in memory."""
    entry = gateway.virtual_memory_map.get(address)
    if not entry:
        raise HTTPException(status_code=404, detail=f"VMM address {address} not found")
    gateway.update_vmm_value(address, request.value, entry.get("dataType", "float"), entry.get("unitId", 1))
    return {"status": "success", "message": f"VMM address {address} updated"}
