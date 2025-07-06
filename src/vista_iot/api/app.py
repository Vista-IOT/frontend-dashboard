import asyncio
import logging
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ..database.db_handler import DatabaseHandler
from ..protocols.modbus_handler import ModbusHandler
from ..core.models import IOPort, TagValue
from ..utils.config_manager import ConfigManager

logger = logging.getLogger(__name__)

class IOTGatewayApp:
    def __init__(self):
        self.app = FastAPI(title="Vista IoT Gateway")
        self.config_manager = ConfigManager()
        self.modbus_handlers: Dict[str, ModbusHandler] = {}
        self.active_connections: List[WebSocket] = []
        
        # Configure CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # In production, replace with specific origins
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Register routes
        self.setup_routes()

    def setup_routes(self):
        @self.app.on_event("startup")
        async def startup_event():
            # Load configuration and start Modbus handlers
            await self.initialize_modbus_handlers()

        @self.app.on_event("shutdown")
        async def shutdown_event():
            # Cleanup Modbus handlers
            for handler in self.modbus_handlers.values():
                await handler.disconnect()

        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()
            self.active_connections.append(websocket)
            try:
                while True:
                    # Wait for any message (can be used for subscribing to specific tags)
                    data = await websocket.receive_text()
                    # For now, we'll just echo back all tag values
                    await self.broadcast_tag_values()
            except WebSocketDisconnect:
                self.active_connections.remove(websocket)

        @self.app.get("/api/config")
        async def get_config():
            """Get the complete configuration."""
            return self.config_manager.get_config()

        @self.app.get("/api/ports")
        async def get_ports():
            """Get all configured IO ports."""
            return self.config_manager.get_io_ports()

        @self.app.get("/api/tags")
        async def get_tags():
            """Get all tag values."""
            all_values = {}
            for handler in self.modbus_handlers.values():
                all_values.update(handler.get_all_tag_values())
            return all_values

        @self.app.get("/api/tags/{tag_id}")
        async def get_tag_value(tag_id: str):
            """Get value for a specific tag."""
            for handler in self.modbus_handlers.values():
                if value := handler.get_tag_value(tag_id):
                    return value
            return {"error": "Tag not found"}

    async def initialize_modbus_handlers(self):
        """Initialize Modbus handlers for each configured port."""
        try:
            ports = self.config_manager.get_io_ports()
            for port in ports:
                if port.type.lower() == "modbus-rtu" and port.enabled:
                    handler = ModbusHandler(port)
                    self.modbus_handlers[port.id] = handler
                    # Start scanning in background
                    asyncio.create_task(handler.start_scanning())
                    logger.info(f"Started Modbus handler for port {port.name}")
        except Exception as e:
            logger.error(f"Error initializing Modbus handlers: {str(e)}")

    async def broadcast_tag_values(self):
        """Broadcast all tag values to connected WebSocket clients."""
        if not self.active_connections:
            return

        # Collect all tag values
        all_values = {}
        for handler in self.modbus_handlers.values():
            all_values.update(handler.get_all_tag_values())

        # Broadcast to all connected clients
        for connection in self.active_connections:
            try:
                await connection.send_json({"type": "tag_values", "data": all_values})
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {str(e)}")
                try:
                    self.active_connections.remove(connection)
                except ValueError:
                    pass

    def get_app(self) -> FastAPI:
        """Get the FastAPI application instance."""
        return self.app 