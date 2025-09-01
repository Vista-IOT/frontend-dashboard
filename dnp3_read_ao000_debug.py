#!/usr/bin/env python3
"""
Enhanced DNP3 client script to read AO,000 from Advantech EdgeLink
With better debugging and simpler request format
"""

import socket
import struct
import time
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
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

class SimpleDNP3Client:
    def __init__(self, ip_address, port=20000, local_addr=1, remote_addr=4, timeout=3.0):
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
    
    def create_class0_read_request(self):
        """Create a DNP3 read request for Class 0 (all static data)"""
        self.sequence = (self.sequence + 1) % 16
        
        # Application Control Field
        app_control = 0xC0 | self.sequence
        
        # Application header
        app_header = struct.pack('<BB', app_control, DNP3_FUNC_READ)
        
        # Object header for Class 0 read (all static data)
        obj_header = struct.pack('<BBB', 60, 1, 0x06)  # Group 60, Variation 1, Qualifier 0x06 (no range)
        
        # Complete application data
        app_data = app_header + obj_header
        
        # Data Link Header
        length = 5 + len(app_data)
        control = 0xC4  # Unconfirmed user data, from master
        
        dl_header = struct.pack('<BBBBBBBB',
            0x05, 0x64,           # Start bytes
            length,               # Length
            control,              # Control
            self.remote_addr,     # Destination (outstation)
            0x00,                 # Destination high byte
            self.local_addr,      # Source (master)
            0x00                  # Source high byte
        )
        
        # Calculate CRCs
        header_crc = calculate_crc16(dl_header[2:8])
        app_crc = calculate_crc16(app_data)
        
        # Assemble frame
        frame = dl_header + struct.pack('<H', header_crc) + app_data + struct.pack('<H', app_crc)
        
        return frame
    
    def create_ao_read_request(self, point_index=0):
        """Create DNP3 read request specifically for analog output point"""
        self.sequence = (self.sequence + 1) % 16
        
        # Application Control Field
        app_control = 0xC0 | self.sequence
        
        # Application header
        app_header = struct.pack('<BB', app_control, DNP3_FUNC_READ)
        
        # Object header for specific AO point
        obj_header = struct.pack('<BBB', 40, 0, 0x17)  # Group 40, Variation 0, Qualifier 0x17
        obj_header += struct.pack('<BB', point_index, point_index)  # Start and stop index
        
        # Complete application data
        app_data = app_header + obj_header
        
        # Data Link Header
        length = 5 + len(app_data)
        control = 0xC4
        
        dl_header = struct.pack('<BBBBBBBB',
            0x05, 0x64,
            length,
            control,
            self.remote_addr,
            0x00,
            self.local_addr,
            0x00
        )
        
        # Calculate CRCs
        header_crc = calculate_crc16(dl_header[2:8])
        app_crc = calculate_crc16(app_data)
        
        # Assemble frame
        frame = dl_header + struct.pack('<H', header_crc) + app_data + struct.pack('<H', app_crc)
        
        return frame
    
    def send_and_receive(self, frame, description=""):
        """Send DNP3 frame and receive response"""
        try:
            logger.debug(f"Sending {description}: {' '.join(f'{b:02x}' for b in frame)}")
            
            self.socket.send(frame)
            
            # Receive response
            self.socket.settimeout(2.0)
            response = self.socket.recv(1024)
            
            logger.debug(f"Received {len(response)} bytes: {' '.join(f'{b:02x}' for b in response)}")
            
            return response
            
        except socket.timeout:
            logger.warning(f"Timeout waiting for response to {description}")
            return None
        except Exception as e:
            logger.error(f"Error in send_and_receive for {description}: {e}")
            return None
    
    def parse_response(self, response):
        """Parse response to look for any analog output values"""
        if not response or len(response) < 10:
            return None
            
        # Basic validation
        if response[0] != 0x05 or response[1] != 0x64:
            logger.error("Invalid DNP3 response format")
            return None
        
        logger.info(f"Valid DNP3 response received ({len(response)} bytes)")
        
        # Check for any error conditions in the response
        # Application data starts after data link header + CRC (10 bytes)
        if len(response) >= 12:
            app_control = response[10]
            func_code = response[11]
            logger.info(f"App Control: {app_control:02x}, Function Code: {func_code:02x}")
            
            if func_code == 0x81:  # Response
                logger.info("Received valid DNP3 response")
                return "Response received - parsing needed"
            else:
                logger.warning(f"Unexpected function code: {func_code:02x}")
        
        return None

def main():
    """Test reading AO,000 from Advantech EdgeLink"""
    
    DEVICE_IP = "10.0.0.1"
    PORT = 20000
    LOCAL_ADDR = 1
    REMOTE_ADDR = 3
    
    print("DNP3 Client - Reading AO,000 from Advantech EdgeLink")
    print("=" * 50)
    print(f"Target Device: {DEVICE_IP}:{PORT}")
    print(f"Local Address: {LOCAL_ADDR}")
    print(f"Remote Address: {REMOTE_ADDR}")
    print(f"Target Point: AO,000 (Analog Output point 0)")
    print("=" * 50)
    
    client = SimpleDNP3Client(DEVICE_IP, PORT, LOCAL_ADDR, REMOTE_ADDR)
    
    try:
        if not client.connect():
            print("❌ Failed to connect to DNP3 device")
            return
        
        print("✅ Connected to DNP3 device")
        
        # Try Class 0 read first (gets all static data)
        print("\n🔍 Trying Class 0 read (all static data)...")
        class0_frame = client.create_class0_read_request()
        response = client.send_and_receive(class0_frame, "Class 0 read")
        
        if response:
            result = client.parse_response(response)
            if result:
                print(f"✅ Class 0 read successful: {result}")
            else:
                print("❌ Could not parse Class 0 response")
        else:
            print("❌ No response to Class 0 read")
        
        # Try specific AO point read
        print("\n🔍 Trying specific AO,000 read...")
        ao_frame = client.create_ao_read_request(0)
        response = client.send_and_receive(ao_frame, "AO,000 specific read")
        
        if response:
            result = client.parse_response(response)
            if result:
                print(f"✅ AO,000 read successful: {result}")
            else:
                print("❌ Could not parse AO,000 response")
        else:
            print("❌ No response to AO,000 read")
    
    except KeyboardInterrupt:
        print("\n⏹️ Interrupted by user")
    except Exception as e:
        print(f"❌ Error during operation: {e}")
        logger.exception("Full error details:")
    finally:
        client.disconnect()
        print("🔌 Disconnected")

if __name__ == "__main__":
    main()
