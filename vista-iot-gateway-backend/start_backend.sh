#!/bin/bash

# Vista IoT Gateway Backend Startup Script
# This script activates the virtual environment and starts the backend with proper Python path

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the backend directory
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Error: Virtual environment 'venv' not found in $SCRIPT_DIR"
    echo "Please create a virtual environment first with: python -m venv venv"
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Set Python path to include src directory
export PYTHONPATH=src

# Start the backend with uvicorn
echo "Starting Vista IoT Gateway Backend on port 8000..."
uvicorn vista_iot.app:app --reload --host 0.0.0.0 --port 8000 --log-level warning
