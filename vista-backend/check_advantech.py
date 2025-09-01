#!/usr/bin/env python3
"""
Simple script to check Advantech EdgeLink connectivity and DNP3 port
"""

import socket
import sys
import subprocess

def check_ping(ip_address: str) -> bool:
    """Check if device responds to ping"""
    try:
        result = subprocess.run(['ping', '-c', '1', '-W', '3', ip_address], 
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def check_tcp_port(ip_address: str, port: int) -> bool:
    """Check if TCP port is open"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((ip_address, port))
        sock.close()
        return result == 0
    except:
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python check_advantech.py <ip_address> [port]")
        print("Example: python check_advantech.py 192.168.1.100")
        sys.exit(1)
    
    ip_address = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 20000
    
    print(f"Checking Advantech EdgeLink device at {ip_address}:{port}")
    print("-" * 60)
    
    # Check ping
    print("1. Testing ping connectivity...")
    if check_ping(ip_address):
        print("   ✅ Device responds to ping")
    else:
        print("   ❌ Device does not respond to ping")
        print("   💡 Check network connectivity and device IP address")
        return False
    
    # Check TCP port
    print(f"\\n2. Testing TCP port {port}...")
    if check_tcp_port(ip_address, port):
        print(f"   ✅ Port {port} is open and accepting connections")
    else:
        print(f"   ❌ Port {port} is not accessible")
        print("   💡 Check:")
        print("      - DNP3 service is enabled on the device")
        print("      - Correct port number (usually 20000 for DNP3)")
        print("      - Firewall settings")
        return False
    
    print(f"\\n✅ Basic connectivity looks good!")
    print(f"Now you can test the actual DNP3 communication.")
    return True

if __name__ == "__main__":
    main()
