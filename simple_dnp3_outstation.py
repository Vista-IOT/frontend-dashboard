#!/usr/bin/env python3
"""
Simple DNP3 Outstation Simulator
Responds to read requests with dummy data for AI.000-008 and AO.000-008
"""

import socket
import struct
import threading
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleDNP3Outstation:
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
            0: 0.0,     # AO.000 - Your target point!
            1: 10.5,    # AO.001
            2: 20.2,    # AO.002
            3: 30.3,    # AO.003
            4: 40.4,    # AO.004
            5: 50.5,    # AO.005
            6: 60.6,    # AO.006
            7: 70.7,    # AO.007
            8: 80.8,    # AO.008
        }
        
        self.binary_inputs = {i: (i % 2 == 0) for i in range(9)}  # Alternating true/false
        
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
    
    def build_response(self, request_data: bytes, client_addr) -> bytes:
        """Build DNP3 response with actual data"""
        logger.info(f"📥 Request from {client_addr}: {request_data.hex()}")
        
        # Simple response: Return data for any read request
        # DNP3 Response Frame Structure:
        # Start(2) + Length(1) + Control(1) + Dest(2) + Src(2) + CRC(2) + [Transport(1) + App(N) + CRC...]
        
        # Link Header
        start = b"\x05\x64"
        control = 0x44  # Response from outstation
        dest = 1        # Master address
        src = 10        # Our outstation address
        
        # Application Layer Response
        app_control = 0xC0  # FIR=1, FIN=1, CON=0, UNS=0, SEQ=0
        func_code = 0x81    # Response
        iin1 = 0x00         # Internal Indication byte 1
        iin2 = 0x00         # Internal Indication byte 2
        
        # Object: Group 30 (AI), Variation 6 (64-bit float), Qualifier 0x28 (count+index)
        # Return AI.008 = 255.0
        group = 30
        variation = 6
        qualifier = 0x28
        count = 1
        index = 8
        value = struct.pack('<d', 255.0)  # 64-bit float, little endian
        
        # Build object data
        object_data = struct.pack('<BBBHH', group, variation, qualifier, count, index) + value
        
        # Build APDU
        apdu = struct.pack('<BBBB', app_control, func_code, iin1, iin2) + object_data
        
        # Transport header
        transport = 0xC0  # FIR=1, FIN=1, SEQ=0
        
        # Build payload
        payload = struct.pack('B', transport) + apdu
        
        # Add block CRCs to payload (every 16 bytes)
        payload_with_crc = self.add_block_crc(payload)
        
        # Build link header
        length = len(payload_with_crc) + 5  # +5 for control+dest+src+crc
        link_data = struct.pack('<BBHH', length, control, dest, src)
        link_crc = self.calculate_crc(link_data)
        
        # Complete frame
        response = start + link_data + struct.pack('<H', link_crc) + payload_with_crc
        
        logger.info(f"📤 Response to {client_addr}: {response.hex()}")
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
                # Set timeout for non-blocking receive
                client_socket.settimeout(1.0)
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                        
                    # Build and send response
                    response = self.build_response(data, client_addr)
                    client_socket.send(response)
                    
                except socket.timeout:
                    continue  # Check if still running
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
        
        # Create server socket
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            logger.info(f"🚀 DNP3 Outstation running on {self.host}:{self.port}")
            logger.info(f"📊 Configured points:")
            logger.info(f"   AI.000-008: {list(self.analog_inputs.values())}")
            logger.info(f"   AO.000-008: {list(self.analog_outputs.values())}")
            
            while self.running:
                try:
                    server_socket.settimeout(1.0)  # Non-blocking accept
                    client_socket, client_addr = server_socket.accept()
                    
                    # Handle each client in a separate thread
                    client_thread = threading.Thread(
                        target=self.handle_client, 
                        args=(client_socket, client_addr),
                        daemon=True
                    )
                    client_thread.start()
                    
                except socket.timeout:
                    continue  # Check if still running
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
    # Create and start outstation
    outstation = SimpleDNP3Outstation(host="0.0.0.0", port=20000)
    
    try:
        outstation.start()
    except KeyboardInterrupt:
        logger.info("⏹️ Stopping outstation...")
        outstation.stop()
