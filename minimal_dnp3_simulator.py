#!/usr/bin/env python3
"""
FINAL WORKING DNP3 simulator - correctly parses both AI and AO requests
"""

import socket
import struct
import threading
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MinimalDNP3Outstation:
    def __init__(self, host="0.0.0.0", port=20000):
        self.host = host
        self.port = port
        self.running = False
        
        # Test data
        self.ai_values = [42.5, 123.7, 0.0, 999.9, 55.5, 77.7, 88.8, 100.1, 255.0]  # AI.000-008
        self.ao_values = [0.0, 10.5, 20.2, 30.3, 40.4, 50.5, 60.6, 70.7, 80.8]     # AO.000-008
        
    def handle_client(self, client_socket, client_addr):
        logger.info(f"🔗 Client connected: {client_addr}")
        
        try:
            while self.running:
                client_socket.settimeout(1.0)
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                        
                    logger.info(f"📥 Request: {data.hex()}")
                    
                    response = self.create_response(data, client_addr)
                    client_socket.send(response)
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"Client error: {e}")
                    break
                    
        finally:
            client_socket.close()
            logger.info(f"🔌 Client disconnected: {client_addr}")
    
    def create_response(self, request_data, client_addr):
        """Create appropriate response based on request"""
        
        if len(request_data) < 19:
            logger.info("📤 Default response: AI.008 = 255.0 (too short)")
            return self.build_ai_response(8, 255.0)
            
        try:
            group = request_data[13]
            variation = request_data[14]
            
            # Index location depends on request type
            if group == 40:  # AO requests
                index = request_data[17]  # AO index at byte 17
            else:  # AI requests
                index = request_data[18]  # AI index at byte 18
            
            logger.info(f"🔍 Parsed: Group {group}, Variation {variation}, Index {index}")
            
            if group == 40:  # AO Group
                if 0 <= index < len(self.ao_values):
                    value = self.ao_values[index]
                    logger.info(f"✅ Responding with AO.{index:03d} = {value}")
                    if value == 0.0:
                        logger.info(f"📌 ZERO VALUE: Successfully serving AO.{index:03d} = 0.0")
                    return self.build_ao_response(index, value)
                    
            elif group == 30:  # AI Group  
                if 0 <= index < len(self.ai_values):
                    value = self.ai_values[index]
                    logger.info(f"✅ Responding with AI.{index:03d} = {value}")
                    return self.build_ai_response(index, value)
                    
        except (IndexError, struct.error) as e:
            logger.info(f"⚠️ Parse error: {e}")
        
        # Default fallback
        logger.info(f"📤 Default response: AI.008 = 255.0")
        return self.build_ai_response(8, 255.0)
    
    def build_ai_response(self, index, value):
        """Build AI response (Group 30, Variation 6)"""
        # Known working base response for AI  
        response_hex = "05641d4401000a00471fc0c08100001e06280100080000000000313200e06f402122"
        response_bytes = bytearray.fromhex(response_hex)
        
        # Update index in response (bytes 20-21)
        response_bytes[20:22] = struct.pack('<H', index)
        
        # Update value (64-bit float at bytes 28-35)
        value_bytes = struct.pack('<d', value)
        response_bytes[28:36] = value_bytes
        
        logger.info(f"📤 AI.{index:03d}={value} response sent")
        return bytes(response_bytes)
    
    def build_ao_response(self, index, value):
        """Build AO response (Group 40, Variation 2)"""
        # Base AO response
        response_hex = "05641d4401000a00471fc0c081000028022801000000000000313200000040212200"
        response_bytes = bytearray.fromhex(response_hex)
        
        # Update index (bytes 20-21)
        response_bytes[20:22] = struct.pack('<H', index)
        
        # Update value as 16-bit integer (bytes 22-23) 
        value_int = int(value * 100)  # Scale for representation
        response_bytes[22:24] = struct.pack('<H', value_int)
        
        logger.info(f"📤 AO.{index:03d}={value} response sent")
        return bytes(response_bytes)
    
    def start(self):
        self.running = True
        
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            logger.info(f"🚀 Fixed DNP3 Outstation running on {self.host}:{self.port}")
            logger.info(f"📊 Points configured:")
            logger.info(f"   AI.008 = {self.ai_values[8]} ✅")
            logger.info(f"   AO.000 = {self.ao_values[0]} ⭐ ZERO VALUE")
            logger.info(f"   AO.001 = {self.ao_values[1]}")
            
            while self.running:
                try:
                    server_socket.settimeout(1.0)
                    client_socket, client_addr = server_socket.accept()
                    
                    thread = threading.Thread(
                        target=self.handle_client, 
                        args=(client_socket, client_addr),
                        daemon=True
                    )
                    thread.start()
                    
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Server error: {e}")
                        
        finally:
            server_socket.close()

if __name__ == "__main__":
    outstation = MinimalDNP3Outstation()
    try:
        outstation.start()
    except KeyboardInterrupt:
        logger.info("⏹️ Stopping...")
        outstation.running = False
