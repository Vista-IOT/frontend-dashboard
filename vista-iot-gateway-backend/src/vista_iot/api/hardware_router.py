"""
Hardware router for the Vista IoT Gateway.
Provides endpoints for hardware detection and monitoring.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
import logging

from ..hardware.detection import HardwareDetector

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/hardware",
    tags=["hardware"],
    responses={404: {"description": "Not found"}},
)

@router.get("/detect", response_model=Dict[str, Any])
async def detect_hardware():
    """
    Detect all hardware resources on the system.
    
    Returns a comprehensive list of all detected hardware including:
    - Serial ports (RS232, RS485, USB-to-serial, etc.)
    - Network interfaces
    - GPIO capabilities
    - USB devices
    - System information
    """
    try:
        hardware_info = HardwareDetector.detect_all_hardware()
        return {
            "status": "success",
            "data": hardware_info
        }
    except Exception as e:
        logger.error(f"Error detecting hardware: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting hardware: {str(e)}"
        )

@router.get("/serial-ports", response_model=Dict[str, Any])
async def get_serial_ports():
    """Get a list of all available serial ports."""
    try:
        return {
            "status": "success",
            "data": {
                "serial_ports": HardwareDetector.detect_serial_ports()
            }
        }
    except Exception as e:
        logger.error(f"Error detecting serial ports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting serial ports: {str(e)}"
        )

@router.get("/network-interfaces", response_model=Dict[str, Any])
async def get_network_interfaces():
    """Get a list of all network interfaces."""
    try:
        return {
            "status": "success",
            "data": {
                "network_interfaces": HardwareDetector.detect_network_interfaces()
            }
        }
    except Exception as e:
        logger.error(f"Error detecting network interfaces: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting network interfaces: {str(e)}"
        )

@router.get("/gpio", response_model=Dict[str, Any])
async def get_gpio_info():
    """Get information about available GPIO."""
    try:
        return {
            "status": "success",
            "data": {
                "gpio": HardwareDetector.detect_gpio()
            }
        }
    except Exception as e:
        logger.error(f"Error detecting GPIO: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting GPIO: {str(e)}"
        )

@router.get("/usb-devices", response_model=Dict[str, Any])
async def get_usb_devices():
    """Get a list of connected USB devices."""
    try:
        return {
            "status": "success",
            "data": {
                "usb_devices": HardwareDetector.detect_usb_devices()
            }
        }
    except Exception as e:
        logger.error(f"Error detecting USB devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detecting USB devices: {str(e)}"
        )
