#!/bin/bash
"""
Startup script for Vista IoT Backend without root privileges
This is useful for testing and development
"""

echo "🚀 Starting Vista IoT Backend (non-root mode)..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please create it first:"
    echo "   python3 -m venv venv"
    echo "   source venv/bin/activate"
    echo "   pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
echo "📦 Checking dependencies..."
python -c "import fastapi" 2>/dev/null || {
    echo "Installing dependencies..."
    pip install -r requirements.txt
}

# Start the backend without root privileges
echo "🔧 Starting backend in non-root mode..."
echo "   Note: Network configuration features may be limited"
echo "   Server will be available at: http://localhost:8000"
echo ""

# Run the backend
python run.py 