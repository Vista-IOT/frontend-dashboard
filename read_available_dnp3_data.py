#!/usr/bin/env python3

import socket
import struct
import time

class DNP3Client:
    def __init__(self, host="localhost", port=20000):
        self.host = host
        self.port = port
        self.app_seq = 0
        
    def calculate_crc16_dnp3(self, data):
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
    
    def read_analog_inputs(self):
        """Read Analog Inputs (AI.000-AI.009) - this is what's actually available"""
        
        try:
            print(f"Connecting to DNP3 server at {self.host}:{self.port}")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            sock.connect((self.host, self.port))
            print("✓ Connected!")
            
            # Create read request for Group 30 (Analog Input)
            # Group 30, Variation 1 (32-bit with flags), Range 0-9
            
            # Transport layer
            transport = 0xC0  # FIR=1, FIN=1, SEQ=0
            
            # Application layer  
            app_control = 0xC0  # FIR=1, FIN=1, CON=0, UNS=0, SEQ=0
            function_code = 0x01  # READ
            
            # Object header: Group 30 (Analog Input), Variation 1 (32-bit), Qualifier 07 (range)
            group = 30
            variation = 1  
            qualifier = 0x07  # 8-bit start/stop
            start_index = 0   # AI.000
            stop_index = 9    # AI.009
            
            # Build application data
            app_data = struct.pack('<BBBBBBB', 
                                 transport, app_control, function_code,
                                 group, variation, qualifier, 
                                 start_index, stop_index)
            
            # Build data link header
            length = 5 + len(app_data) + 2  # DL header(5) + app_data + DL_CRC(2)
            control = 0xC4  # DIR=1, PRM=1, FC=4 (user data)
            dest_addr = 0   # Outstation
            src_addr = 1    # Master
            
            dl_header = struct.pack('<BBHH', length, control, dest_addr, src_addr)
            dl_crc = self.calculate_crc16_dnp3(dl_header)
            
            # Complete message
            message = b'\x05\x64' + dl_header + struct.pack('<H', dl_crc) + app_data
            
            print(f"Sending read request for AI.000-AI.009: {message.hex()}")
            sock.send(message)
            
            # Receive response
            print("Waiting for response...")
            response = sock.recv(1024)
            
            if response:
                print(f"✓ Response received ({len(response)} bytes): {response.hex()}")
                self.parse_analog_input_response(response)
            else:
                print("✗ No response received")
            
            sock.close()
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
    
    def parse_analog_input_response(self, data):
        """Parse response for analog input data"""
        
        if len(data) < 10:
            print("Response too short")
            return
        
        # Check DNP3 format
        if data[0:2] != b'\x05\x64':
            print("Invalid DNP3 response")
            return
        
        print("\n=== Parsing DNP3 Response ===")
        
        # Data Link Layer
        length = data[2]
        control = data[3]
        dest = struct.unpack('<H', data[4:6])[0]
        src = struct.unpack('<H', data[6:8])[0]
        
        print(f"Data Link: Length={length}, Control=0x{control:02X}, Dest={dest}, Src={src}")
        
        dl_function = control & 0x0F
        print(f"Data Link Function: {dl_function}")
        
        if dl_function == 0:
            print("⚠️  Function Code 0 - This means LINK RESET or NO DATA")
            print("   The server acknowledged but doesn't have the requested data")
            return
        
        # Application layer starts after DL header + CRC + Transport
        if len(data) > 11:
            transport = data[10]
            app_control = data[11]
            app_function = data[12] if len(data) > 12 else 0
            
            print(f"Transport: 0x{transport:02X}")
            print(f"Application: Control=0x{app_control:02X}, Function=0x{app_function:02X}")
            
            if app_function == 0x81:  # Response
                print("✓ This is a data response!")
                
                # Parse object headers starting at byte 13
                idx = 13
                while idx + 3 <= len(data):
                    group = data[idx]
                    variation = data[idx + 1]
                    qualifier = data[idx + 2]
                    
                    print(f"\nObject Header: Group {group}, Variation {variation}, Qualifier 0x{qualifier:02X}")
                    
                    if group == 30:  # Analog Input
                        print("*** ANALOG INPUT DATA FOUND! ***")
                        idx += 3
                        
                        if qualifier == 0x07:  # Range qualifier
                            start_idx = data[idx]
                            stop_idx = data[idx + 1] 
                            idx += 2
                            print(f"Range: {start_idx} to {stop_idx}")
                            
                            # Parse each analog input value
                            for ai_index in range(start_idx, stop_idx + 1):
                                if variation == 1 and idx + 5 <= len(data):  # 32-bit with flags
                                    flags = data[idx]
                                    value = struct.unpack('<I', data[idx+1:idx+5])[0]
                                    
                                    print(f"🎯 AI.{ai_index:03d}: VALUE = {value}, FLAGS = 0x{flags:02X}")
                                    
                                    if ai_index == 0:
                                        print(f"*** AI.000 (equivalent to your AO.000): {value} ***")
                                    
                                    idx += 5
                                    
                                elif variation == 2 and idx + 3 <= len(data):  # 16-bit with flags
                                    flags = data[idx]
                                    value = struct.unpack('<H', data[idx+1:idx+3])[0]
                                    
                                    print(f"🎯 AI.{ai_index:03d}: VALUE = {value}, FLAGS = 0x{flags:02X}")
                                    
                                    if ai_index == 0:
                                        print(f"*** AI.000 (equivalent to your AO.000): {value} ***")
                                    
                                    idx += 3
                        break
                    else:
                        print(f"Skipping Group {group} (not analog input)")
                        break
            else:
                print(f"⚠️  Application Function {app_function} - not a data response")
    
    def read_all_available_data(self):
        """Read all available data types from the DNP3 server"""
        
        data_types = [
            (30, "Analog Inputs (AI)", "AI.000-AI.009"),
            (1, "Binary Inputs (BI)", "BI.000-BI.009"), 
            (20, "Counters (CTR)", "CTR.000-CTR.004"),
        ]
        
        try:
            print(f"Connecting to read all available data...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            sock.connect((self.host, self.port))
            print("✓ Connected!")
            
            for group, name, description in data_types:
                print(f"\n--- Reading {name} ({description}) ---")
                
                # Build read request
                transport = 0xC0
                app_control = 0xC0 | (self.app_seq & 0x0F)
                function_code = 0x01
                
                # Read all objects of this group
                variation = 0  # Any variation
                qualifier = 0x06  # All objects
                
                app_data = struct.pack('<BBBBB', 
                                     transport, app_control, function_code,
                                     group, variation, qualifier)
                
                # Data link
                length = 5 + len(app_data) + 2
                control = 0xC4
                
                dl_header = struct.pack('<BBHH', length, control, 0, 1)
                dl_crc = self.calculate_crc16_dnp3(dl_header)
                
                message = b'\x05\x64' + dl_header + struct.pack('<H', dl_crc) + app_data
                
                print(f"Sending request: {message.hex()}")
                sock.send(message)
                
                # Get response
                time.sleep(1)
                try:
                    sock.settimeout(5)
                    response = sock.recv(1024)
                    if response:
                        print(f"Response received!")
                        self.parse_analog_input_response(response)
                    else:
                        print("No response")
                except socket.timeout:
                    print("Timeout")
                
                self.app_seq = (self.app_seq + 1) % 16
                time.sleep(0.5)
            
            sock.close()
            
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    print("DNP3 Client - Reading Available Data")
    print("===================================")
    print("Based on Docker logs, the server has:")
    print("  • Analog Inputs: AI.000-AI.009 (values: 0-100)")
    print("  • Binary Inputs: BI.000-BI.009 (random states)")
    print("  • Counters: CTR.000-CTR.004 (incrementing)")
    print("  ❌ NO Analog Outputs (AO) - that's why you got function code 0!")
    print()
    
    client = DNP3Client()
    
    # Read the available analog inputs instead of analog outputs
    print("Reading Analog Inputs (since AO is not available):")
    client.read_analog_inputs()
    
    print(f"\n" + "="*60)
    print("Reading ALL available data types:")
    client.read_all_available_data()
