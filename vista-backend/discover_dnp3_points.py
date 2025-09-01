#!/usr/bin/env python3
"""
DNP3 Point Discovery Tool for Advantech EdgeLink devices
This script scans for available DNP3 points on the device
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

def create_read_request(local_addr, remote_addr, group, variation, index, sequence=1):
    """Create DNP3 read request"""
    
    # Application layer
    app_control = 0xC0 | sequence
    function_code = 0x01  # READ
    
    app_data = struct.pack('<BB', app_control, function_code)
    app_data += struct.pack('<BBB', group, variation, 0x17)  # 8-bit index, 8-bit quantity
    app_data += struct.pack('<BB', index, 1)
    
    # Data link header
    total_length = 5 + len(app_data)
    control = 0xC4  # Unconfirmed user data
    
    header = struct.pack('<BBBBBBBB',
        0x05, 0x64,
        total_length,
        control,
        remote_addr & 0xFF,
        (remote_addr >> 8) & 0xFF,
        local_addr & 0xFF,
        (local_addr >> 8) & 0xFF
    )
    
    header_crc = calculate_crc(header[2:8])
    app_crc = calculate_crc(app_data)
    
    frame = header + struct.pack('<H', header_crc) + app_data + struct.pack('<H', app_crc)
    return frame

def discover_points(ip_address, port=20000, local_addr=1, remote_addr=4):
    """Discover available DNP3 points on Advantech device"""
    
    print(f"🔍 Discovering DNP3 points on Advantech device {ip_address}:{port}")
    print(f"Local: {local_addr}, Remote: {remote_addr}")
    print("=" * 80)
    
    found_points = []
    
    # Point types to test
    point_tests = [
        (30, [1, 2, 3, 4], "AI", "Analog Input"),
        (1, [1, 2], "BI", "Binary Input"),
        (20, [1, 2], "CTR", "Counter"),
        (3, [1, 2], "DBI", "Double-bit Input")
    ]
    
    for group, variations, type_name, description in point_tests:
        print(f"\n🔍 Testing {description} ({type_name}) - Group {group}")
        
        # Test indices 0-10
        for index in range(11):
            for variation in variations:
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(2)
                    sock.connect((ip_address, port))
                    
                    request = create_read_request(local_addr, remote_addr, group, variation, index)
                    sock.send(request)
                    
                    response = sock.recv(1024)
                    sock.close()
                    
                    if response:
                        # Check response type
                        if len(response) >= 10:
                            control = response[3]
                            
                            if control == 0x49:  # Link status response
                                print(f"   {type_name}.{index:03d} (var {variation}): Link status (point may not exist)")
                            elif len(response) >= 12 and response[11] == 0x81:  # Data response
                                print(f"   ✅ {type_name}.{index:03d} (var {variation}): DATA RESPONSE FOUND!")
                                found_points.append({
                                    'address': f'{type_name},{index:03d}',
                                    'group': group,
                                    'variation': variation,
                                    'response': response.hex()
                                })
                            else:
                                print(f"   {type_name}.{index:03d} (var {variation}): Unknown response ({response.hex()[:20]}...)")
                        
                except socket.timeout:
                    pass  # Silent timeout
                except Exception as e:
                    if "Connection refused" in str(e):
                        print(f"   ❌ Connection refused - device may be blocking requests")
                        time.sleep(1)  # Wait before continuing
                    else:
                        print(f"   ❌ Error testing {type_name}.{index:03d}: {e}")
                
                time.sleep(0.1)  # Small delay between requests
    
    print(f"\n{'='*80}")
    print(f"DISCOVERY RESULTS:")
    print(f"Found {len(found_points)} responding points:")
    
    if found_points:
        for point in found_points:
            print(f"✅ {point['address']} - Group {point['group']} Variation {point['variation']}")
        
        print(f"\n💡 RECOMMENDATIONS:")
        print(f"Use these addresses in your tag configuration:")
        for point in found_points:
            print(f"   - {point['address']}")
            
    else:
        print(f"❌ No responding points found.")
        print(f"\n💡 TROUBLESHOOTING:")
        print(f"1. Check if DNP3 points are properly configured on the Advantech device")
        print(f"2. Verify the local/remote addresses match the device configuration")
        print(f"3. Ensure the device is configured as a DNP3 outstation")
        print(f"4. Check if different variations or addressing schemes are needed")
    
    print(f"{'='*80}")
    return found_points

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python discover_dnp3_points.py <ip_address> [port] [local_addr] [remote_addr]")
        print("Example: python discover_dnp3_points.py 10.0.0.1")
        sys.exit(1)
    
    ip = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 20000
    local = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    remote = int(sys.argv[4]) if len(sys.argv) > 4 else 4
    
    try:
        discover_points(ip, port, local, remote)
    except KeyboardInterrupt:
        print("\n\nDiscovery interrupted by user.")
    except Exception as e:
        print(f"Discovery failed: {e}")
