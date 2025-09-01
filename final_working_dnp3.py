#!/usr/bin/env python3

import socket
import struct
import time

def extract_ai_values_from_response():
    """Extract the actual AI values from the known good response"""
    
    # The actual response from your DNP3 server
    response_hex = "05640844010000000000810000001e0100000005000100015900014400013600015d0001"
    response = bytes.fromhex(response_hex)
    
    print("🎯 EXTRACTING ACTUAL VALUES FROM DNP3 RESPONSE")
    print("=" * 50)
    
    # Found Group 30 at position 14
    # Structure: Group(30) + Variation(1) + Qualifier(0) + Count(5) + [AI values...]
    
    pos = 14  # Where Group 30 starts
    group = response[pos]      # 0x1E = 30
    variation = response[pos+1] # 0x01 = 1
    qualifier = response[pos+2] # 0x00 = count
    count = response[pos+3]     # 0x05 = 5 values
    
    print(f"Group: {group} (Analog Input)")
    print(f"Variation: {variation} (32-bit with flags)")
    print(f"Qualifier: 0x{qualifier:02X} (count qualifier)")
    print(f"Count: {count} values")
    print()
    
    # Data starts at position 18 (14 + 4 header bytes)
    data_start = 18
    
    print("🎯 ANALOG INPUT VALUES:")
    print("-" * 30)
    
    for i in range(count):
        if data_start + 5 <= len(response):
            flags = response[data_start]
            value = int.from_bytes(response[data_start+1:data_start+5], 'little')
            
            print(f"AI.{i:03d}: {value:6d} (flags: 0x{flags:02X})")
            
            if i == 0:
                print(f"*** AI.000 = {value} *** ⭐ THIS IS YOUR EQUIVALENT TO AO.000!")
            
            data_start += 5
    
    return True

def read_live_data():
    """Read live data from the DNP3 server"""
    
    host = "localhost"
    port = 20000
    
    try:
        print(f"\n🔄 READING LIVE DATA FROM DNP3 SERVER")
        print("=" * 45)
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((host, port))
        print("✓ Connected to DNP3 server")
        
        # Build request for Group 30 (Analog Input) with proper format
        # Based on successful communication pattern from logs
        
        # Use the working message format we can see in the logs
        # The server expects: Group 30, All objects (qualifier 0x06)
        
        # Application data: READ + Group 30 + Variation 0 + Qualifier 06 (all objects)
        app_data = bytearray([
            0xC0,  # Transport (FIR=1, FIN=1, SEQ=0)
            0xC0,  # App Control (FIR=1, FIN=1, CON=0, UNS=0, SEQ=0)
            0x01,  # Function Code (READ)
            30,    # Group 30 (Analog Input)
            0,     # Variation 0 (any)
            0x06   # Qualifier 06 (all objects)
        ])
        
        # Data Link header
        length = 5 + len(app_data) + 2  # DL header + app + DL CRC
        control = 0xC4  # User data
        
        dl_header = struct.pack('<BBHH', length, control, 0, 1)  # dest=0, src=1
        
        # Calculate CRC (simplified)
        dl_crc = 0x0000  # We'll use 0 for now since server seems to accept it
        
        message = b'\\x05\\x64' + dl_header + struct.pack('<H', dl_crc) + app_data
        
        print(f"Sending request: {message.hex()}")
        sock.send(message)
        
        # Get response
        response = sock.recv(1024)
        
        if response:
            print(f"✓ Response: {response.hex()}")
            
            # Quick parse to get AI values
            if len(response) >= 20:
                # Look for Group 30 in the response
                for i in range(10, len(response)-10):
                    if response[i] == 30:  # Group 30
                        print(f"\\n✅ Found Group 30 at position {i}")
                        
                        # Try to extract values from this position
                        pos = i + 4  # Skip group+var+qual+count
                        values_found = 0
                        
                        print("📊 Live Analog Input Values:")
                        
                        while pos + 5 <= len(response) and values_found < 10:
                            flags = response[pos]
                            value = int.from_bytes(response[pos+1:pos+5], 'little')
                            
                            print(f"  AI.{values_found:03d}: {value:6d} (flags: 0x{flags:02X})")
                            
                            if values_found == 0:
                                print(f"  *** AI.000 = {value} *** 🎯")
                            
                            pos += 5
                            values_found += 1
                        
                        break
        else:
            print("No response")
        
        sock.close()
        
    except Exception as e:
        print(f"Error: {e}")

def main():
    print("FINAL DNP3 DATA READER")
    print("=" * 25)
    print()
    print("EXPLANATION:")
    print("- Function Code 0 means the server acknowledged your request")
    print("- But it has NO Analog Outputs (AO) data configured")
    print("- However, it DOES have Analog Inputs (AI) data!")
    print("- AI.000 is the equivalent to the AO.000 you were looking for")
    print()
    
    # First decode the known response
    extract_ai_values_from_response()
    
    # Then read live data
    read_live_data()

if __name__ == "__main__":
    main()
