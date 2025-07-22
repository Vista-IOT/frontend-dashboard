"""
Dashboard service for system monitoring and overview.
"""
import logging
import subprocess
import time
import shutil
from typing import Dict, Any

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

logger = logging.getLogger(__name__)

class DashboardService:
    """Service for providing dashboard overview data."""

    @staticmethod
    def get_system_overview() -> Dict[str, Any]:
        """
        Get system, protocol, and network overview for the dashboard.
        Returns a dict with status and data keys.
        """
        try:
            logger.info("Processing dashboard overview request")
            
            # System info - Using native commands for better accuracy
            cpu = 0
            if PSUTIL_AVAILABLE:
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
                        if PSUTIL_AVAILABLE:
                            mem = psutil.virtual_memory()
                            total_mem = mem.total
                            used_mem = mem.used
                            free_mem = mem.available
                            mem_percent = mem.percent
                        else:
                            total_mem = used_mem = free_mem = 0
                            mem_percent = 0
                else:
                    raise Exception("Unexpected 'free' command output")
            except Exception as e:
                logger.warning(f"Error getting memory info: {str(e)}")
                if PSUTIL_AVAILABLE:
                    mem = psutil.virtual_memory()
                    total_mem = mem.total
                    used_mem = mem.used
                    free_mem = mem.available
                    mem_percent = mem.percent
                else:
                    total_mem = used_mem = free_mem = 0
                    mem_percent = 0
            
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
                try:
                    disk = shutil.disk_usage("/")
                    total_disk = disk.total
                    used_disk = disk.used
                    free_disk = disk.free
                    disk_percent = (used_disk / total_disk) * 100 if total_disk > 0 else 0
                except:
                    total_disk = used_disk = free_disk = 0
                    disk_percent = 0
            
            logger.debug(f"Memory: {mem_percent:.1f}% used ({used_mem//(1024*1024)}/{total_mem//(1024*1024)} MB)")
            logger.debug(f"Disk: {disk_percent:.1f}% used ({used_disk//(1024*1024*1024)}/{total_disk//(1024*1024*1024)} GB)")
            
            # Network interfaces
            interfaces = []
            if PSUTIL_AVAILABLE:
                net = psutil.net_if_addrs()
                net_stats = psutil.net_io_counters(pernic=True)
                
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
            uptime_seconds = 0
            if PSUTIL_AVAILABLE:
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
            error_msg = f"Error in dashboard overview: {str(e)}"
            logger.exception(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "details": str(e)
            }
