#!/usr/bin/env python3
"""
Fixed DNP3 Outstation Simulator
Properly responds with function code 0x81 for data responses
"""
import socket
import threading
import time
import struct
import random
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

class FixedDNP3Outstation:
    def __init__(self, host='0.0.0.0', port=20000):
        self.host = host
        self.port = port
        self.socket = None
        self.running = False
        
        # Simulate some data points
        self.analog_inputs = {i: random.uniform(0, 100) for i in range(10)}
        self.binary_inputs = {i: random.choice([True, False]) for i in range(10)}
        self.counters = {i: random.randint(0, 65535) for i in range(5)}
        
        # Start data update thread
        self.update_thread = threading.Thread(target=self.update_data, daemon=True)
        self.update_thread.start()
    
    def update_data(self):
        """Update simulated data periodically"""
        while True:
            # Update analog inputs with some variation
            for i in range(10):
                self.analog_inputs[i] += random.uniform(-2, 2)
                self.analog_inputs[i] = max(0, min(100, self.analog_inputs[i]))
            
            # Occasionally flip binary inputs
            if random.random() < 0.1:  # 10% chance
                idx = random.randint(0, 9)
                self.binary_inputs[idx] = not self.binary_inputs[idx]
            
            # Increment counters slowly
            for i in range(5):
                if random.random() < 0.3:  # 30% chance
                    self.counters[i] = (self.counters[i] + 1) % 65536
            
            time.sleep(1)  # Update every second
    
    def create_response(self, request):
        """Create a proper DNP3 response with correct function code"""
        try:
            if len(request) < 12:
                return None
            
            # Parse request
            dest_addr = request[4] | (request[5] << 8)
            src_addr = request[6] | (request[7] << 8)
            app_control = request[10]
            function_code = request[11]
            
            logger.info(f"Request: src={src_addr}, dest={dest_addr}, func=0x{function_code:02x}")
            
            # Create response frame
            response = bytearray()
            
            # Data link header
            response.extend([0x05, 0x64])  # Start bytes
            response.append(0x08)          # Length (will be recalculated)
            response.append(0x44)          # Control byte (unconfirmed user data)
            
            # Swap addresses (dest becomes src, src becomes dest)
            response.extend([src_addr & 0xFF, (src_addr >> 8) & 0xFF])     # New dest
            response.extend([dest_addr & 0xFF, (dest_addr >> 8) & 0xFF])   # New src
            
            # Header CRC placeholder
            header_crc_pos = len(response)
            response.extend([0x00, 0x00])
            
            # Application layer
            app_response = bytearray()
            app_response.append(0x81)  # CORRECT: Response function code (not 0x00!)
            app_response.append(0x00)  # IIN1
            app_response.append(0x00)  # IIN2
            
            # If this is a read request, add data
            if function_code == 0x01:  # Read request
                # Group 30 (Analog Input), Variation 2 (16-bit with flags)
                app_response.extend([30, 2])      # Group, Variation
                app_response.append(0x00)         # Qualifier (8-bit start/stop)
                app_response.extend([0x00, 0x04]) # Range: 0-4 (5 points)
                
                # Add 5 analog input values
                for i in range(5):
                    value = int(self.analog_inputs.get(i, 50.0))
                    app_response.extend(struct.pack('<H', value))  # Value (little endian)
                    app_response.append(0x01)  # Quality flags (online)
            
            # Calculate and update header length
            total_app_length = len(app_response)
            response[2] = 5 + total_app_length  # Update length field
            
            # Calculate header CRC (excluding start bytes)
            header_for_crc = response[2:8]
            header_crc = calculate_crc(header_for_crc)
            response[header_crc_pos:header_crc_pos+2] = struct.pack('<H', header_crc)
            
            # Add application data
            response.extend(app_response)
            
            # Calculate and add application CRC
            app_crc = calculate_crc(app_response)
            response.extend(struct.pack('<H', app_crc))
            
            logger.info(f"Sending proper response with function code 0x81, {len(response)} bytes")
            return bytes(response)
            
        except Exception as e:
            logger.error(f"Error creating response: {e}")
            return None
    
    def handle_client(self, client_socket, address):
        """Handle client connection"""
        logger.info(f"Client connected from {address}")
        
        try:
            while self.running:
                # Receive request
                data = client_socket.recv(1024)
                if not data:
                    break
                
                logger.info(f"Received {len(data)} bytes from {address}: {data.hex()}")
                
                # Create and send response
                response = self.create_response(data)
                if response:
                    client_socket.send(response)
                    logger.info(f"Sent response to {address}: {len(response)} bytes")
                else:
                    logger.warning(f"Could not create response for request from {address}")
        
        except Exception as e:
            logger.error(f"Error handling client {address}: {e}")
        finally:
            client_socket.close()
            logger.info(f"Client {address} disconnected")
    
    def start(self):
        """Start the DNP3 outstation"""
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            self.socket.bind((self.host, self.port))
            self.socket.listen(5)
            self.running = True
            
            logger.info(f"Fixed DNP3 Outstation listening on {self.host}:{self.port}")
            logger.info("Simulated data points:")
            logger.info(f"  Analog Inputs: AI.000-AI.009 (values: 0-100)")
            logger.info(f"  Binary Inputs: BI.000-BI.009 (random states)")
            logger.info(f"  Counters: CTR.000-CTR.004 (incrementing)")
            
            while self.running:
                try:
                    client_socket, address = self.socket.accept()
                    client_thread = threading.Thread(
                        target=self.handle_client, 
                        args=(client_socket, address),
                        daemon=True
                    )
                    client_thread.start()
                except Exception as e:
                    if self.running:
                        logger.error(f"Error accepting connection: {e}")
        
        except Exception as e:
            logger.error(f"Error starting server: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the DNP3 outstation"""
        self.running = False
        if self.socket:
            self.socket.close()
        logger.info("Fixed DNP3 Outstation stopped")

def main():
    outstation = FixedDNP3Outstation()
    
    try:
        outstation.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    finally:
        outstation.stop()

if __name__ == "__main__":
    main()
