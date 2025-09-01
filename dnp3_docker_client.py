#!/usr/bin/env python3

import socket
import struct
import time
import sys

class DNP3Client:
    def __init__(self, host="localhost", port=20000):
        self.host = host
        self.port = port
        self.app_seq = 0
        self.sock = None
        
    def connect(self):
        """Connect to DNP3 server"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(10)
            self.sock.connect((self.host, self.port))
            print(f"✓ Connected to DNP3 server at {self.host}:{self.port}")
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from server"""
        if self.sock:
            self.sock.close()
            self.sock = None
    
    def calculate_crc(self, data):
        """Calculate DNP3 CRC-16"""
        # DNP3 CRC polynomial
        crc = 0x0000
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ 0xA6BC
                else:
                    crc >>= 1
        return (~crc) & 0xFFFF
    
    def send_dnp3_frame(self, app_data=None, function_code=None):
        """Send a complete DNP3 frame"""
        
        # If no app data, send link layer only
        if app_data is None:
            # Link reset
            length = 5
            control = 0xC0  # DIR=1, PRM=1, FC=0 (reset)
            dest = 0
            src = 1
            
            dl_header = struct.pack('<BBHH', length, control, dest, src)
            crc = self.calculate_crc(dl_header)
            
            frame = b'\x05\x64' + dl_header + struct.pack('<H', crc)
            
        else:
            # Full frame with application data
            transport = 0xC0  # FIR=1, FIN=1, SEQ=0
            
            # Application control and function
            app_control = 0xC0 | (self.app_seq & 0x0F)  # FIR=1, FIN=1, CON=0, UNS=0, SEQ=app_seq
            if function_code is None:
                function_code = 0x01  # READ
            
            # Complete application data
            complete_app = struct.pack('<BB', transport, app_control) + struct.pack('<B', function_code) + app_data
            
            # Data link header
            length = 5 + len(complete_app) + 2  # DL header + app data + DL CRC
            control = 0xC4  # DIR=1, PRM=1, FC=4 (user data)
            dest = 0
            src = 1
            
            dl_header = struct.pack('<BBHH', length, control, dest, src)
            dl_crc = self.calculate_crc(dl_header)
            
            frame = b'\x05\x64' + dl_header + struct.pack('<H', dl_crc) + complete_app
            
            self.app_seq = (self.app_seq + 1) % 16
        
        return frame
    
    def parse_response(self, response):
        """Parse DNP3 response and extract data"""
        if len(response) < 10:
            print(f"Response too short: {len(response)} bytes")
            return
        
        print(f"\nParsing response ({len(response)} bytes): {response.hex()}")
        
        # Check DNP3 start bytes
        if response[0:2] != b'\x05\x64':
            print("✗ Invalid DNP3 start bytes")
            return
        
        # Parse Data Link Layer
        length = response[2]
        control = response[3]
        dest = struct.unpack('<H', response[4:6])[0]
        src = struct.unpack('<H', response[6:8])[0]
        dl_crc = struct.unpack('<H', response[8:10])[0]
        
        print(f"Data Link: Length={length}, Control=0x{control:02X}, Dest={dest}, Src={src}")
        
        # Check Data Link Function Code
        dl_function = control & 0x0F
        is_from_primary = (control & 0x40) != 0
        
        print(f"DL Function Code: {dl_function} ({'Primary' if is_from_primary else 'Secondary'})")
        
        if dl_function == 0:
            print("⚠️  This is a LINK RESET frame (Function Code 0)")
            print("   The outstation is resetting the link - this is normal during startup")
            return
        elif dl_function == 1:
            print("✗ Link NACK received")
            return
        elif dl_function == 0x0B:
            print("✓ Link Status OK")
        
        # If there's application data
        if len(response) > 10 and dl_function == 4:  # User data
            transport = response[10]
            app_control = response[11] if len(response) > 11 else 0
            app_function = response[12] if len(response) > 12 else 0
            
            print(f"Transport: 0x{transport:02X}")
            print(f"App Control: 0x{app_control:02X}, App Function: 0x{app_function:02X}")
            
            if app_function == 0:
                print("⚠️  Application Function Code 0 (CONFIRM)")
                print("   This means the server confirmed receipt but may not have data")
            elif app_function == 0x81:
                print("✓ Application Response (0x81)")
                
                # Parse object data
                idx = 13
                while idx + 3 <= len(response):
                    group = response[idx]
                    variation = response[idx + 1] 
                    qualifier = response[idx + 2]
                    
                    print(f"Object: Group {group}, Variation {variation}, Qualifier 0x{qualifier:02X}")
                    
                    if group == 41:  # Analog Output Status
                        print("*** ANALOG OUTPUT DATA FOUND! ***")
                        idx += 3
                        
                        if qualifier == 0x07:  # Range
                            start_idx = response[idx]
                            stop_idx = response[idx + 1]
                            idx += 2
                            print(f"Range: {start_idx} to {stop_idx}")
                            
                            for point in range(start_idx, stop_idx + 1):
                                if variation == 1 and idx + 5 <= len(response):  # 32-bit + flags
                                    flags = response[idx]
                                    value = struct.unpack('<I', response[idx+1:idx+5])[0]
                                    print(f"🎯 AO,{point:03d}: VALUE = {value}, FLAGS = 0x{flags:02X}")
                                    if point == 0:
                                        print(f"*** AO,000 FINAL VALUE: {value} ***")
                                    idx += 5
                                elif variation == 2 and idx + 3 <= len(response):  # 16-bit + flags
                                    flags = response[idx]
                                    value = struct.unpack('<H', response[idx+1:idx+3])[0]
                                    print(f"🎯 AO,{point:03d}: VALUE = {value}, FLAGS = 0x{flags:02X}")
                                    if point == 0:
                                        print(f"*** AO,000 FINAL VALUE: {value} ***")
                                    idx += 3
                        break
                    else:
                        break
    
    def read_ao_000(self):
        """Specifically read AO,000"""
        print("Reading AO,000 from DNP3 server...")
        
        if not self.connect():
            return False
        
        try:
            # Step 1: Send link reset to establish clean connection
            print("\n--- Step 1: Link Reset ---")
            reset_frame = self.send_dnp3_frame()  # No app data = link reset
            
            print(f"Sending link reset: {reset_frame.hex()}")
            self.sock.send(reset_frame)
            
            # Wait for reset response
            time.sleep(1)
            try:
                self.sock.settimeout(3)
                reset_response = self.sock.recv(1024)
                if reset_response:
                    print("Link reset response received")
                    self.parse_response(reset_response)
            except socket.timeout:
                print("No reset response (this is often normal)")
            
            # Step 2: Read analog output status
            print("\n--- Step 2: Reading Analog Output Status ---")
            
            # Create read request for Group 41 (Analog Output Status)
            # Try variation 1 (32-bit with flags) for AO,000
            app_data = struct.pack('<BBB', 41, 1, 0x07) + struct.pack('<BB', 0, 0)  # Group 41, Var 1, Range 0-0
            
            read_frame = self.send_dnp3_frame(app_data, 0x01)  # READ function
            
            print(f"Sending read request: {read_frame.hex()}")
            self.sock.send(read_frame)
            
            # Wait for data response
            time.sleep(2)
            try:
                self.sock.settimeout(5)
                data_response = self.sock.recv(1024)
                if data_response:
                    print("✓ Data response received!")
                    self.parse_response(data_response)
                    return True
                else:
                    print("✗ No data response")
            except socket.timeout:
                print("✗ Data response timeout")
            
            # Step 3: Try integrity scan if direct read failed
            print("\n--- Step 3: Integrity Scan ---")
            
            # Class 1, 2, 3 integrity scan
            for class_num in [1, 2, 3]:
                class_data = struct.pack('<BBB', 60, class_num, 0x06)  # Group 60, Class X, All objects
                scan_frame = self.send_dnp3_frame(class_data, 0x01)
                
                print(f"Sending Class {class_num} scan: {scan_frame.hex()}")
                self.sock.send(scan_frame)
                
                time.sleep(1)
                try:
                    self.sock.settimeout(3)
                    scan_response = self.sock.recv(1024)
                    if scan_response:
                        print(f"✓ Class {class_num} response!")
                        self.parse_response(scan_response)
                except socket.timeout:
                    print(f"✗ Class {class_num} timeout")
                
                time.sleep(0.5)
            
        except Exception as e:
            print(f"Error during DNP3 communication: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.disconnect()
        
        return False

if __name__ == "__main__":
    print("DNP3 Client for Docker DNP3 Server")
    print("==================================")
    print("This will handle function code 0 responses properly")
    print()
    
    client = DNP3Client(host="localhost", port=20000)  # Docker container
    client.read_ao_000()
