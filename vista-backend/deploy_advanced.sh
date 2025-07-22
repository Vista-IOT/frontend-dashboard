#!/bin/bash

# Advanced Vista IoT Backend Deployment Script
# Handles configuration deployment and process lifecycle management

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"
PIDFILE="$SCRIPT_DIR/vista-backend.pid"
LOGFILE="$SCRIPT_DIR/vista-backend.log"
CONFIG_FILE="$SCRIPT_DIR/config/deployed_config.yaml"
DEPLOYMENT_LOG="$SCRIPT_DIR/deployment.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$DEPLOYMENT_LOG"
}

# Function to kill existing processes
kill_existing_processes() {
    log "🔍 Checking for existing Vista Backend processes..."
    
    # Find all Python processes running run.py from this directory
    PIDS=$(ps aux | grep "python.*run.py" | grep "$SCRIPT_DIR" | grep -v grep | awk '{print $2}')
    
    if [ -n "$PIDS" ]; then
        log "🛑 Found existing processes: $PIDS"
        for pid in $PIDS; do
            log "   Terminating process $pid"
            kill -TERM $pid 2>/dev/null || true
        done
        
        # Wait for graceful termination
        sleep 3
        
        # Force kill any remaining processes
        REMAINING_PIDS=$(ps aux | grep "python.*run.py" | grep "$SCRIPT_DIR" | grep -v grep | awk '{print $2}')
        if [ -n "$REMAINING_PIDS" ]; then
            log "🔨 Force killing remaining processes: $REMAINING_PIDS"
            for pid in $REMAINING_PIDS; do
                kill -KILL $pid 2>/dev/null || true
            done
        fi
        
        log "✅ All existing processes terminated"
    else
        log "ℹ️  No existing processes found"
    fi
    
    # Clean up PID file if exists
    [ -f "$PIDFILE" ] && rm "$PIDFILE"
}

# Function to validate environment
validate_environment() {
    log "🔍 Validating environment..."
    
    if [ ! -d "$VENV_DIR" ]; then
        log "❌ Virtual environment not found at: $VENV_DIR"
        exit 1
    fi
    
    if [ ! -f "$SCRIPT_DIR/run.py" ]; then
        log "❌ run.py not found in script directory"
        exit 1
    fi
    
    log "✅ Environment validation passed"
}

# Function to activate virtual environment
activate_venv() {
    log "🔧 Activating virtual environment..."
    source "$VENV_DIR/bin/activate"
    
    # Verify FastAPI is installed
    if ! python -c "import fastapi" 2>/dev/null; then
        log "📦 Installing dependencies..."
        pip install -r requirements.txt
    fi
    
    log "✅ Virtual environment ready"
}

# Function to start the application
start_application() {
    log "🚀 Starting Vista IoT Backend..."
    
    # Create new log file with timestamp
    LOG_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    TIMESTAMPED_LOG="$SCRIPT_DIR/logs/vista-backend-$LOG_TIMESTAMP.log"
    mkdir -p "$SCRIPT_DIR/logs"
    
    # Start the application in background
    nohup python run.py > "$TIMESTAMPED_LOG" 2>&1 &
    APP_PID=$!
    
    # Save PID
    echo $APP_PID > "$PIDFILE"
    
    # Create symlink to latest log
    ln -sf "logs/vista-backend-$LOG_TIMESTAMP.log" "$LOGFILE"
    
    # Wait and verify startup
    sleep 3
    
    if kill -0 $APP_PID 2>/dev/null; then
        log "✅ Application started successfully (PID: $APP_PID)"
        log "📋 Log file: $TIMESTAMPED_LOG"
        log "📋 Latest log symlink: $LOGFILE"
        
        # Test if the API is responding
        if command -v curl >/dev/null 2>&1; then
            if curl -s http://localhost:8000/health >/dev/null 2>&1; then
                log "🌟 Health check passed - API is responding"
            else
                log "⚠️  Health check failed - API might still be starting"
            fi
        fi
        
    else
        log "❌ Failed to start application"
        log "📋 Check log file: $TIMESTAMPED_LOG"
        exit 1
    fi
}

# Function to show status
show_status() {
    log "📊 Vista IoT Backend Status"
    log "========================================="
    
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if kill -0 $PID 2>/dev/null; then
            log "Status: ✅ RUNNING (PID: $PID)"
            
            # Show resource usage if possible
            if command -v ps >/dev/null 2>&1; then
                PS_INFO=$(ps -p $PID -o pid,ppid,pcpu,pmem,etime,cmd --no-headers 2>/dev/null)
                if [ -n "$PS_INFO" ]; then
                    log "Process info: $PS_INFO"
                fi
            fi
        else
            log "Status: ❌ NOT RUNNING (stale PID file)"
            rm "$PIDFILE"
        fi
    else
        log "Status: ❌ NOT RUNNING"
    fi
    
    # Show recent log entries
    if [ -f "$LOGFILE" ]; then
        log ""
        log "📋 Recent log entries:"
        tail -n 5 "$LOGFILE" 2>/dev/null | while read line; do
            log "   $line"
        done
    fi
}

# Function to handle configuration deployment
deploy_with_config() {
    log "🔧 Configuration deployment mode"
    
    if [ -f "$CONFIG_FILE" ]; then
        log "📄 Found configuration file: $CONFIG_FILE"
        CONFIG_SIZE=$(wc -l < "$CONFIG_FILE")
        log "📊 Configuration size: $CONFIG_SIZE lines"
    else
        log "ℹ️  No specific configuration file found, using default settings"
    fi
    
    # Kill existing, validate, start fresh
    kill_existing_processes
    validate_environment
    activate_venv
    start_application
    
    log "🎉 Configuration deployment completed successfully"
}

# Main script logic
case "${1:-deploy}" in
    "deploy"|"start")
        deploy_with_config
        ;;
    "stop")
        log "🛑 Stopping Vista IoT Backend..."
        kill_existing_processes
        log "✅ Application stopped"
        ;;
    "restart")
        log "🔄 Restarting Vista IoT Backend..."
        kill_existing_processes
        sleep 1
        validate_environment
        activate_venv
        start_application
        ;;
    "status")
        show_status
        ;;
    "logs")
        if [ -f "$LOGFILE" ]; then
            log "📋 Showing live logs (Ctrl+C to exit)..."
            tail -f "$LOGFILE"
        else
            log "❌ Log file not found: $LOGFILE"
        fi
        ;;
    "cleanup")
        log "🧹 Cleaning up old processes and files..."
        kill_existing_processes
        # Remove old log files (keep last 10)
        find "$SCRIPT_DIR/logs" -name "vista-backend-*.log" -type f | sort | head -n -10 | xargs rm -f 2>/dev/null || true
        log "✅ Cleanup completed"
        ;;
    *)
        echo "Usage: $0 {deploy|start|stop|restart|status|logs|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy/start - Deploy configuration and start fresh application"
        echo "  stop         - Stop the application"
        echo "  restart      - Restart the application"
        echo "  status       - Show application status and recent logs"
        echo "  logs         - Show live application logs"
        echo "  cleanup      - Clean up old processes and log files"
        exit 1
        ;;
esac
