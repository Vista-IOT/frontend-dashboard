# Vista IoT Backend

A lightweight, modular FastAPI backend that provides hardware detection and system monitoring capabilities for the Vista IoT Gateway dashboard.

## Features

- **Hardware Detection**: Detect serial ports, network interfaces, GPIO, and USB devices
- **System Monitoring**: CPU, memory, disk usage, and uptime monitoring
- **Dashboard API**: Real-time system overview for dashboard components
- **Cross-platform**: Supports Linux and Windows systems
- **RESTful API**: Clean, documented REST endpoints

## API Endpoints

### Hardware Detection
- `GET /api/hardware/detect` - Detect all hardware resources
- `GET /api/hardware/serial-ports` - Get available serial ports
- `GET /api/hardware/network-interfaces` - Get network interfaces
- `GET /api/hardware/gpio` - Get GPIO information
- `GET /api/hardware/usb-devices` - Get connected USB devices

### Dashboard
- `GET /api/dashboard/overview` - Get system overview (CPU, memory, disk, network)

### System
- `GET /` - API status check
- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation (Swagger UI)

## Project Structure

```
vista-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── models/
│   │   ├── __init__.py
│   │   └── responses.py     # Pydantic response models
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── hardware.py      # Hardware detection endpoints
│   │   └── dashboard.py     # Dashboard endpoints
│   └── services/
│       ├── __init__.py
│       ├── hardware_detector.py  # Hardware detection logic
│       └── dashboard.py     # Dashboard service
├── requirements.txt         # Python dependencies
├── run.py                  # Application runner
├── start.sh               # Startup script
└── README.md             # This file
```

## Quick Start

1. **Install Dependencies** (if needed):
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Server**:
   ```bash
   # Option 1: Using the startup script
   ./start.sh
   
   # Option 2: Using Python directly
   python3 run.py
   
   # Option 3: Using uvicorn directly
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Access the API**:
   - API Documentation: http://localhost:8000/docs
   - Health Check: http://localhost:8000/health
   - Hardware Detection: http://localhost:8000/api/hardware/detect
   - Dashboard Overview: http://localhost:8000/api/dashboard/overview

## Dependencies

- **FastAPI**: Modern, fast web framework for building APIs
- **Uvicorn**: Lightning-fast ASGI server
- **Pydantic**: Data validation using Python type annotations
- **psutil**: Cross-platform library for system and process monitoring

## Development

The backend is designed to be:
- **Modular**: Clean separation of concerns with routers, services, and models
- **Extensible**: Easy to add new endpoints and functionality
- **Well-documented**: Comprehensive API documentation via Swagger UI
- **Type-safe**: Full type hints and Pydantic models for data validation

## Notes

- The backend automatically detects the underlying operating system and adapts hardware detection accordingly
- Some hardware detection features may require appropriate system permissions
- psutil is used for cross-platform system monitoring when available
- The API includes comprehensive error handling and logging
