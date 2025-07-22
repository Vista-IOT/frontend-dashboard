#!/usr/bin/env python3
"""
Vista IoT Backend Deployment Manager
This script provides better control over process lifecycle management
"""

import os
import sys
import signal
import subprocess
import time
import psutil
import argparse
from pathlib import Path

class DeploymentManager:
    def __init__(self):
        self.script_dir = Path(__file__).parent.absolute()
        self.venv_dir = self.script_dir / "venv"
        self.pidfile = self.script_dir / "vista-backend.pid"
        self.logfile = self.script_dir / "vista-backend.log"
        
    def find_vista_processes(self):
        """Find all Vista backend processes"""
        vista_processes = []
        
        for proc in psutil.process_iter(['pid', 'cmdline', 'cwd']):
            try:
                if proc.info['cmdline']:
                    cmdline = ' '.join(proc.info['cmdline'])
                    # Look for Python processes running run.py from this directory
                    if ('python' in cmdline and 
                        'run.py' in cmdline and 
                        str(self.script_dir) in cmdline):
                        vista_processes.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
                
        return vista_processes
    
    def kill_existing_processes(self):
        """Kill all existing Vista backend processes"""
        print("🔍 Checking for existing Vista Backend processes...")
        
        processes = self.find_vista_processes()
        
        if not processes:
            print("ℹ️  No existing processes found")
            return
            
        print(f"🛑 Found {len(processes)} existing processes. Terminating them...")
        
        # First, try graceful termination
        for proc in processes:
            try:
                print(f"   Terminating process {proc.pid}")
                proc.terminate()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        # Wait for processes to terminate
        gone, still_alive = psutil.wait_procs(processes, timeout=5)
        
        # Force kill any remaining processes
        if still_alive:
            print("🔨 Force killing remaining processes...")
            for proc in still_alive:
                try:
                    print(f"   Force killing process {proc.pid}")
                    proc.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        
        print("✅ All existing processes terminated")
    
    def check_venv(self):
        """Check if virtual environment exists and activate it"""
        if not self.venv_dir.exists():
            print(f"❌ Virtual environment not found at: {self.venv_dir}")
            print("Please create a virtual environment first:")
            print("  python3 -m venv venv")
            print("  source venv/bin/activate")
            print("  pip install -r requirements.txt")
            sys.exit(1)
        
        print(f"✅ Virtual environment found: {self.venv_dir}")
        return self.venv_dir / "bin" / "python"
    
    def install_dependencies(self, python_path):
        """Install dependencies if needed"""
        print("🔍 Checking dependencies...")
        
        try:
            subprocess.run([str(python_path), "-c", "import fastapi"], 
                         check=True, capture_output=True)
        except subprocess.CalledProcessError:
            print("📦 Installing required dependencies...")
            pip_path = self.venv_dir / "bin" / "pip"
            subprocess.run([str(pip_path), "install", "-r", "requirements.txt"], 
                         check=True)
            print("✅ Dependencies installed")
    
    def start_application(self):
        """Start the application"""
        print("🚀 Starting Vista IoT Backend...")
        
        # Remove old PID file if exists
        if self.pidfile.exists():
            self.pidfile.unlink()
        
        python_path = self.check_venv()
        self.install_dependencies(python_path)
        
        print(f"   Starting server on http://0.0.0.0:8000")
        print(f"   Log file: {self.logfile}")
        
        # Start the application
        with open(self.logfile, 'w') as log:
            process = subprocess.Popen(
                ["sudo", str(python_path), "run.py"],
                stdout=log,
                stderr=subprocess.STDOUT,
                cwd=self.script_dir
            )
        
        # Save PID
        self.pidfile.write_text(str(process.pid))
        
        # Wait a moment to check if the process started successfully
        time.sleep(2)
        
        try:
            # Check if process is still running
            process.poll()
            if process.returncode is None:
                print(f"✅ Application started successfully (PID: {process.pid})")
                print(f"📋 Use 'python deploy.py logs' to view logs")
                print(f"🛑 Use 'python deploy.py stop' to stop the application")
            else:
                print("❌ Failed to start application")
                print(f"Check the log file: {self.logfile}")
                sys.exit(1)
        except:
            print("❌ Failed to verify application startup")
            sys.exit(1)
    
    def stop_application(self):
        """Stop the application"""
        print("🛑 Stopping Vista IoT Backend...")
        self.kill_existing_processes()
        
        if self.pidfile.exists():
            self.pidfile.unlink()
        
        print("✅ Application stopped")
    
    def show_status(self):
        """Show application status"""
        print("📊 Vista IoT Backend Status")
        print("=" * 40)
        
        if self.pidfile.exists():
            try:
                pid = int(self.pidfile.read_text().strip())
                if psutil.pid_exists(pid):
                    proc = psutil.Process(pid)
                    print(f"Status: ✅ RUNNING (PID: {pid})")
                    print(f"CPU: {proc.cpu_percent()}%")
                    print(f"Memory: {proc.memory_info().rss / 1024 / 1024:.1f} MB")
                else:
                    print("Status: ❌ NOT RUNNING (stale PID file)")
                    self.pidfile.unlink()
            except (ValueError, psutil.NoSuchProcess):
                print("Status: ❌ NOT RUNNING (invalid PID file)")
                self.pidfile.unlink()
        else:
            print("Status: ❌ NOT RUNNING")
        
        # Show all Vista-related processes
        processes = self.find_vista_processes()
        if processes:
            print("\nRelated processes:")
            for proc in processes:
                try:
                    print(f"  PID {proc.pid}: {' '.join(proc.cmdline())}")
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
    
    def show_logs(self):
        """Show application logs"""
        if not self.logfile.exists():
            print(f"❌ Log file not found: {self.logfile}")
            return
        
        try:
            subprocess.run(["tail", "-f", str(self.logfile)])
        except KeyboardInterrupt:
            print("\n📋 Log viewing stopped")

def main():
    parser = argparse.ArgumentParser(description="Vista IoT Backend Deployment Manager")
    parser.add_argument('command', 
                       choices=['start', 'stop', 'restart', 'status', 'logs', 'deploy'],
                       help='Command to execute')
    
    args = parser.parse_args()
    manager = DeploymentManager()
    
    try:
        if args.command in ['start', 'deploy']:
            manager.kill_existing_processes()
            manager.start_application()
        elif args.command == 'stop':
            manager.stop_application()
        elif args.command == 'restart':
            manager.stop_application()
            time.sleep(1)
            manager.start_application()
        elif args.command == 'status':
            manager.show_status()
        elif args.command == 'logs':
            manager.show_logs()
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
