#!/usr/bin/env python3
"""
Wrapper for deploy.py that logs all output to startup.log
"""
import sys
import subprocess
import logging
from pathlib import Path

# Setup logging to startup.log
def setup_deployment_logger():
    logger = logging.getLogger('vista.deployment')
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        script_dir = Path(__file__).parent.absolute()
        log_file = script_dir / "logs" / "startup.log"
        log_file.parent.mkdir(exist_ok=True)
        
        handler = logging.FileHandler(log_file)
        formatter = logging.Formatter('%(asctime)s | %(levelname)-8s | %(name)-25s | %(funcName)-15s :%(lineno)-4d | %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger

def main():
    logger = setup_deployment_logger()
    
    # Log the deployment start
    logger.info("🚀 " + "="*50)
    logger.info("🚀 DEPLOYMENT SCRIPT EXECUTION STARTED")
    logger.info("🚀 " + "="*50)
    logger.info(f"📋 Command: python3 deploy.py {' '.join(sys.argv[1:])}")
    
    # Run the actual deployment script and capture output
    result = subprocess.run(
        [sys.executable, "deploy.py"] + sys.argv[1:],
        capture_output=True,
        text=True
    )
    
    # Log stdout
    if result.stdout:
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                logger.info(f"📋 {line.strip()}")
    
    # Log stderr
    if result.stderr:
        for line in result.stderr.strip().split('\n'):
            if line.strip():
                logger.error(f"❌ {line.strip()}")
    
    # Log completion
    logger.info("🏁 " + "="*50)
    logger.info(f"🏁 DEPLOYMENT SCRIPT COMPLETED (Exit Code: {result.returncode})")
    logger.info("🏁 " + "="*50)
    
    # Also print to console
    if result.stdout:
        print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, end='', file=sys.stderr)
    
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
