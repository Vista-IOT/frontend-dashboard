#!/usr/bin/env python3
"""
Analyze the Advantech response to understand the CRC issue
"""
import sys
sys.path.insert(0, '/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend')

from app.services.dnp3_service import calculate_crc

def analyze_response():
    """Analyze the actual Advantech response"""
    
    # Raw response from Advantech: 05 64 05 49 03 00 04 00 c9 10
    response = bytes([0x05, 0x64, 0x05, 0x49, 0x03, 0x00, 0x04, 0x00, 0xc9, 0x10])
    
    print("🔍 ANALYZING ADVANTECH RESPONSE")
    print("="*40)
    
    print(f"Raw response: {' '.join(f'{b:02x}' for b in response)}")
    
    # Parse header
    start = response[0:2]
    length = response[2]
    control = response[3]
    dest = int.from_bytes(response[4:6], 'little')
    src = int.from_bytes(response[6:8], 'little')
    received_crc = int.from_bytes(response[8:10], 'little')
    
    print(f"Start: {start.hex()}")
    print(f"Length: {length}")
    print(f"Control: 0x{control:02x}")
    print(f"Dest: {dest}")
    print(f"Src: {src}")
    print(f"Received CRC: 0x{received_crc:04x}")
    
    # Calculate what the CRC should be
    header_data = response[2:8]  # length through src
    calculated_crc = calculate_crc(header_data)
    
    print(f"Header data for CRC: {' '.join(f'{b:02x}' for b in header_data)}")
    print(f"Calculated CRC: 0x{calculated_crc:04x}")
    
    if calculated_crc == received_crc:
        print("✅ CRC matches! Our CRC calculation is correct.")
        print("✅ The Advantech device is sending valid frames.")
        print("🔍 Issue is: device is only sending LINK LAYER responses")
        print("🔍 Means: Advantech doesn't understand our APPLICATION requests")
    else:
        print("❌ CRC mismatch!")
        print("❌ Either our CRC calc is wrong OR Advantech uses different CRC")
    
    # Check if this is just a link-layer response (no app data)
    if length == 5:
        print("\n🎯 DIAGNOSIS:")
        print("   This is a LINK LAYER ONLY response")
        print("   Length=5 means: 1(transport) + 2(app_ctl+func) + 2(min_app) = NO REAL APP DATA")
        print("   The Advantech device is acknowledging our link but not processing app requests")
        
    return calculated_crc == received_crc

if __name__ == "__main__":
    analyze_response()
