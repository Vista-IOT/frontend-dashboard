#!/usr/bin/env python3
"""
Discover what DNP3 points are available in the Docker container
"""
import sys
sys.path.insert(0, '/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend')

from app.services.dnp3_service import DNP3DeviceConfig, dnp3_service
import logging

logging.basicConfig(level=logging.INFO)

def discover_docker_points():
    """Try to discover what points are available in Docker container"""
    
    print("🔍 DISCOVERING DOCKER DNP3 POINTS")
    print("="*50)
    
    device_config = DNP3DeviceConfig({
        'name': 'DockerTest',
        'dnp3IpAddress': '127.0.0.1',
        'dnp3PortNumber': 20002,
        'dnp3LocalAddress': 1,
        'dnp3RemoteAddress': 4,
        'dnp3TimeoutMs': 5000,
        'dnp3Retries': 2
    })
    
    # Test different point types and indices
    test_cases = [
        # Analog Inputs
        ("AI", 0), ("AI", 1), ("AI", 2), ("AI", 3), ("AI", 4),
        # Analog Outputs  
        ("AO", 0), ("AO", 1), ("AO", 2), ("AO", 3), ("AO", 4),
        # Binary Inputs
        ("BI", 0), ("BI", 1), ("BI", 2), ("BI", 3), ("BI", 4),
        # Binary Outputs
        ("BO", 0), ("BO", 1), ("BO", 2), ("BO", 3), ("BO", 4),
    ]
    
    successful_points = []
    
    for point_type, index in test_cases:
        tag_config = {
            'address': f'{point_type}.{index:03d}',
            'name': f'Test {point_type} {index}',
            'scale': 1,
            'offset': 0
        }
        
        print(f"Testing {point_type}.{index:03d}... ", end="")
        value, error = dnp3_service.read_tag_value(device_config, tag_config)
        
        if value is not None:
            print(f"✅ {value}")
            successful_points.append(f"{point_type}.{index:03d}")
        else:
            print(f"❌ {error}")
    
    print("\n" + "="*50)
    print("📋 DISCOVERY RESULTS:")
    if successful_points:
        print("✅ Working points found:")
        for point in successful_points:
            print(f"   - {point}")
        print(f"\n🎉 Total: {len(successful_points)} points discovered")
    else:
        print("❌ No working points found")
        print("   This suggests the Docker container might:")
        print("   - Be configured for different addresses")
        print("   - Require different DNP3 parameters")
        print("   - Have a different object structure")
    
    return successful_points

if __name__ == "__main__":
    discover_docker_points()
