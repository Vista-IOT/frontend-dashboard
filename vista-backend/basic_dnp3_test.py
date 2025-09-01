#!/usr/bin/env python3
"""
Basic DNP3 test with minimal frames to diagnose Advantech EdgeLink issues
"""

import socket
import struct
import time
import sys

def calculate_crc(data: bytes) -> int:
    """Calculate DNP3 CRC-16"""
    crc = 0x0000
    for byte in data:
        crc = crc ^ byte
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ 0xA6BC
            else:
                crc = crc >> 1
    return crc & 0xFFFF

def send_link_status_request(sock, local_addr, remote_addr):
    """Send a simple link status request"""
    print("Sending link status request...")
    
    # Build data link status request frame
    control = 0x49  # Request link status
    header = struct.pack('<BBBBBBBB',
        0x05, 0x64,  # Start bytes
        0x05,        # Length
        control,     # Control field
        remote_addr & 0xFF,  # Destination low
        (remote_addr >> 8) & 0xFF,  # Destination high
        local_addr & 0xFF,   # Source low
        (local_addr >> 8) & 0xFF    # Source high
    )
    
    crc = calculate_crc(header[2:8])
    frame = header + struct.pack('<H', crc)
    
    print(f"TX: {frame.hex().upper()}")
    sock.send(frame)
    
    try:
        response = sock.recv(1024)
        print(f"RX: {response.hex().upper() if response else 'No response'}")
        return len(response) > 0
    except socket.timeout:
        print("RX: Timeout")
        return False

def send_reset_link(sock, local_addr, remote_addr):
    """Send a link reset"""
    print("Sending link reset...")
    
    control = 0x40  # Reset link states
    header = struct.pack('<BBBBBBBB',
        0x05, 0x64,  # Start bytes
        0x05,        # Length
        control,     # Control field
        remote_addr & 0xFF,  # Destination low
        (remote_addr >> 8) & 0xFF,  # Destination high
        local_addr & 0xFF,   # Source low
        (local_addr >> 8) & 0xFF    # Source high
    )
    
    crc = calculate_crc(header[2:8])
    frame = header + struct.pack('<H', crc)
    
    print(f"TX: {frame.hex().upper()}")
    sock.send(frame)
    
    try:
        response = sock.recv(1024)
        print(f"RX: {response.hex().upper() if response else 'No response'}")
        return len(response) > 0
    except socket.timeout:
        print("RX: Timeout")
        return False

def send_simple_read(sock, local_addr, remote_addr, group, variation, index):
    """Send a simple read request"""
    print(f"Sending read request for group {group}, variation {variation}, index {index}...")
    
    # Application layer
    app_control = 0xC1  # First/Final + sequence 1
    function_code = 0x01  # READ
    
    # Object header - use 8-bit index format
    app_data = struct.pack('<BB', app_control, function_code)
    app_data += struct.pack('<BBB', group, variation, 0x17)  # 8-bit index, 8-bit quantity
    app_data += struct.pack('<BB', index, 1)  # Index 0, quantity 1
    
    # Data link header
    total_length = 5 + len(app_data)
    control = 0xC4  # Unconfirmed user data
    header = struct.pack('<BBBBBBBB',
        0x05, 0x64,  # Start bytes
        total_length,  # Length
        control,     # Control field
        remote_addr & 0xFF,  # Destination low
        (remote_addr >> 8) & 0xFF,  # Destination high
        local_addr & 0xFF,   # Source low
        (local_addr >> 8) & 0xFF    # Source high
    )
    
    header_crc = calculate_crc(header[2:8])
    app_crc = calculate_crc(app_data)
    
    frame = header + struct.pack('<H', header_crc) + app_data + struct.pack('<H', app_crc)
    
    print(f"TX: {frame.hex().upper()}")
    sock.send(frame)
    
    try:
        response = sock.recv(1024)
        print(f"RX: {response.hex().upper() if response else 'No response'}")
        return response
    except socket.timeout:
        print("RX: Timeout")
        return None

def test_basic_dnp3(ip_address, port=20000, local_addr=1, remote_addr=4):
    """Test basic DNP3 communication"""
    
    print(f"=== Basic DNP3 Test ===")
    print(f"Target: {ip_address}:{port}")
    print(f"Local: {local_addr}, Remote: {remote_addr}")
    print()
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)  # 10 second timeout
        sock.connect((ip_address, port))
        print("✅ TCP connection established")
        
        # Test 1: Link status request
        print("\n--- Test 1: Link Status ---")
        if send_link_status_request(sock, local_addr, remote_addr):
            print("✅ Device responded to link status")
        else:
            print("❌ No response to link status")
        
        time.sleep(1)
        
        # Test 2: Link reset
        print("\n--- Test 2: Link Reset ---")
        if send_reset_link(sock, local_addr, remote_addr):
            print("✅ Device responded to link reset")
        else:
            print("❌ No response to link reset")
        
        time.sleep(1)
        
        # Test 3: Try different read requests
        print("\n--- Test 3: Read Requests ---")
        
        test_cases = [
            (30, 1, 0, "AI.0 - 32-bit with flags"),
            (30, 2, 0, "AI.0 - 16-bit with flags"),
            (30, 3, 0, "AI.0 - 32-bit no flags"),
            (30, 4, 0, "AI.0 - 16-bit no flags"),
            (1, 1, 0, "BI.0 - with flags"),
            (1, 2, 0, "BI.0 - with time"),
        ]
        
        responses = 0
        for group, variation, index, desc in test_cases:
            print(f"\nTrying {desc}:")
            response = send_simple_read(sock, local_addr, remote_addr, group, variation, index)
            if response:
                responses += 1
            time.sleep(0.5)
        
        print(f"\n--- Summary ---")
        print(f"Responses: {responses}/{len(test_cases)}")
        
        sock.close()
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    return responses > 0

if __name__ == '__main__':
    ip = sys.argv[1] if len(sys.argv) > 1 else '10.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 20000
    local = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    remote = int(sys.argv[4]) if len(sys.argv) > 4 else 4
    
    test_basic_dnp3(ip, port, local, remote)
