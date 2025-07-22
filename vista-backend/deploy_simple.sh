#!/bin/bash

# Simple Vista IoT Backend Deployment Script
set -e

echo "========================================="
echo "Vista IoT Backend Simple Deployment"
echo "========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill existing processes
echo "🛑 Killing existing processes..."
pkill -f "python.*run.py" 2>/dev/null || echo "   No existing processes found"

# Wait for cleanup
sleep 2

# Activate virtual environment
echo "✅ Activating virtual environment..."
source venv/bin/activate

# Start the application
echo "🚀 Starting Vista IoT Backend..."
echo "   Server will be available at http://0.0.0.0:8000"

case "${1:-start}" in
    "bg"|"background")
        echo "   Starting in background mode..."
        nohup python run.py > vista-backend.log 2>&1 &
        echo $! > vista-backend.pid
        echo "✅ Started in background (PID: $(cat vista-backend.pid))"
        echo "📋 Use 'tail -f vista-backend.log' to view logs"
        ;;
    *)
        echo "   Starting in foreground mode (Ctrl+C to stop)..."
        python run.py
        ;;
esac
