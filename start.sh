#!/bin/bash

# William Blake Bibliography PDF Viewer Startup Script

echo "🚀 Starting William Blake Bibliography PDF Viewer..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ and try again."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ and try again."
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Backend setup
echo "📚 Setting up backend..."
cd "$SCRIPT_DIR/backend"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start backend server in background
echo "Starting FastAPI backend server..."
export PYTHONPATH="$SCRIPT_DIR/backend"
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend server started (PID: $BACKEND_PID)"

# Frontend setup
echo "⚛️  Setting up frontend..."
cd "$SCRIPT_DIR/frontend"

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Wait a moment for backend to start
sleep 3

# Start frontend server
echo "Starting React frontend server..."
echo "📖 Application will be available at: http://localhost:3000"
echo "🔧 Backend API available at: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    pkill -f "uvicorn main:app" 2>/dev/null
    echo "✅ Cleanup complete"
    exit 0
}

# Set trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Start frontend (this will block)
npm start
