#!/bin/bash

# Vista IoT Frontend Dashboard - Setup and Run Script
# This script initializes Prisma database and starts the development server

set -e  # Exit on any error

echo "🚀 Vista IoT Frontend Dashboard Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found. Installing pnpm..."
    npm install -g pnpm
    print_success "pnpm installed successfully"
fi

print_status "Node.js version: $(node --version)"
print_status "pnpm version: $(pnpm --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies with pnpm..."
    pnpm install
    print_success "Dependencies installed successfully"
else
    print_status "Dependencies already installed. Checking for updates..."
    pnpm install --frozen-lockfile
fi

# Check if Prisma database file exists
if [ ! -f "prisma/dev.db" ]; then
    print_warning "Database file not found. Creating new database..."
    # If no database exists, run migrations to create it
    print_status "Running Prisma migrations..."
    npx prisma migrate deploy
else
    print_status "Database file found at prisma/dev.db"
fi

# Generate Prisma Client
print_status "Generating Prisma Client..."
npx prisma generate
print_success "Prisma Client generated successfully"

# Check migration status
print_status "Checking database migration status..."
npx prisma migrate status

# Optional: Seed the database if seed script exists
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
    print_status "Seeding database..."
    npx prisma db seed
    print_success "Database seeded successfully"
fi

print_success "✅ Database setup complete!"
echo ""

# Start the development server
print_status "Starting development server..."
echo -e "${GREEN}🌟 Starting Vista IoT Frontend Dashboard...${NC}"
echo -e "${BLUE}📱 The application will be available at: http://localhost:3000${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop the server${NC}"
echo ""

# Start the development server
pnpm run dev
