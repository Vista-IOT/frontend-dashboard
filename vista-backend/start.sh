#!/bin/bash

# Vista IoT Backend Startup Script
echo "Starting Vista IoT Backend..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/venv"

# Check if virtual environment exists
if [ -d "$VENV_DIR" ]; then
    echo "Activating virtual environment: $VENV_DIR"
    source "$VENV_DIR/bin/activate"
else
    echo "Virtual environment not found at: $VENV_DIR"
    echo "Please create a virtual environment first:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Check if FastAPI is installed in the venv
python -c "import fastapi" 2>/dev/null || {
    echo "Installing required dependencies in virtual environment..."
    pip install -r requirements.txt
}

# Start the server with sudo for network configuration
echo "Starting server on http://0.0.0.0:8000 (with sudo for network configuration)"
echo "Note: This script requires sudo privileges to configure network interfaces"
sudo $(which python) run.py
