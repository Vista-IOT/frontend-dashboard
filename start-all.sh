#!/bin/bash

################################################################################
# Vista IoT Platform - Ultimate Startup Script
# 
# This script manages all three services:
# 1. Vista Backend (Python FastAPI) - Port 8000
# 2. Data Service (Python FastAPI) - Port 8080
# 3. Frontend Dashboard (Next.js) - Port 3000
#
# Usage:
#   ./start-all.sh          - Start all services
#   ./start-all.sh stop     - Stop all services
#   ./start-all.sh restart  - Restart all services
#   ./start-all.sh status   - Check status of all services
################################################################################

set -e  # Exit on error

# Trap to reset terminal on exit
trap 'printf "\033[0m"; stty sane 2>/dev/null || true' EXIT INT TERM

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Service directories
BACKEND_DIR="$SCRIPT_DIR/vista-backend"
DATASERVICE_DIR="$SCRIPT_DIR/Data-Service"
FRONTEND_DIR="$SCRIPT_DIR"

# PID files
BACKEND_PID_FILE="$BACKEND_DIR/pids/backend.pid"
DATASERVICE_PID_FILE="$DATASERVICE_DIR/dataservice.pid"
DATASERVICE_SYNC_PID_FILE="$DATASERVICE_DIR/dataservice-sync.pid"
FRONTEND_PID_FILE="$FRONTEND_DIR/frontend.pid"

# Log files
BACKEND_LOG="$BACKEND_DIR/logs/backend.log"
DATASERVICE_LOG="$DATASERVICE_DIR/logs/dataservice.log"
DATASERVICE_SYNC_LOG="$DATASERVICE_DIR/logs/dataservice-sync.log"
FRONTEND_LOG="$FRONTEND_DIR/frontend.logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

################################################################################
# Utility Functions
################################################################################

print_header() {
    echo ""
    echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC}  $1"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_service() {
    echo -e "${CYAN}➜${NC} $1"
}

# Check if a process is running
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Running
        fi
    fi
    return 1  # Not running
}

# Wait for a service to be healthy
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_wait=${3:-30}
    local wait_time=0
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        sleep 1
        wait_time=$((wait_time + 1))
        echo -n "."
    done
    
    echo ""
    print_error "$service_name failed to start within ${max_wait}s"
    return 1
}

################################################################################
# Stop Functions
################################################################################

stop_backend() {
    print_service "Stopping Vista Backend..."
    
    cd "$BACKEND_DIR"
    
    # Kill all backend processes (including those started with sudo)
    sudo pkill -f "python.*run.py" 2>/dev/null || true
    sudo pkill -f "uvicorn.*app:app" 2>/dev/null || true
    pkill -f "python.*run.py" 2>/dev/null || true
    pkill -f "uvicorn.*app:app" 2>/dev/null || true
    
    # Wait a moment for graceful shutdown
    sleep 1
    
    # Force kill if still running
    sudo pkill -9 -f "python.*run.py" > /dev/null 2>&1 || true
    sudo pkill -9 -f "uvicorn.*app:app" > /dev/null 2>&1 || true
    
    # Clean up PID files
    rm -f "$BACKEND_DIR/pids/"*.pid 2>/dev/null || true
    
    # Verify it's stopped
    if pgrep -f "python.*run.py" > /dev/null 2>&1 || pgrep -f "uvicorn.*app:app" > /dev/null 2>&1; then
        print_error "Backend still running after stop attempt"
    else
        print_success "Backend stopped"
    fi
}

