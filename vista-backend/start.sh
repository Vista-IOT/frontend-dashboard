#!/bin/bash

# Vista IoT Backend Startup Script
echo "Starting Vista IoT Backend..."

# Check if running in a virtual environment
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "Using virtual environment: $VIRTUAL_ENV"
else
    echo "Not in virtual environment - consider using one"
fi

# Check if psutil is installed
python3 -c "import psutil" 2>/dev/null || {
    echo "Installing required dependencies..."
    pip install -r requirements.txt
}

# Start the server
echo "Starting server on http://0.0.0.0:8000"
python3 run.py
