#!/usr/bin/env python3

def decode_dnp3_response():
    """Decode the actual DNP3 response we received"""
    
    # This is the actual response from your Docker DNP3 server
    response_hex = "05640844010000000000810000001e0100000005000100015900014400013600015d0001"
    response = bytes.fromhex(response_hex)
    
    print("Decoding actual DNP3 response from Docker server")
    print("=" * 55)
    print(f"Response: {response_hex}")
    print(f"Length: {len(response)} bytes")
    print()
    
    # Parse DNP3 structure
    print("=== DNP3 Frame Structure ===")
    
    # Start bytes
    start = response[0:2]
    print(f"Start bytes: {start.hex()} ({'Valid' if start == b'\\x05\\x64' else 'Invalid'})")
    
    # Data Link Layer
    dl_length = response[2]
    dl_control = response[3]
    dl_dest = int.from_bytes(response[4:6], 'little')
    dl_src = int.from_bytes(response[6:8], 'little')
    dl_crc = int.from_bytes(response[8:10], 'little')
    
    print(f"Data Link:")
    print(f"  Length: {dl_length}")
    print(f"  Control: 0x{dl_control:02X}")
    print(f"  Dest: {dl_dest}, Src: {dl_src}")
    print(f"  CRC: 0x{dl_crc:04X}")
    
    dl_function = dl_control & 0x0F
    print(f"  Function Code: {dl_function} ({'User Data' if dl_function == 4 else 'Other'})")
    
    # Transport & Application
    if len(response) > 10:
        transport = response[10]
        print(f"Transport: 0x{transport:02X}")
        
        if len(response) > 12:
            app_control = response[11] 
            app_function = response[12]
            print(f"Application:")
            print(f"  Control: 0x{app_control:02X}")
            print(f"  Function: 0x{app_function:02X} ({'Response' if app_function == 0x81 else 'Confirm' if app_function == 0 else 'Other'})")
    
    # The key insight: Look at the actual data payload
    print(f"\\n=== Raw Data Analysis ===")
    
    # Skip DNP3 headers and look for data patterns
    # Data likely starts around byte 13-16
    for start_pos in range(13, min(20, len(response))):
        remaining = response[start_pos:]
        print(f"\\nFrom position {start_pos}: {remaining.hex()}")
        
        # Try to interpret as analog input values (Group 30)
        if len(remaining) >= 6:
            # Check if this looks like Group 30 data
            if remaining[0] == 0x1E:  # 0x1E = 30 = Analog Input Group
                print(f"  ✅ Found Group 30 (Analog Input) at position {start_pos}!")
                
                group = remaining[0]
                variation = remaining[1] if len(remaining) > 1 else 0
                qualifier = remaining[2] if len(remaining) > 2 else 0
                
                print(f"  Group: {group}, Variation: {variation}, Qualifier: 0x{qualifier:02X}")
                
                if qualifier == 0x07:  # Range qualifier
                    start_idx = remaining[3] if len(remaining) > 3 else 0
                    stop_idx = remaining[4] if len(remaining) > 4 else 0
                    print(f"  Range: AI.{start_idx:03d} to AI.{stop_idx:03d}")
                    
                    # Parse data values starting after header
                    data_start = 5
                    values = []
                    
                    for point in range(start_idx, stop_idx + 1):
                        if data_start + 5 <= len(remaining):
                            flags = remaining[data_start]
                            value = int.from_bytes(remaining[data_start+1:data_start+5], 'little')
                            values.append((point, value, flags))
                            print(f"    AI.{point:03d}: {value} (flags: 0x{flags:02X})")
                            data_start += 5
                    
                    if values:
                        print(f"\\n🎯 SUCCESS! Found {len(values)} analog input values:")
                        for point, value, flags in values:
                            if point == 0:
                                print(f"    *** AI.000 = {value} *** (This is your data!)")
                            else:
                                print(f"    AI.{point:03d} = {value}")
                
                break

if __name__ == "__main__":
    decode_dnp3_response()
