"""
Logs Router - Provides endpoints to fetch logs from different services
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import os
from pathlib import Path

router = APIRouter(prefix="/api/logs", tags=["logs"])

# Define log file paths
LOG_PATHS = {
    "backend": Path(__file__).parent.parent.parent / "logs" / "backend.log",
    "dataservice": Path(__file__).parent.parent.parent.parent / "Data-Service" / "logs" / "dataservice.log",
    "frontend": Path(__file__).parent.parent.parent.parent / "frontend.logs",
}

def read_log_file(log_path: Path, lines: int = 1000) -> list:
    """
    Read the last N lines from a log file
    
    Args:
        log_path: Path to the log file
        lines: Number of lines to read from the end (default: 1000)
    
    Returns:
        List of log lines
    """
    try:
        if not log_path.exists():
            return [f"Log file not found: {log_path}"]
        
        # Read the file and get the last N lines
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            all_lines = f.readlines()
            last_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            # Strip newlines but keep the content
            return [line.rstrip('\n\r') for line in last_lines if line.strip()]
    except Exception as e:
        return [f"Error reading log file: {str(e)}"]

@router.get("/{log_type}")
async def get_logs(log_type: str, lines: int = 1000):
    """
    Get logs for a specific service
    
    Args:
        log_type: Type of log to fetch (backend, dataservice, frontend)
        lines: Number of lines to fetch from the end (default: 1000)
    
    Returns:
        JSON response with logs content
    """
    if log_type not in LOG_PATHS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid log type. Must be one of: {', '.join(LOG_PATHS.keys())}"
        )
    
    log_path = LOG_PATHS[log_type]
    logs_content = read_log_file(log_path, lines)
    
    return JSONResponse(content={
        "log_type": log_type,
        "log_path": str(log_path),
        "logs": logs_content,
        "lines_requested": lines
    })

@router.get("/")
async def list_available_logs():
    """
    List all available log types and their paths
    
    Returns:
        JSON response with available log types
    """
    available_logs = {}
    for log_type, log_path in LOG_PATHS.items():
        available_logs[log_type] = {
            "path": str(log_path),
            "exists": log_path.exists(),
            "size": log_path.stat().st_size if log_path.exists() else 0
        }
    
    return JSONResponse(content={
        "available_logs": available_logs
    })