stop_dataservice() {
    print_service "Stopping Data Service..."
    
    cd "$DATASERVICE_DIR"
    
    # First try using the service's own stop script
    if [ -f "./start.sh" ]; then
        ./start.sh stop > /dev/null 2>&1 || true
    fi
    
    # Force kill any remaining Data Service processes
    # This ensures we catch processes started outside of our script
    pkill -f "uvicorn.*dataservice.server:app" 2>/dev/null || true
    pkill -f "sync_runner.py" 2>/dev/null || true
    
    # Wait a moment for graceful shutdown
    sleep 1
    
    # Force kill if still running
    pkill -9 -f "uvicorn.*dataservice.server:app" 2>/dev/null || true
    pkill -9 -f "sync_runner.py" 2>/dev/null || true
    
    # Clean up PID files
    rm -f "$DATASERVICE_PID_FILE" "$DATASERVICE_SYNC_PID_FILE" 2>/dev/null || true
    
    # Verify it's stopped
    if pgrep -f "uvicorn.*dataservice.server:app" > /dev/null 2>&1; then
        print_error "Data Service still running after stop attempt"
    else
        print_success "Data Service stopped"
    fi
}

stop_frontend() {
    print_service "Stopping Frontend Dashboard..."
    
    local stopped=false
    
    # First, try to stop using PID file
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            # Kill the main process and all its children
            pkill -P "$pid" 2>/dev/null || true
            kill "$pid" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                pkill -9 -P "$pid" 2>/dev/null || true
                kill -9 "$pid" 2>/dev/null || true
            fi
            stopped=true
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # Also kill any remaining Next.js dev processes
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "node.*next.*dev" 2>/dev/null || true
    sleep 1
    # Force kill any stubborn processes
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "node.*next.*dev" 2>/dev/null || true
    
    # Verify all processes are stopped
    if pgrep -f "next dev" > /dev/null || pgrep -f "node.*next.*dev" > /dev/null; then
        print_warning "Some frontend processes may still be running"
    else
        print_success "Frontend stopped"
    fi
}

stop_all_services() {
    print_header "Stopping All Vista IoT Services"
    
    stop_frontend
    sleep 1
    stop_dataservice
    sleep 1
    stop_backend
    
    echo ""
    print_success "All services stopped successfully!"
    echo ""
}

################################################################################
# Start Functions
################################################################################

start_backend() {
    print_service "Starting Vista Backend (Port 8000)..."
    
    cd "$BACKEND_DIR"
    
    # Check if already running
    if is_running "$BACKEND_PID_FILE"; then
        print_warning "Backend is already running"
        return 0
    fi
    
    # Create logs directory
    mkdir -p logs pids
    
    # Fix permissions if directories are owned by root
    if [ -d "logs" ] && [ "$(stat -c '%U' logs)" = "root" ]; then
        sudo chown -R $USER:$USER logs
    fi
    if [ -d "pids" ] && [ "$(stat -c '%U' pids)" = "root" ]; then
        sudo chown -R $USER:$USER pids
    fi
    
    # Check/create virtual environment
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment for backend..."
        python3 -m venv venv
    fi
    
    # Activate venv and install dependencies
    source venv/bin/activate
    
    print_status "Installing backend dependencies..."
    pip install -q -r requirements.txt 2>&1 | grep -v "Requirement already satisfied" || true
    
    # Stop getty service if needed
    sudo systemctl stop serial-getty@ttyAS0.service 2>/dev/null || true
    sudo pkill -f "getty.*ttyAS0" 2>/dev/null || true
    
    # Start backend in background
    print_status "Launching backend server..."
    nohup sudo $(which python) run.py > "$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    
    # Save PID
    echo $backend_pid > "$BACKEND_PID_FILE"
    
    # Wait for backend to be ready
    if wait_for_service "Backend" "http://localhost:8000/health" 30; then
        print_success "Backend started successfully (PID: $backend_pid)"
        
        # Initialize default admin user after backend is ready (will skip if already exists)
        print_status "Ensuring admin user exists..."
        sleep 2  # Give backend a moment to fully initialize
        curl -s -X POST http://localhost:8000/api/admin/initialize -H "Content-Type: application/json" > /dev/null 2>&1 || true
        
        return 0
    else
        print_error "Backend failed to start. Check logs: $BACKEND_LOG"
        return 1
    fi
}

