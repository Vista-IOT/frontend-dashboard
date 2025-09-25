import json
import os
import threading
from app.logging_config import get_polling_logger

polling_logger = get_polling_logger()

# Persistent storage for last successful timestamps
LAST_SUCCESSFUL_TIMESTAMPS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "last_successful_timestamps.json"
)

_last_successful_timestamps: dict = {}
_last_successful_timestamps_lock = threading.Lock()

def load_last_successful_timestamps() -> None:
    """Load last successful timestamps from persistent storage."""
    global _last_successful_timestamps
    try:
        os.makedirs(os.path.dirname(LAST_SUCCESSFUL_TIMESTAMPS_FILE), exist_ok=True)
        if os.path.exists(LAST_SUCCESSFUL_TIMESTAMPS_FILE):
            with open(LAST_SUCCESSFUL_TIMESTAMPS_FILE, "r") as f:
                _last_successful_timestamps = json.load(f)
            polling_logger.info(
                f"Loaded last successful timestamps for {len(_last_successful_timestamps)} devices"
            )
        else:
            _last_successful_timestamps = {}
            polling_logger.info("No existing timestamp file found, starting fresh")
    except Exception as e:
        polling_logger.error(f"Error loading last successful timestamps: {e}")
        _last_successful_timestamps = {}

def save_last_successful_timestamps() -> None:
    """Save last successful timestamps to persistent storage."""
    try:
        os.makedirs(os.path.dirname(LAST_SUCCESSFUL_TIMESTAMPS_FILE), exist_ok=True)
        with _last_successful_timestamps_lock:
            with open(LAST_SUCCESSFUL_TIMESTAMPS_FILE, "w") as f:
                json.dump(_last_successful_timestamps, f, indent=2)
    except Exception as e:
        polling_logger.error(f"Error saving last successful timestamps: {e}")

def update_last_successful_timestamp(device_name: str, tag_id: str, timestamp: int) -> None:
    """Update and persist the last successful timestamp for a tag."""
    with _last_successful_timestamps_lock:
        if device_name not in _last_successful_timestamps:
            _last_successful_timestamps[device_name] = {}
        _last_successful_timestamps[device_name][tag_id] = timestamp
    # Persist in background to avoid blocking polling threads
    threading.Thread(target=save_last_successful_timestamps, daemon=True).start()

def get_last_successful_timestamp(device_name: str, tag_id: str):
    """Retrieve the last successful timestamp for a tag, or None if unknown."""
    with _last_successful_timestamps_lock:
        return _last_successful_timestamps.get(device_name, {}).get(tag_id, None)
