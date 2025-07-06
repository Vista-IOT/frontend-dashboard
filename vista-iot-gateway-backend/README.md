# Vista IoT Gateway Backend

This is the backend server for the Vista IoT Gateway, which provides comprehensive industrial IoT gateway functionality.

## Features

- **Device Management**: Configure and manage industrial devices
- **Protocol Support**: Modbus TCP/RTU, MQTT, and extensible for other protocols
- **Tag Management**: IO tags, calculation tags, statistics tags, and user-defined tags
- **Data Processing**: Formula calculations, statistics, and data manipulation
- **Communication Forwarding**: Forward data to cloud platforms, MQTT brokers, REST APIs
- **Security**: User authentication, certificate management, and secure communications
- **Network Configuration**: Ethernet, WiFi, firewall, DHCP server, and more
- **Database Integration**: Persistent storage using SQLite database

## Prerequisites

- Python 3.8+
- SQLite 3
- Access to hardware interfaces (for production use)

## Installation

1. Install the required Python packages:

```bash
pip install -r requirements.txt
```

2. Ensure the SQLite database is set up:

```bash
# For development, ensure the frontend Prisma database is created
cd ../
npx prisma migrate dev --name init
```

## Configuration

The gateway uses a layered configuration approach:

1. Default configuration (built-in)
2. User configuration file (YAML)
3. Database configuration (from SQLite)

Configuration can be provided via:
- YAML files in the `config/` directory
- The SQLite database in the frontend's `prisma/` directory
- API calls to update specific settings

## Running the Backend

### Development Mode

To run the backend in development mode with API server:

```bash
python -m vista_iot.app
```

### Options

- `--config`: Path to configuration file
- `--db`: Path to SQLite database file
- `--api-only`: Run API server only
- `--gateway-only`: Run gateway only (no API server)
- `--host`: API server host (default: 0.0.0.0)
- `--port`: API server port (default: 8000)

Examples:

```bash
# Run with custom configuration file
python -m vista_iot.app --config /path/to/config.yaml

# Run with custom database
python -m vista_iot.app --db /path/to/database.db

# Run gateway only (no API server)
python -m vista_iot.app --gateway-only

# Run on a specific port
python -m vista_iot.app --port 8080
```

## API Endpoints

The backend provides RESTful API endpoints:

- `/api/status`: Get gateway status
- `/api/config`: Get/update configuration
- `/api/restart`: Restart the gateway
- `/api/tags`: Get all tags or specific tag
- `/api/protocols`: Get information about active protocols

## Extending the Gateway

The gateway is designed to be modular and extensible:

1. Add new protocol support in `src/vista_iot/protocols/`
2. Add new hardware support in `src/vista_iot/hardware/`
3. Add new communication methods in `src/vista_iot/communication/`

## Integration with Frontend

The backend integrates with the frontend through:

1. RESTful API
2. Shared SQLite database
3. Configuration files

## Production Deployment

For production deployment:

1. Use a proper WSGI server (like Gunicorn)
2. Set up proper authentication and SSL
3. Configure firewall rules
4. Set up monitoring and logging

Example:

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker vista_iot.app:app
```

## License

This software is proprietary and confidential.
