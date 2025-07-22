#!/bin/bash

# Vista IoT Backend Deployment Script
# This script kills old processes and starts fresh ones with new configuration

set -e  # Exit on any error

echo "========================================="
echo "Vista IoT Backend Deployment Script"
echo "========================================="

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/venv"
PIDFILE="$SCRIPT_DIR/vista-backend.pid"
LOGFILE="$SCRIPT_DIR/vista-backend.log"

# Function to kill existing processes
kill_existing_processes() {
    echo "🔍 Checking for existing Vista Backend processes..."
    
    # Find all processes running run.py from this directory
    PIDS=$(ps aux | grep "python.*run.py" | grep "$SCRIPT_DIR" | grep -v grep | awk '{print $2}')
    
    if [ -n "$PIDS" ]; then
        echo "🛑 Found existing processes. Killing them..."
        for pid in $PIDS; do
            echo "   Killing process $pid"
            kill -TERM $pid 2>/dev/null || true
        done
        
        # Wait for processes to terminate gracefully
        sleep 3
        
        # Force kill any remaining processes
        REMAINING_PIDS=$(ps aux | grep "python.*run.py" | grep "$SCRIPT_DIR" | grep -v grep | awk '{print $2}')
        if [ -n "$REMAINING_PIDS" ]; then
            echo "🔨 Force killing remaining processes..."
            for pid in $REMAINING_PIDS; do
                echo "   Force killing process $pid"
                kill -KILL $pid 2>/dev/null || true
            done
        fi
        
        echo "✅ All existing processes terminated"
    else
        echo "ℹ️  No existing processes found"
    fi
    
    # Also kill any sudo wrapper processes
    SUDO_PIDS=$(ps aux | grep "sudo.*python.*run.py" | grep "$SCRIPT_DIR" | grep -v grep | awk '{print $2}')
    if [ -n "$SUDO_PIDS" ]; then
        echo "🛑 Killing sudo wrapper processes..."
        for pid in $SUDO_PIDS; do
            echo "   Killing sudo process $pid"
            kill -TERM $pid 2>/dev/null || true
        done
    fi
}

# Function to check virtual environment
check_venv() {
    if [ -d "$VENV_DIR" ]; then
        echo "✅ Virtual environment found: $VENV_DIR"
        source "$VENV_DIR/bin/activate"
    else
        echo "❌ Virtual environment not found at: $VENV_DIR"
        echo "Please create a virtual environment first:"
        echo "  python3 -m venv venv"
        echo "  source venv/bin/activate"
        echo "  pip install -r requirements.txt"
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    echo "🔍 Checking dependencies..."
    
    # Check if FastAPI is installed in the venv
    python -c "import fastapi" 2>/dev/null || {
        echo "📦 Installing required dependencies..."
        pip install -r requirements.txt
        echo "✅ Dependencies installed"
    }
}

# Function to start the application
start_application() {
    echo "🚀 Starting Vista IoT Backend..."
    
    # Remove old PID file if exists
    [ -f "$PIDFILE" ] && rm "$PIDFILE"
    
    # Start the application in the background
    echo "   Starting server on http://0.0.0.0:8000"
    echo "   Log file: $LOGFILE"
    
    # Check if we need sudo
    if [ "$EUID" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        echo "   Running with sudo (password may be required)"
        # Start with sudo in background
        sudo -b $(which python) run.py > "$LOGFILE" 2>&1 &
        APP_PID=$!
    else
        # Start without sudo
        $(which python) run.py > "$LOGFILE" 2>&1 &
        APP_PID=$!
    fi
    
    # Save PID to file
    echo $APP_PID > "$PIDFILE"
    
    # Wait a moment to check if the process started successfully
    sleep 3
    
    # Check if the actual python process is running
    PYTHON_PID=$(pgrep -f "python.*run.py")
    if [ -n "$PYTHON_PID" ]; then
        echo "✅ Application started successfully (Python PID: $PYTHON_PID)"
        echo $PYTHON_PID > "$PIDFILE"  # Update with actual Python PID
        echo "📋 Use 'tail -f $LOGFILE' to view logs"
        echo "🛑 Use './deploy.sh stop' to stop the application"
    else
        echo "❌ Failed to start application"
        echo "Check the log file: $LOGFILE"
        [ -f "$LOGFILE" ] && echo "Last few lines of log:" && tail -n 5 "$LOGFILE"
        exit 1
    fi
}

# Function to stop the application
stop_application() {
    echo "🛑 Stopping Vista IoT Backend..."
    kill_existing_processes
    [ -f "$PIDFILE" ] && rm "$PIDFILE"
    echo "✅ Application stopped"
}

# Function to show status
show_status() {
    echo "📊 Vista IoT Backend Status"
    echo "========================================="
    
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if kill -0 $PID 2>/dev/null; then
            echo "Status: ✅ RUNNING (PID: $PID)"
        else
            echo "Status: ❌ NOT RUNNING (stale PID file)"
            rm "$PIDFILE"
        fi
    else
        echo "Status: ❌ NOT RUNNING"
    fi
    
    # Show all Vista-related processes
    PROCESSES=$(ps aux | grep "python.*run.py" | grep "$SCRIPT_DIR" | grep -v grep)
    if [ -n "$PROCESSES" ]; then
        echo ""
        echo "Related processes:"
        echo "$PROCESSES"
    fi
}

# Main script logic
case "${1:-start}" in
    "start"|"deploy")
        kill_existing_processes
        check_venv
        install_dependencies
        start_application
        ;;
    "stop")
        stop_application
        ;;
    "restart")
        stop_application
        sleep 1
        check_venv
        install_dependencies
        start_application
        ;;
    "status")
        show_status
        ;;
    "logs")
        if [ -f "$LOGFILE" ]; then
            tail -f "$LOGFILE"
        else
            echo "❌ Log file not found: $LOGFILE"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|deploy}"
        echo ""
        echo "Commands:"
        echo "  start/deploy - Kill old processes and start fresh application"
        echo "  stop         - Stop the application"
        echo "  restart      - Stop and start the application"
        echo "  status       - Show application status"
        echo "  logs         - Show application logs (tail -f)"
        exit 1
        ;;
esac
