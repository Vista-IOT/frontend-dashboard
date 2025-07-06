import uvicorn
import logging
import os
from .api.app import IOTGatewayApp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    # Create the FastAPI application
    gateway = IOTGatewayApp()
    app = gateway.get_app()

    # Get host and port from environment or use defaults
    host = os.getenv("VISTA_IOT_HOST", "0.0.0.0")
    port = int(os.getenv("VISTA_IOT_PORT", "8000"))

    # Start the server
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    main() 