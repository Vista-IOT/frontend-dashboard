#!/usr/bin/env python3

import sys
import os
sys.path.append('vista-backend')

from app.services.dnp3_service import DNP3DeviceConfig, DNP3Client
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def test_new_simulator():
    # Configure for new Docker simulator
    device_config_dict = {
        'name': 'New-Docker-Sim',
        'dnp3IpAddress': 'localhost',
        'dnp3PortNumber': 20003,  # New simulator port
        'dnp3LocalAddress': 1,
        'dnp3RemoteAddress': 10,   # Simulator uses address 10
        'dnp3TimeoutMs': 5000,
        'dnp3Retries': 3
    }
    
    try:
        config = DNP3DeviceConfig(device_config_dict)
        client = DNP3Client(config)
        
        print(f"🧪 Testing NEW DNP3 simulator with dummy data:")
        print(f"   - AI.008 should return 255.0")
        print(f"   - AO.000 should return 0.0")
        
        # Test the specific points you need
        test_points = [
            ("AI", 8),   # Should return 255.0
            ("AO", 0),   # Should return 0.0 (proving zero values work)
            ("AI", 0),   # Should return 42.5
            ("AO", 1),   # Should return 10.5
        ]
        
        for point_type, index in test_points:
            print(f"\n🧪 Testing {point_type}.{index:03d}")
            value, error = client.read_point(point_type, index)
            if value is not None:
                print(f"✅ SUCCESS: {point_type}.{index:03d} = {value}")
            else:
                print(f"❌ Failed: {error}")
                
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    test_new_simulator()
