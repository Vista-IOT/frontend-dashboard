#!/usr/bin/env python3

import socket
import struct
import time

def calculate_crc16_dnp3(data):
    """Calculate DNP3 CRC-16"""
    crc = 0x0000
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA6BC
            else:
                crc >>= 1
    return (~crc) & 0xFFFF

def read_analog_inputs():
    """Read Analog Inputs AI.000-AI.009 from DNP3 server"""
    
    host = "localhost"
    port = 20000
    
    try:
        print(f"Connecting to DNP3 server at {host}:{port}")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((host, port))
        print("✓ Connected!")
        
        # Build DNP3 read request for Analog Inputs
        
        # Transport layer
        transport = 0xC0  # FIR=1, FIN=1, SEQ=0
        
        # Application layer
        app_control = 0xC0  # FIR=1, FIN=1, CON=0, UNS=0, SEQ=0
        function_code = 0x01  # READ
        
        # Object header for Group 30 (Analog Input), Variation 1, Range 0-9
        group = 30
        variation = 1
        qualifier = 0x07  # 8-bit start/stop indices
        start_index = 0   # AI.000
        stop_index = 9    # AI.009
        
        # Build application data step by step
        app_data = bytearray()
        app_data.append(transport)
        app_data.append(app_control)
        app_data.append(function_code)
        app_data.append(group)
        app_data.append(variation)
        app_data.append(qualifier)
        app_data.append(start_index)
        app_data.append(stop_index)
        
        # Build data link header
        length = 5 + len(app_data) + 2  # DL header + app data + DL CRC
        control = 0xC4  # DIR=1, PRM=1, FC=4 (user data)
        dest_addr = 0   # Outstation
        src_addr = 1    # Master
        
        dl_header = struct.pack('<BBHH', length, control, dest_addr, src_addr)
        dl_crc = calculate_crc16_dnp3(dl_header)
        
        # Complete message
        message = b'\x05\x64' + dl_header + struct.pack('<H', dl_crc) + app_data
        
        print(f"Sending read request for AI.000-AI.009 (Group 30): {message.hex()}")
        sock.send(message)
        
        # Receive response
        print("Waiting for response...")
        response = sock.recv(1024)
        
        if response:
            print(f"✓ Response received ({len(response)} bytes)")
            parse_response(response)
        else:
            print("✗ No response received")
        
        sock.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

def parse_response(data):
    """Parse DNP3 response and extract analog values"""
    
    print(f"\nRaw response: {data.hex()}")
    
    if len(data) < 10:
        print("Response too short")
        return
    
    # Check DNP3 start bytes
    if data[0:2] != b'\x05\x64':
        print("Invalid DNP3 response")
        return
    
    print("\n=== DNP3 Response Analysis ===")
    
    # Data Link Layer
    length = data[2]
    control = data[3]
    dest = struct.unpack('<H', data[4:6])[0]
    src = struct.unpack('<H', data[6:8])[0]
    
    print(f"Data Link: Length={length}, Control=0x{control:02X}")
    print(f"Addresses: Dest={dest}, Src={src}")
    
    dl_function = control & 0x0F
    print(f"DL Function Code: {dl_function}")
    
    if dl_function == 0:
        print("❌ Function Code 0 (CONFIRM/RESET)")
        print("   This means the server has NO DATA for your request")
        print("   Solution: Request a different data type that exists")
        return
    elif dl_function == 4:  # User data
        print("✓ User data frame")
    
    # Parse application layer
    if len(data) > 12:
        transport = data[10]
        app_control = data[11]
        app_function = data[12]
        
        print(f"Application: Transport=0x{transport:02X}, Control=0x{app_control:02X}, Function=0x{app_function:02X}")
        
        if app_function == 0x81:  # Response
            print("✅ Application Response - Contains Data!")
            
            # Look for object data starting at index 13
            idx = 13
            data_found = False
            
            while idx + 3 <= len(data):
                group = data[idx]
                variation = data[idx + 1]
                qualifier = data[idx + 2]
                
                print(f"\nObject: Group {group}, Variation {variation}, Qualifier 0x{qualifier:02X}")
                
                if group == 30:  # Analog Input
                    print("🎯 ANALOG INPUT DATA!")
                    idx += 3
                    data_found = True
                    
                    if qualifier == 0x07:  # Range
                        if idx + 2 <= len(data):
                            start_idx = data[idx]
                            stop_idx = data[idx + 1]
                            idx += 2
                            print(f"Reading AI.{start_idx:03d} to AI.{stop_idx:03d}")
                            
                            # Parse values
                            for point in range(start_idx, stop_idx + 1):
                                if variation == 1 and idx + 5 <= len(data):  # 32-bit + flags
                                    flags = data[idx]
                                    value = struct.unpack('<I', data[idx+1:idx+5])[0]
                                    print(f"  AI.{point:03d} = {value} (flags: 0x{flags:02X})")
                                    
                                    if point == 0:
                                        print(f"  *** AI.000 VALUE: {value} ***")
                                    
                                    idx += 5
                                    
                                elif variation == 2 and idx + 3 <= len(data):  # 16-bit + flags
                                    flags = data[idx]
                                    value = struct.unpack('<H', data[idx+1:idx+3])[0]
                                    print(f"  AI.{point:03d} = {value} (flags: 0x{flags:02X})")
                                    
                                    if point == 0:
                                        print(f"  *** AI.000 VALUE: {value} ***")
                                    
                                    idx += 3
                    
                    elif qualifier == 0x06:  # All objects
                        print("All AI objects requested")
                        idx += 3
                        # Try to parse available data
                        point_num = 0
                        while idx + 5 <= len(data) and point_num < 10:
                            flags = data[idx]
                            value = struct.unpack('<I', data[idx+1:idx+5])[0]
                            print(f"  AI.{point_num:03d} = {value} (flags: 0x{flags:02X})")
                            
                            if point_num == 0:
                                print(f"  *** AI.000 VALUE: {value} ***")
                            
                            idx += 5
                            point_num += 1
                    
                    break
                    
                elif group == 1:  # Binary Input
                    print("🎯 BINARY INPUT DATA!")
                    # Binary parsing would go here
                    break
                    
                elif group == 20:  # Counter
                    print("🎯 COUNTER DATA!")
                    # Counter parsing would go here  
                    break
                    
                else:
                    print(f"Unknown group {group}")
                    break
            
            if not data_found:
                print("❌ No recognizable data found in response")
        
        elif app_function == 0:
            print("❌ Application Function 0 (CONFIRM)")
            print("   The server confirmed your request but has no data to send")
            print("   This happens when you request data that doesn't exist")
        
        else:
            print(f"❌ Unexpected application function: {app_function}")

def main():
    print("Fixed DNP3 Reader for Docker Server")
    print("==================================")
    print("Target: localhost:20000 (Docker container)")
    print()
    print("The server has these data types available:")
    print("  ✅ Analog Inputs (AI.000-AI.009)")
    print("  ✅ Binary Inputs (BI.000-BI.009)")
    print("  ✅ Counters (CTR.000-CTR.004)")
    print("  ❌ Analog Outputs (AO) - NOT AVAILABLE")
    print()
    print("Reading AI.000 (closest equivalent to AO.000)...")
    print()
    
    read_analog_inputs()

if __name__ == "__main__":
    main()