start_dataservice() {
    print_service "Starting Data Service (Port 8080)..."
    
    cd "$DATASERVICE_DIR"
    
    # Check if already running
    if is_running "$DATASERVICE_PID_FILE"; then
        print_warning "Data Service is already running"
        return 0
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Check/create virtual environment
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment for data service..."
        python3 -m venv venv
    fi
    
    # Activate venv and install dependencies
    source venv/bin/activate
    
    print_status "Installing data service dependencies..."
    pip install -q -r requirements.txt
    
    # Start using the service's own start script
    print_status "Launching data service..."
    ./start.sh > /dev/null 2>&1
    
    # Wait for data service to be ready
    if wait_for_service "Data Service" "http://localhost:8080/health" 30; then
        local ds_pid=$(cat "$DATASERVICE_PID_FILE" 2>/dev/null || echo "unknown")
        print_success "Data Service started successfully (PID: $ds_pid)"
        
        # Check sync service
        if is_running "$DATASERVICE_SYNC_PID_FILE"; then
            local sync_pid=$(cat "$DATASERVICE_SYNC_PID_FILE" 2>/dev/null || echo "unknown")
            print_success "Data Sync Service started successfully (PID: $sync_pid)"
        else
            print_warning "Data Sync Service may not have started. Check logs: $DATASERVICE_SYNC_LOG"
        fi
        return 0
    else
        print_error "Data Service failed to start. Check logs: $DATASERVICE_LOG"
        return 1
    fi
}

start_frontend() {
    print_service "Starting Frontend Dashboard (Port 3000)..."
    
    cd "$FRONTEND_DIR"
    
    # Check if already running
    if is_running "$FRONTEND_PID_FILE"; then
        print_warning "Frontend is already running"
        return 0
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        return 1
    fi
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        print_status "Installing pnpm..."
        npm install -g pnpm
    fi
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies (this may take a while)..."
        pnpm install
    else
        print_status "Checking frontend dependencies..."
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    fi
    
    # Setup Prisma database - Always run migrations to ensure schema is up to date
    print_status "Running database migrations..."
    npx prisma migrate deploy > /dev/null 2>&1 || npx prisma migrate dev --skip-generate > /dev/null 2>&1 || true
    
    print_status "Generating Prisma Client..."
    npx prisma generate > /dev/null 2>&1
    
    # Start frontend in background
    print_status "Launching frontend server..."
    nohup pnpm dev > "$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!
    
    # Save PID
    echo $frontend_pid > "$FRONTEND_PID_FILE"
    
    # Wait for frontend to be ready
    if wait_for_service "Frontend" "http://localhost:3000" 45; then
        print_success "Frontend started successfully (PID: $frontend_pid)"
        return 0
    else
        print_error "Frontend failed to start. Check logs: $FRONTEND_LOG"
        return 1
    fi
}

