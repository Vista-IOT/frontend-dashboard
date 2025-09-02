#!/usr/bin/env python3

import sys
import os
sys.path.append('vista-backend')

from app.services.dnp3_service import DNP3DeviceConfig, DNP3Client
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def test_ao_points():
    # Configure for new Docker simulator
    device_config_dict = {
        'name': 'Docker-Sim-AO-Test',
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
        
        print(f"🔍 Testing ALL AO points (AO.000-008) from Docker simulator:")
        print(f"   Expected values: AO.000=0.0, AO.001=10.5, AO.002=20.2, etc.")
        
        # Test all AO points 
        for index in range(9):  # AO.000 through AO.008
            print(f"\n🧪 Testing AO.{index:03d}")
            value, error = client.read_point("AO", index)
            if value is not None:
                print(f"✅ SUCCESS: AO.{index:03d} = {value}")
                if value == 0.0:
                    print(f"   📌 ZERO VALUE CONFIRMED for AO.{index:03d}")
            else:
                print(f"❌ FAILED: AO.{index:03d} - {error}")
                
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    test_ao_points()
