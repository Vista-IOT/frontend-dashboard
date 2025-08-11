# Protocol Deployment Fix for Radxa Cubic v1.2

## Problem
The original issue was that Modbus RTU, Modbus TCP/IP, and SNMP configurations work individually but not together when deployed via the frontend's "Deploy & Configure" feature. The hot-deploy functionality wasn't properly stopping existing protocol threads before starting new ones, leading to resource conflicts and protocol locking issues.

## Solution
Implemented a unified gateway manager system that ensures clean protocol lifecycle management:

### Key Components

1. **Gateway Manager (`gateway_manager.py`)**
   - Centralized thread management for all protocol services
   - Tracks active polling threads in a global registry
   - Provides graceful shutdown functionality
   - Ensures old threads are stopped before new ones start

2. **Enhanced Polling Service (`app/services/polling_service.py`)**
   - Modified to use the gateway manager for thread lifecycle
   - Added graceful shutdown checks to all polling loops (TCP, RTU, SNMP)
   - Automatic cleanup of existing threads before starting new configuration

3. **Updated Deployment API (`app/routers/deploy.py`)**
   - Modified `/deploy/config` endpoint to perform full clean restart
   - Automatically stops all polling threads before backend restart
   - Fallback to in-process reinitialization if deployment script fails

### How It Works

When you click "Deploy & Configure" in the frontend:

1. **Configuration Save**: New config is saved to `config/deployed_config.yaml`
2. **Thread Cleanup**: All existing polling threads are gracefully stopped
3. **Clean Restart**: The entire backend process is restarted for a completely clean state
4. **New Protocol Start**: Fresh polling threads are started with the new configuration

### Benefits

- **No Resource Conflicts**: Old polling threads are properly stopped before new ones start
- **Protocol Compatibility**: All protocols (Modbus RTU, TCP, SNMP) can now work together
- **Graceful Shutdown**: Polling threads check for stop requests and exit cleanly
- **Automatic Management**: The entire process is transparent to the user
- **Fallback Safety**: If full restart fails, falls back to in-process reinitialization

### Usage

The solution is completely automatic. Users simply:
1. Configure their protocols in the frontend
2. Click "Deploy & Configure"  
3. The system automatically handles clean restart of all services

No manual intervention or additional endpoints are needed. The deployment process now ensures a clean state every time, preventing the resource conflicts that were causing protocols to fail when used together.
