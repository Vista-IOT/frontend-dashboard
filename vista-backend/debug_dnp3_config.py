#!/usr/bin/env python3
import sys
import os
sys.path.append('/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend')

import yaml
from app.services.config_loader import load_latest_config

def debug_dnp3_config():
    print("=== DNP3 Configuration Debug ===")
    
    # Load the configuration
    try:
        config = load_latest_config()
        print("✅ Configuration loaded successfully")
    except Exception as e:
        print(f"❌ Error loading configuration: {e}")
        return
    
    # Check io_setup
    io_setup = config.get('io_setup', {})
    ports = io_setup.get('ports', [])
    print(f"📡 Found {len(ports)} ports in configuration")
    
    dnp3_devices_found = 0
    
    for i, port in enumerate(ports):
        port_name = port.get('name', f'Port{i}')
        port_enabled = port.get('enabled', False)
        devices = port.get('devices', [])
        
        print(f"\n🔌 Port: {port_name} (enabled: {port_enabled}, devices: {len(devices)})")
        
        if not port_enabled:
            print("   ⚠️  Port is disabled - skipping devices")
            continue
            
        for j, device in enumerate(devices):
            device_name = device.get('name', f'Device{j}')
            device_type = device.get('deviceType', 'Unknown')
            device_enabled = device.get('enabled', False)
            tags = device.get('tags', [])
            
            print(f"   📱 Device: {device_name}")
            print(f"      Type: '{device_type}' (lowercase: '{device_type.lower()}')")
            print(f"      Enabled: {device_enabled}")
            print(f"      Tags: {len(tags)}")
            
            if device_type.lower() in ['dnp3.0', 'dnp-3']:
                dnp3_devices_found += 1
                print(f"      🎯 DNP3 DEVICE FOUND!")
                print(f"      IP: {device.get('dnp3IpAddress', 'N/A')}")
                print(f"      Port: {device.get('dnp3PortNumber', 'N/A')}")
                
                # Check tags
                for tag in tags:
                    tag_name = tag.get('name', 'Unknown')
                    address = tag.get('address', 'N/A')
                    print(f"         🏷️  Tag: {tag_name} -> {address}")
    
    print(f"\n📊 Summary: Found {dnp3_devices_found} DNP3 device(s)")
    
    if dnp3_devices_found == 0:
        print("❌ No DNP3 devices found in configuration!")
        print("   This explains why DNP3 polling is not running.")
    else:
        print("✅ DNP3 devices are configured properly")

if __name__ == "__main__":
    debug_dnp3_config()