start_all_services() {
    print_header "🚀 Starting Vista IoT Platform - All Services"
    
    echo -e "${CYAN}Service Startup Sequence:${NC}"
    echo "  1. Vista Backend (Python FastAPI) → Port 8000"
    echo "  2. Data Service (Python FastAPI) → Port 8080"
    echo "  3. Frontend Dashboard (Next.js) → Port 3000"
    echo ""
    
    # Start services in sequence
    if ! start_backend; then
        print_error "Failed to start backend. Aborting..."
        return 1
    fi
    
    sleep 2
    
    if ! start_dataservice; then
        print_error "Failed to start data service. Aborting..."
        stop_backend
        return 1
    fi
    
    sleep 2
    
    if ! start_frontend; then
        print_error "Failed to start frontend. Aborting..."
        stop_dataservice
        stop_backend
        return 1
    fi
    
    # Print summary
    echo ""
    print_header "✅ All Services Started Successfully!"
    
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  Service Status & Information"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}Vista Backend${NC}"
    echo -e "${GREEN}║${NC}    URL:  http://localhost:8000"
    echo -e "${GREEN}║${NC}    Docs: http://localhost:8000/docs"
    echo -e "${GREEN}║${NC}    PID:  $(cat "$BACKEND_PID_FILE" 2>/dev/null || echo "N/A")"
    echo -e "${GREEN}║${NC}    Logs: $BACKEND_LOG"
    echo -e "${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}Data Service${NC}"
    echo -e "${GREEN}║${NC}    URL:  http://localhost:8080"
    echo -e "${GREEN}║${NC}    Docs: http://localhost:8080/docs"
    echo -e "${GREEN}║${NC}    PID:  $(cat "$DATASERVICE_PID_FILE" 2>/dev/null || echo "N/A")"
    echo -e "${GREEN}║${NC}    Sync: $(cat "$DATASERVICE_SYNC_PID_FILE" 2>/dev/null || echo "N/A")"
    echo -e "${GREEN}║${NC}    Logs: $DATASERVICE_LOG"
    echo -e "${GREEN}║${NC}    Sync: $DATASERVICE_SYNC_LOG"
    echo -e "${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}Frontend Dashboard${NC}"
    echo -e "${GREEN}║${NC}    URL:  http://localhost:3000"
    echo -e "${GREEN}║${NC}    PID:  $(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "N/A")"
    echo -e "${GREEN}║${NC}    Logs: $FRONTEND_LOG"
    echo -e "${GREEN}║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}Quick Commands:${NC}"
    echo -e "${GREEN}║${NC}    Stop all:    ./start-all.sh stop"
    echo -e "${GREEN}║${NC}    Restart all: ./start-all.sh restart"
    echo -e "${GREEN}║${NC}    Check status: ./start-all.sh status"
    echo -e "${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}View Logs:${NC}"
    echo -e "${GREEN}║${NC}    Backend:     tail -f $BACKEND_LOG"
    echo -e "${GREEN}║${NC}    Data Service: tail -f $DATASERVICE_LOG"
    echo -e "${GREEN}║${NC}    Frontend:    tail -f $FRONTEND_LOG"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

################################################################################
# Status Function
################################################################################

check_status() {
    print_header "Vista IoT Platform - Service Status"
    
    echo -e "${CYAN}Checking service status...${NC}"
    echo ""
    
    # Backend
    echo -e "${BLUE}Vista Backend:${NC}"
    if is_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE")
        echo -e "  Status: ${GREEN}Running${NC} (PID: $pid)"
        echo -e "  URL:    http://localhost:8000"
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}Healthy${NC}"
        else
            echo -e "  Health: ${RED}Unhealthy${NC}"
        fi
    else
        echo -e "  Status: ${RED}Not Running${NC}"
    fi
    echo ""
    
    # Data Service
    echo -e "${BLUE}Data Service:${NC}"
    if is_running "$DATASERVICE_PID_FILE"; then
        local pid=$(cat "$DATASERVICE_PID_FILE")
        echo -e "  Status: ${GREEN}Running${NC} (PID: $pid)"
        echo -e "  URL:    http://localhost:8080"
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}Healthy${NC}"
        else
            echo -e "  Health: ${RED}Unhealthy${NC}"
        fi
        
        # Check sync service
        if is_running "$DATASERVICE_SYNC_PID_FILE"; then
            local sync_pid=$(cat "$DATASERVICE_SYNC_PID_FILE")
            echo -e "  Sync:   ${GREEN}Running${NC} (PID: $sync_pid)"
        else
            echo -e "  Sync:   ${RED}Not Running${NC}"
        fi
    else
        echo -e "  Status: ${RED}Not Running${NC}"
    fi
    echo ""
    
    # Frontend
    echo -e "${BLUE}Frontend Dashboard:${NC}"
    if is_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        echo -e "  Status: ${GREEN}Running${NC} (PID: $pid)"
        echo -e "  URL:    http://localhost:3000"
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}Healthy${NC}"
        else
            echo -e "  Health: ${YELLOW}Starting...${NC}"
        fi
    else
        echo -e "  Status: ${RED}Not Running${NC}"
    fi
    echo ""
}

################################################################################
# Main Script Logic
################################################################################

case "${1:-start}" in
    start)
        start_all_services
        ;;
    stop)
        stop_all_services
        ;;
    restart)
        stop_all_services
        sleep 3
        start_all_services
        ;;
    status)
        check_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services (default)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Check status of all services"
        exit 1
        ;;
esac

# Reset terminal to prevent display corruption
printf "\033[0m"
stty sane 2>/dev/null || true
