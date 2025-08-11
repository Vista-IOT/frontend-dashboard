#!/usr/bin/env python3
import os
import sys
import threading
import time
import signal
from pathlib import Path
import logging

# Global registry of active polling threads
_active_threads = {}
_threads_lock = threading.Lock()

logger = logging.getLogger(__name__)

class GatewayManager:
    """Manages protocol service threads for proper lifecycle management"""
    
    def __init__(self):
        self.script_dir = Path(__file__).parent.absolute()
        self.pid_dir = self.script_dir / "pids"
        self.log_dir = self.script_dir / "logs"
        self.pid_dir.mkdir(exist_ok=True)
        self.log_dir.mkdir(exist_ok=True)
    
    def stop_all_polling_threads(self):
        """Stop all active polling threads gracefully"""
        with _threads_lock:
            logger.info(f"Stopping {len(_active_threads)} active polling threads...")
            stopped_count = 0
            for thread_name, thread in list(_active_threads.items()):
                if thread.is_alive():
                    logger.info(f"Stopping polling thread: {thread_name}")
                    # Set a stop flag for graceful shutdown
                    # This requires modifying the polling functions to check this flag
                    thread._stop_requested = True
                    stopped_count += 1
                else:
                    logger.debug(f"Thread {thread_name} already stopped")
                # Remove from active threads registry
                del _active_threads[thread_name]
            
            logger.info(f"Requested stop for {stopped_count} polling threads")
            return stopped_count
    
    def start_polling_thread(self, thread_name, target_func, args):
        """Start a polling thread and register it for management"""
        with _threads_lock:
            # Stop existing thread with same name if running
            if thread_name in _active_threads:
                existing_thread = _active_threads[thread_name]
                if existing_thread.is_alive():
                    logger.info(f"Stopping existing thread: {thread_name}")
                    existing_thread._stop_requested = True
                    # Give it a moment to stop
                    time.sleep(0.5)
                del _active_threads[thread_name]
            
            # Create and start new thread
            logger.info(f"Starting new polling thread: {thread_name}")
            thread = threading.Thread(target=target_func, args=args, daemon=True, name=thread_name)
            thread._stop_requested = False
            thread.start()
            
            # Register the thread
            _active_threads[thread_name] = thread
            return thread
    
    def get_active_threads_status(self):
        """Get status of all active threads"""
        with _threads_lock:
            status = {}
            for thread_name, thread in _active_threads.items():
                status[thread_name] = {
                    "is_alive": thread.is_alive(),
                    "daemon": thread.daemon,
                    "stop_requested": getattr(thread, '_stop_requested', False)
                }
            return status

# Global gateway manager instance
gateway_manager = GatewayManager()

