#!/usr/bin/env python3
"""
Improved DNP3 Outstation Simulator
Properly parses requests and responds with correct AI/AO data
"""

import socket
import struct
import threading
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ImprovedDNP3Outstation:
    def __init__(self, host="0.0.0.0", port=20000):
        self.host = host
        self.port = port
        self.running = False
        
        # Dummy data for points
        self.analog_inputs = {
            0: 42.5,    # AI.000
            1: 123.7,   # AI.001
            2: 0.0,     # AI.002
            3: 999.9,   # AI.003
            4: 55.5,    # AI.004
            5: 77.7,    # AI.005
            6: 88.8,    # AI.006
            7: 100.1,   # AI.007
            8: 255.0,   # AI.008 - Your target point!
        }
        
        self.analog_outputs = {
            0: 0.0,     # AO.000 - Your target point with ZERO value!
            1: 10.5,    # AO.001
            2: 20.2,    # AO.002
            3: 30.3,    # AO.003
            4: 40.4,    # AO.004
            5: 50.5,    # AO.005
            6: 60.6,    # AO.006
            7: 70.7,    # AO.007
            8: 80.8,    # AO.008
        }
        
    def calculate_crc(self, data: bytes) -> int:
        """DNP3 CRC-16 calculation"""
        crc = 0x0000
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 0x0001:
                    crc = (crc >> 1) ^ 0x3D65
                else:
                    crc >>= 1
        return crc & 0xFFFF
    
    def parse_request(self, request_data: bytes):
        """Parse DNP3 request to determine what's being asked for"""
        try:
            if len(request_data) < 18:
                return None, None, None
                
            # Skip to APDU (past link layer)
            # Link: Start(2) + Length(1) + Control(1) + Dest(2) + Src(2) + CRC(2) = 10 bytes
            # Transport: 1 byte
            # APDU starts at byte 11
            
            apdu_start = 11
            if len(request_data) > apdu_start + 3:
                app_control = request_data[apdu_start]
                func_code = request_data[apdu_start + 1]
                
                # Look for object headers starting after IIN bytes
                obj_start = apdu_start + 4
                
                if len(request_data) > obj_start + 2:
                    group = request_data[obj_start]
                    variation = request_data[obj_start + 1]
                    qualifier = request_data[obj_start + 2]
                    
                    # For indexed reads, get the index
                    if qualifier == 0x28 and len(request_data) > obj_start + 6:
                        count = struct.unpack('<H', request_data[obj_start + 3:obj_start + 5])[0]
                        index = struct.unpack('<H', request_data[obj_start + 5:obj_start + 7])[0]
                        return group, variation, index
                        
            return None, None, None
            
        except Exception as e:
            logger.error(f"Error parsing request: {e}")
            return None, None, None
    
    def build_response(self, request_data: bytes, client_addr) -> bytes:
        """Build DNP3 response based on parsed request"""
        logger.info(f"📥 Request from {client_addr}: {request_data.hex()}")
        
        # Parse the request
        group, variation, index = self.parse_request(request_data)
        
        # Default response for integrity scans or if we can't parse
        if group is None:
            logger.info(f"📤 Sending default integrity response (AI.008=255.0)")
            return self.build_integrity_response(client_addr)
        
        # Handle specific point requests
        logger.info(f"🎯 Parsed request: Group {group}, Variation {variation}, Index {index}")
        
        if group == 30:  # Analog Inputs
            if index in self.analog_inputs:
                value = self.analog_inputs[index]
                logger.info(f"✅ Responding with AI.{index:03d} = {value}")
                return self.build_analog_response(group, variation, index, value, client_addr)
            else:
                logger.warning(f"❌ AI.{index:03d} not found")
                return self.build_error_response(client_addr)
                
        elif group == 40:  # Analog Outputs  
            if index in self.analog_outputs:
                value = self.analog_outputs[index]
                logger.info(f"✅ Responding with AO.{index:03d} = {value}")
                if value == 0.0:
                    logger.info(f"📌 ZERO VALUE: Successfully serving AO.{index:03d} = 0.0")
                return self.build_analog_response(group, variation, index, value, client_addr)
            else:
                logger.warning(f"❌ AO.{index:03d} not found")
                return self.build_error_response(client_addr)
        else:
            logger.warning(f"❌ Unsupported group {group}")
            return self.build_error_response(client_addr)
    
    def build_analog_response(self, group, variation, index, value, client_addr):
        """Build response for a specific analog point"""
        # Link Header
        start = b"\\x05\\x64"
        control = 0x44  # Response from outstation
        dest = 1        # Master address  
        src = 10        # Our outstation address
        
        # Application Layer Response
        app_control = 0xC0  # FIR=1, FIN=1, CON=0, UNS=0, SEQ=0
        func_code = 0x81    # Response
        iin1 = 0x00         # Internal Indication byte 1
        iin2 = 0x00         # Internal Indication byte 2
        
        # Object header
        qualifier = 0x28  # Count + index
        count = 1
        
        # Object data - 64-bit float
        if variation == 6:
            value_bytes = struct.pack('<d', float(value))  # 64-bit float, little endian
        elif variation == 2:
            value_bytes = struct.pack('<H', int(value))    # 16-bit int
        else:
            value_bytes = struct.pack('<f', float(value))  # 32-bit float
        
        # Build object data
        object_data = struct.pack('<BBBHH', group, variation, qualifier, count, index) + value_bytes
        
        # Build APDU
        apdu = struct.pack('<BBBB', app_control, func_code, iin1, iin2) + object_data
        
        # Transport header
        transport = 0xC0  # FIR=1, FIN=1, SEQ=0
        
        # Build payload
        payload = struct.pack('B', transport) + apdu
        
        # Add block CRCs to payload
        payload_with_crc = self.add_block_crc(payload)
        
        # Build link header
        length = len(payload_with_crc) + 5  # +5 for control+dest+src+crc
        link_data = struct.pack('<BBHH', length, control, dest, src)
        link_crc = self.calculate_crc(link_data)
        
        # Complete frame
        response = start + link_data + struct.pack('<H', link_crc) + payload_with_crc
        
        logger.info(f"📤 Response to {client_addr}: {response.hex()}")
        return response
    
    def build_integrity_response(self, client_addr):
        """Build default integrity scan response (AI.008=255.0)"""
        # Same as before but explicitly for AI.008
        return self.build_analog_response(30, 6, 8, 255.0, client_addr)
    
    def build_error_response(self, client_addr):
        """Build error response for unsupported requests"""
        # Simple error response
        start = b"\\x05\\x64"
        control = 0x44
        dest = 1
        src = 10
        
        app_control = 0xC0
        func_code = 0x81
        iin1 = 0x02  # Device trouble
        iin2 = 0x00
        
        apdu = struct.pack('<BBBB', app_control, func_code, iin1, iin2)
        transport = 0xC0
        payload = struct.pack('B', transport) + apdu
        payload_with_crc = self.add_block_crc(payload)
        
        length = len(payload_with_crc) + 5
        link_data = struct.pack('<BBHH', length, control, dest, src)
        link_crc = self.calculate_crc(link_data)
        
        response = start + link_data + struct.pack('<H', link_crc) + payload_with_crc
        logger.info(f"📤 Error response to {client_addr}: {response.hex()}")
        return response
    
    def add_block_crc(self, payload: bytes) -> bytes:
        """Add CRC every 16 bytes"""
        result = bytearray()
        for i in range(0, len(payload), 16):
            block = payload[i:i+16]
            result.extend(block)
            crc = self.calculate_crc(block)
            result.extend(struct.pack('<H', crc))
        return bytes(result)
    
    def handle_client(self, client_socket, client_addr):
        """Handle individual client connection"""
        logger.info(f"🔗 New client connected: {client_addr}")
        
        try:
            while self.running:
                client_socket.settimeout(1.0)
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                        
                    response = self.build_response(data, client_addr)
                    client_socket.send(response)
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"Error handling client {client_addr}: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"Client handler error: {e}")
        finally:
            client_socket.close()
            logger.info(f"🔌 Client disconnected: {client_addr}")
    
    def start(self):
        """Start the DNP3 outstation server"""
        self.running = True
        
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            logger.info(f"🚀 IMPROVED DNP3 Outstation running on {self.host}:{self.port}")
            logger.info(f"📊 Configured points:")
            logger.info(f"   AI.000-008: {list(self.analog_inputs.values())}")
            logger.info(f"   AO.000-008: {list(self.analog_outputs.values())}")
            logger.info(f"🎯 Key test points:")
            logger.info(f"   AI.008 = {self.analog_inputs[8]} (for dashboard test)")
            logger.info(f"   AO.000 = {self.analog_outputs[0]} (ZERO VALUE TEST)")
            
            while self.running:
                try:
                    server_socket.settimeout(1.0)
                    client_socket, client_addr = server_socket.accept()
                    
                    client_thread = threading.Thread(
                        target=self.handle_client, 
                        args=(client_socket, client_addr),
                        daemon=True
                    )
                    client_thread.start()
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Server error: {e}")
                        
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
        finally:
            server_socket.close()
            logger.info("🛑 DNP3 Outstation stopped")
    
    def stop(self):
        """Stop the outstation"""
        self.running = False

if __name__ == "__main__":
    outstation = ImprovedDNP3Outstation(host="0.0.0.0", port=20000)
    
    try:
        outstation.start()
    except KeyboardInterrupt:
        logger.info("⏹️ Stopping outstation...")
        outstation.stop()
