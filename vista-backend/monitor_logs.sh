#!/bin/bash
LOGS_DIR="/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend/logs"

case "$1" in
  "tail-api")
    echo "📡 Monitoring API requests/responses..."
    tail -f "$LOGS_DIR/api.log" 2>/dev/null || echo "api.log not created yet - start the app first"
    ;;
  "tail-polling")
    echo "🔄 Monitoring protocol operations..."
    tail -f "$LOGS_DIR/polling.log" 2>/dev/null || echo "polling.log not created yet"
    ;;
  "tail-errors")
    echo "❌ Monitoring errors..."
    tail -f "$LOGS_DIR/errors.log" 2>/dev/null || echo "errors.log not created yet"
    ;;
  "tail-startup")
    echo "🚀 Monitoring startup and restart events..."
    tail -f "$LOGS_DIR/startup.log" 2>/dev/null || echo "startup.log not created yet"
    ;;
  "tail-all")
    echo "📊 Monitoring all logs..."
    tail -f "$LOGS_DIR"/*.log 2>/dev/null || echo "No logs created yet"
    ;;
  "grep-write")
    echo "✍️  Searching for write operations..."
    grep -i "write\|set\|send" "$LOGS_DIR"/*.log 2>/dev/null | tail -20 || echo "No logs found yet"
    ;;
  "grep-restart")
    echo "🔄 Searching for restart/deployment events..."
    grep -i "restart\|reinit\|deploy\|stop.*thread\|start.*thread\|initialization" "$LOGS_DIR"/startup.log 2>/dev/null | tail -20 || echo "No startup events found yet"
    ;;
  *)
    echo "🔍 Vista IoT Backend - Log Monitor"
    echo "=================================="
    echo "Usage: $0 {tail-api|tail-polling|tail-errors|tail-startup|tail-all|grep-write|grep-restart}"
    echo ""
    echo "REAL-TIME MONITORING:"
    echo "  ./monitor_logs.sh tail-api      # Watch ALL HTTP requests/responses live"
    echo "  ./monitor_logs.sh tail-polling  # Watch protocol operations (Modbus, DNP3, etc.)"
    echo "  ./monitor_logs.sh tail-errors   # Watch errors only"
    echo "  ./monitor_logs.sh tail-startup  # Watch startup, restarts, and deployments"
    echo "  ./monitor_logs.sh tail-all      # Watch everything"
    echo ""
    echo "HISTORICAL SEARCH:"
    echo "  ./monitor_logs.sh grep-write    # Find all write operations"
    echo "  ./monitor_logs.sh grep-restart  # Find all restart/deployment events"
    echo ""
    echo "TIP: Use Ctrl+C to stop monitoring"
    ;;
esac
