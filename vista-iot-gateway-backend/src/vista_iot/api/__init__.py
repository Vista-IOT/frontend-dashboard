"""API package for Vista IoT Gateway."""

from .router import api_router, router, GatewayDependency, get_gateway
from .hardware_router import router as hardware_router

__all__ = ['api_router', 'router', 'hardware_router', 'GatewayDependency', 'get_gateway']