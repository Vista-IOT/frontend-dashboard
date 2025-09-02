#!/bin/bash

# Script to monitor DNP3 logs in real-time
LOG_FILE="/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend/logs/dnp3_detailed.log"

echo "🔍 Monitoring DNP3 logs in real-time..."
echo "📁 Log file: $LOG_FILE"
echo "💡 Press Ctrl+C to stop monitoring"
echo "----------------------------------------"

# Create the log file if it doesn't exist
touch "$LOG_FILE"

# Follow the log file in real-time
tail -f "$LOG_FILE"
