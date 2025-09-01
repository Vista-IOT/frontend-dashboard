#!/usr/bin/env python3
import yaml

def check_dnp3_in_config():
    print("=== Simple DNP3 Configuration Check ===")
    
    with open('/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend/config/deployed_config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    
    io_setup = config.get('io_setup', {})
    ports = io_setup.get('ports', [])
    
    print(f"📡 Found {len(ports)} ports")
    
    for port in ports:
        port_name = port.get('name', 'Unknown')
        port_enabled = port.get('enabled', False)
        devices = port.get('devices', [])
        
        print(f"\n🔌 Port: {port_name} (enabled: {port_enabled})")
        
        if not port_enabled:
            print("   ⚠️  Port disabled")
            continue
            
        for device in devices:
            device_type = device.get('deviceType', '')
            device_name = device.get('name', 'Unknown')
            device_enabled = device.get('enabled', False)
            
            print(f"   📱 {device_name}: {device_type} (enabled: {device_enabled})")
            
            if device_type.lower() in ['dnp3.0', 'dnp-3']:
                print(f"      🎯 THIS IS A DNP3 DEVICE!")
                print(f"      IP: {device.get('dnp3IpAddress')}")
                print(f"      Tags: {len(device.get('tags', []))}")

if __name__ == "__main__":
    check_dnp3_in_config()
