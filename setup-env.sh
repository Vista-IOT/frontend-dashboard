#!/bin/bash

# ============================================
# Environment Configuration Setup Script
# ============================================
# This script creates .env files for all services
# with network-agnostic configuration

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Environment Configuration Setup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect the host's IP address (for network access)
HOST_IP=$(hostname -I | awk '{print $1}')
if [ -z "$HOST_IP" ]; then
    HOST_IP="localhost"
fi

echo -e "${YELLOW}Detected Host IP: ${HOST_IP}${NC}"
echo ""

# ============================================
# 1. Root .env file
# ============================================
echo -e "${GREEN}[1/5] Creating root .env file...${NC}"
cat > "${PROJECT_ROOT}/.env" << 'EOF'
# ============================================
# Global Network Configuration
# ============================================
# This file configures host and port settings for the entire application stack
# Modify these values to match your network environment

# Global Host - Use 0.0.0.0 to bind to all interfaces
HOST_GLOBAL=0.0.0.0

# Service Ports
FRONTEND_PORT=3000
BACKEND_PORT=8000
DATA_SERVICE_PORT=8080

# Public URLs (for client-side access from browser)
# Change these to your actual hostname/IP for remote access
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_DATA_SERVICE_URL=http://localhost:8080

# Internal Service Communication (server-side)
BACKEND_API_URL=http://localhost:8000
DATA_SERVICE_API_URL=http://localhost:8080
EOF
echo -e "   ✓ Created: ${PROJECT_ROOT}/.env"

# ============================================
# 2. Frontend .env.local
# ============================================
echo -e "${GREEN}[2/5] Creating Frontend .env.local...${NC}"
cat > "${PROJECT_ROOT}/.env.local" << 'EOF'
# ============================================
# Frontend Environment Configuration
# ============================================

# Backend API URL (for server-side requests)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

# Data-Service URL (for real-time data)
NEXT_PUBLIC_DATA_SERVICE_URL=http://localhost:8080

# Backend URL (alternative naming)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Frontend Port
PORT=3000

# ============================================
# Network Access Configuration
# ============================================
# For remote access, replace localhost with your server's IP address
# Example: NEXT_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
EOF
echo -e "   ✓ Created: ${PROJECT_ROOT}/.env.local"

# ============================================
# 3. Data-Service .env
# ============================================
echo -e "${GREEN}[3/5] Creating Data-Service .env...${NC}"
cat > "${PROJECT_ROOT}/Data-Service/.env" << 'EOF'
# ============================================
# Data-Service Environment Configuration
# ============================================

# Server Configuration
HOST=0.0.0.0
PORT=8080
SERVER_HOST=0.0.0.0

# Service URLs
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# MQTT Forwarder Configuration
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_CLIENT_ID=dataservice-gateway
MQTT_TOPIC_PREFIX=dataservice
MQTT_QOS=1
MQTT_RETAIN=false
MQTT_PUBLISH_INTERVAL_SEC=1.0
MQTT_MAX_QUEUE=1000

# Optional: MQTT Authentication
# MQTT_USERNAME=
# MQTT_PASSWORD=

# ============================================
# Network Access Configuration
# ============================================
# For remote access, replace localhost with your server's IP address
# Example: BACKEND_URL=http://192.168.1.100:8000
EOF
echo -e "   ✓ Created: ${PROJECT_ROOT}/Data-Service/.env"

# ============================================
# 4. Backend .env
# ============================================
echo -e "${GREEN}[4/5] Creating Backend .env...${NC}"
cat > "${PROJECT_ROOT}/vista-backend/.env" << 'EOF'
# ============================================
# Backend Environment Configuration
# ============================================

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Service URLs
FRONTEND_URL=http://localhost:3000
FRONTEND_HOST=localhost
DATA_SERVICE_URL=http://localhost:8080

# Database Configuration
DATABASE_URL=sqlite:///./vista.db

# Security
SECRET_KEY=your-secret-key-change-in-production

# ============================================
# Network Access Configuration
# ============================================
# For remote access, replace localhost with your server's IP address
# Example: FRONTEND_URL=http://192.168.1.100:3000
EOF
echo -e "   ✓ Created: ${PROJECT_ROOT}/vista-backend/.env"

# ============================================
# 5. Create .env.example files (for version control)
# ============================================
echo -e "${GREEN}[5/5] Creating .env.example files...${NC}"

# Root .env.example
cp "${PROJECT_ROOT}/.env" "${PROJECT_ROOT}/.env.example"
echo -e "   ✓ Created: ${PROJECT_ROOT}/.env.example"

# Frontend .env.example
cp "${PROJECT_ROOT}/.env.local" "${PROJECT_ROOT}/.env.local.example"
echo -e "   ✓ Created: ${PROJECT_ROOT}/.env.local.example"

# Data-Service .env.example
cp "${PROJECT_ROOT}/Data-Service/.env" "${PROJECT_ROOT}/Data-Service/.env.example"
echo -e "   ✓ Created: ${PROJECT_ROOT}/Data-Service/.env.example"

# Backend .env.example
cp "${PROJECT_ROOT}/vista-backend/.env" "${PROJECT_ROOT}/vista-backend/.env.example"
echo -e "   ✓ Created: ${PROJECT_ROOT}/vista-backend/.env.example"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ Environment configuration complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}📝 Configuration Summary:${NC}"
echo -e "   • Root:         ${PROJECT_ROOT}/.env"
echo -e "   • Frontend:     ${PROJECT_ROOT}/.env.local"
echo -e "   • Data-Service: ${PROJECT_ROOT}/Data-Service/.env"
echo -e "   • Backend:      ${PROJECT_ROOT}/vista-backend/.env"
echo ""
echo -e "${YELLOW}🌐 Network Configuration:${NC}"
echo -e "   • Services bind to: ${GREEN}0.0.0.0${NC} (all interfaces)"
echo -e "   • Frontend:         ${GREEN}http://localhost:3000${NC}"
echo -e "   • Backend:          ${GREEN}http://localhost:8000${NC}"
echo -e "   • Data-Service:     ${GREEN}http://localhost:8080${NC}"
echo ""
echo -e "${YELLOW}🔧 For Remote Access:${NC}"
echo -e "   1. Edit the .env files"
echo -e "   2. Replace 'localhost' with your server IP: ${GREEN}${HOST_IP}${NC}"
echo -e "   3. Example: NEXT_PUBLIC_BACKEND_URL=http://${HOST_IP}:8000"
echo ""
echo -e "${YELLOW}🚀 Next Steps:${NC}"
echo -e "   1. Review and customize the .env files if needed"
echo -e "   2. Restart all services to apply changes"
echo -e "   3. Run: ${GREEN}./run.sh${NC} (Frontend)"
echo -e "   4. Run: ${GREEN}cd Data-Service && ./start.sh${NC}"
echo -e "   5. Run: ${GREEN}cd vista-backend && ./start.sh${NC}"
echo ""
