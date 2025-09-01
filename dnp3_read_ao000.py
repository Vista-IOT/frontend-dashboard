#!/usr/bin/env python3
"""
Basic DNP3 client script to read AO,000 from Advantech EdgeLink
Based on settings from the screenshot:
- Port: 20000
- Local Address (Master): 1
- Remote Address (Slave/Outstation): 4
- Target Point: AO,000 (Analog Output point 0)
"""

import socket
import struct
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# DNP3 Constants
DNP3_START_BYTES = [0x05, 0x64]
DNP3_ANALOG_OUTPUT = 40  # Group 40 for Analog Outputs
DNP3_FUNC_READ = 0x01
DNP3_FUNC_RESPONSE = 0x81

def calculate_crc16(data):
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

class DNP3Client:
    def __init__(self, ip_address, port=20000, local_addr=1, remote_addr=4, timeout=5.0):
        self.ip_address = ip_address
        self.port = port
        self.local_addr = local_addr
        self.remote_addr = remote_addr
        self.timeout = timeout
        self.socket = None
        self.sequence = 0
        
    def connect(self):
        """Establish TCP connection to DNP3 outstation"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.ip_address, self.port))
            logger.info(f"Connected to DNP3 device at {self.ip_address}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            return False
    
    def disconnect(self):
        """Close the connection"""
        if self.socket:
            self.socket.close()
            self.socket = None
            logger.info("Disconnected from DNP3 device")
    
    def create_read_request(self, group, variation, point_index):
        """Create DNP3 read request frame for a specific point"""
        self.sequence = (self.sequence + 1) % 16
        
        # Application Control Field
        app_control = 0xC0 | self.sequence  # First fragment, final fragment, confirm not required
        
        # Application header
        app_header = struct.pack('<BB', app_control, DNP3_FUNC_READ)
        
        # Object header - Read specific point
        # Object Group and Variation
        obj_header = struct.pack('<BB', group, variation)
        
        # Qualifier code: 0x17 = 8-bit start and stop indices
        qualifier = 0x17
        obj_header += struct.pack('<B', qualifier)
        
        # Range field (start and stop index - same for single point)
        obj_header += struct.pack('<BB', point_index, point_index)
        
        # Complete application data
        app_data = app_header + obj_header
        
        # Data Link Header
        length = 5 + len(app_data)  # 5 bytes for header + CRC + app data length
        control = 0xC4  # Unconfirmed user data, from master
        
        dl_header = struct.pack('<BBBBBBBB',
            DNP3_START_BYTES[0], DNP3_START_BYTES[1],  # Start bytes
            length,                                     # Length
            control,                                   # Control
            self.remote_addr & 0xFF,                   # Destination low
            (self.remote_addr >> 8) & 0xFF,           # Destination high  
            self.local_addr & 0xFF,                   # Source low
            (self.local_addr >> 8) & 0xFF             # Source high
        )
        
        # Calculate header CRC (skip start bytes and length)
        header_crc_data = dl_header[2:8]
        header_crc = calculate_crc16(header_crc_data)
        
        # Calculate application data CRC
        app_crc = calculate_crc16(app_data)
        
        # Assemble complete frame
        frame = dl_header + struct.pack('<H', header_crc) + app_data + struct.pack('<H', app_crc)
        
        return frame
    
    def parse_response(self, response):
        """Parse DNP3 response to extract analog output value"""
        if len(response) < 10:
            logger.error(f"Response too short: {len(response)} bytes")
            return None
            
        # Check start bytes
        if response[0] != 0x05 or response[1] != 0x64:
            logger.error(f"Invalid start bytes: {response[0]:02x} {response[1]:02x}")
            return None
        
        length = response[2]
        logger.debug(f"Response length: {length}")
        
        # Skip to application data (after data link header + CRC)
        app_start = 10  # 8 bytes header + 2 bytes CRC
        
        if len(response) < app_start + 2:
            logger.error("Response too short for application data")
            return None
            
        app_control = response[app_start]
        func_code = response[app_start + 1]
        
        logger.debug(f"Function code: {func_code:02x}")
        
        if func_code != DNP3_FUNC_RESPONSE:
            logger.error(f"Unexpected function code: {func_code:02x}")
            return None
        
        # Look for analog output object (Group 40)
        obj_start = app_start + 2
        if len(response) < obj_start + 3:
            logger.error("Response too short for object header")
            return None
            
        group = response[obj_start]
        variation = response[obj_start + 1]
        qualifier = response[obj_start + 2]
        
        logger.debug(f"Object: Group {group}, Variation {variation}, Qualifier {qualifier:02x}")
        
        if group == DNP3_ANALOG_OUTPUT:
            # Parse analog output data based on variation
            data_start = obj_start + 3
            
            if variation == 1:  # 32-bit with flag
                if len(response) >= data_start + 6:  # 5 bytes data + 1 flag
                    flag = response[data_start]
                    value_bytes = response[data_start + 1:data_start + 5]
                    value = struct.unpack('<i', value_bytes)[0]  # signed 32-bit
                    logger.info(f"AO,000 value: {value} (flag: {flag:02x})")
                    return value
            elif variation == 2:  # 16-bit with flag
                if len(response) >= data_start + 4:  # 3 bytes data + 1 flag
                    flag = response[data_start]
                    value_bytes = response[data_start + 1:data_start + 3]
                    value = struct.unpack('<h', value_bytes)[0]  # signed 16-bit
                    logger.info(f"AO,000 value: {value} (flag: {flag:02x})")
                    return value
            elif variation == 3:  # 32-bit float with flag
                if len(response) >= data_start + 6:
                    flag = response[data_start]
                    value_bytes = response[data_start + 1:data_start + 5]
                    value = struct.unpack('<f', value_bytes)[0]  # 32-bit float
                    logger.info(f"AO,000 value: {value} (flag: {flag:02x})")
                    return value
            elif variation == 4:  # 64-bit float with flag
                if len(response) >= data_start + 10:
                    flag = response[data_start]
                    value_bytes = response[data_start + 1:data_start + 9]
                    value = struct.unpack('<d', value_bytes)[0]  # 64-bit double
                    logger.info(f"AO,000 value: {value} (flag: {flag:02x})")
                    return value
        
        logger.warning("Could not parse analog output value from response")
        return None
    
    def read_analog_output(self, point_index=0, variation=1):
        """Read analog output point (AO,000 = point 0)"""
        try:
            # Create read request for analog output group 40
            frame = self.create_read_request(DNP3_ANALOG_OUTPUT, variation, point_index)
            
            logger.debug(f"Sending DNP3 request: {' '.join(f'{b:02x}' for b in frame)}")
            
            # Send request
            self.socket.send(frame)
            
            # Receive response
            response = self.socket.recv(1024)
            logger.debug(f"Received response: {' '.join(f'{b:02x}' for b in response)}")
            
            # Parse the response
            return self.parse_response(response)
            
        except Exception as e:
            logger.error(f"Error reading AO,000: {e}")
            return None

def main():
    """Main function to test reading AO,000 from Advantech EdgeLink"""
    
    # Configuration from screenshot
    # You'll need to update this IP address to match your Advantech device
    DEVICE_IP = "10.0.0.1"  # Update this to your device IP
    PORT = 20000
    LOCAL_ADDR = 1  # Master address
    REMOTE_ADDR = 4  # Outstation address
    
    print("DNP3 Client - Reading AO,000 from Advantech EdgeLink")
    print("=" * 50)
    print(f"Target Device: {DEVICE_IP}:{PORT}")
    print(f"Local Address: {LOCAL_ADDR}")
    print(f"Remote Address: {REMOTE_ADDR}")
    print(f"Target Point: AO,000 (Analog Output point 0)")
    print("=" * 50)
    
    # Create DNP3 client
    client = DNP3Client(DEVICE_IP, PORT, LOCAL_ADDR, REMOTE_ADDR)
    
    try:
        # Connect to device
        if not client.connect():
            print("❌ Failed to connect to DNP3 device")
            return
        
        print("✅ Connected to DNP3 device")
        
        # Try different variations to find the correct format
        variations_to_try = [1, 2, 3, 4]  # 32-bit int, 16-bit int, 32-bit float, 64-bit float
        
        for variation in variations_to_try:
            print(f"\n🔍 Trying variation {variation}...")
            value = client.read_analog_output(0, variation)  # Point 0 = AO,000
            
            if value is not None:
                print(f"✅ Successfully read AO,000 = {value} (variation {variation})")
                break
            else:
                print(f"❌ Failed to read with variation {variation}")
        
        # Keep connection alive for a moment to test continuous reading
        print("\n📊 Continuous reading test (5 readings)...")
        for i in range(5):
            time.sleep(1)
            value = client.read_analog_output(0, 1)  # Use variation 1 (most common)
            if value is not None:
                print(f"Reading {i+1}: AO,000 = {value}")
            else:
                print(f"Reading {i+1}: Failed to read AO,000")
    
    except KeyboardInterrupt:
        print("\n⏹️ Interrupted by user")
    except Exception as e:
        print(f"❌ Error during operation: {e}")
    finally:
        client.disconnect()
        print("🔌 Disconnected")

if __name__ == "__main__":
    main()
