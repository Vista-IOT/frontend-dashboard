#!/usr/bin/env python3
"""
Simple IEC 60870-5-104 TCP client to test the Data-Service IEC-104 server
Reads raw TCP frames and decodes IEC-104 ASDU messages
"""
import socket
import struct
import time
import sys

def decode_iec104_frame(data):
    """Decode IEC-104 ASDU frame"""
    if len(data) < 2:
        return None
    
    # Check for IEC-104 start byte
    if data[0] != 0x68:
        return None
    
    length = data[1]
    if len(data) < length + 2:
        return None
    
    # Parse ASDU
    asdu_type = data[2]
    sq = data[3]
    cot = data[4]  # Cause of transmission
    org = data[5]  # Originator address
    asdu_addr = struct.unpack('<H', data[6:8])[0]
    
    # IOA is 3 bytes (24-bit)
    ioa_bytes = data[8:11] + b'\x00'  # Pad to 4 bytes
    ioa = struct.unpack('<I', ioa_bytes)[0]
    
    # Value depends on type
    if asdu_type == 0x09:  # M_ME_NC_1 (short float)
        value = struct.unpack('<f', data[11:15])[0]
    elif asdu_type == 0x0B:  # M_ME_NB_1 (scaled value)
        value = struct.unpack('<h', data[11:13])[0]
    elif asdu_type == 0x0D:  # M_ME_NA_1 (normalized value)
        value = struct.unpack('<h', data[11:13])[0] / 32768.0
    else:
        value = None
    
    return {
        'type': asdu_type,
        'ioa': ioa,
        'value': value,
        'cot': cot,
        'asdu_addr': asdu_addr
    }

def test_iec104_tcp(host='127.0.0.1', port=2404, duration=8):
    """Test IEC-104 server via raw TCP connection"""
    print(f"🔌 Connecting to IEC-104 server at {host}:{port}...")
    
    received_data = {}
    
    try:
        # Create TCP socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2.0)
        sock.connect((host, port))
        print("✅ Connected!")
        
        # Receive STARTDT act
        try:
            startdt = sock.recv(1024)
            if len(startdt) >= 6 and startdt[0] == 0x68:
                print(f"📨 Received STARTDT act: {startdt.hex()}")
        except socket.timeout:
            print("⚠️  No STARTDT received (might be OK)")
        
        print(f"⏳ Listening for data ({duration} seconds)...")
        start_time = time.time()
        
        while time.time() - start_time < duration:
            try:
                data = sock.recv(4096)
                if not data:
                    print("⚠️  Connection closed by server")
                    break
                
                # Try to decode frame
                frame = decode_iec104_frame(data)
                if frame:
                    ioa = frame['ioa']
                    value = frame['value']
                    
                    if ioa not in received_data:
                        print(f"📊 IOA {ioa}: Value={value:.2f if value is not None else 'N/A'}, Type=0x{frame['type']:02x}, COT={frame['cot']}")
                    
                    received_data[ioa] = {
                        'value': value,
                        'type': frame['type'],
                        'cot': frame['cot'],
                        'timestamp': time.time()
                    }
                else:
                    print(f"📦 Raw data: {data.hex()}")
                    
            except socket.timeout:
                continue
            except Exception as e:
                print(f"⚠️  Receive error: {e}")
                break
        
        sock.close()
        
        # Display results
        print("\n" + "="*60)
        print("📈 RECEIVED DATA SUMMARY")
        print("="*60)
        
        if received_data:
            for ioa, data in sorted(received_data.items()):
                value_str = f"{data['value']:.2f}" if data['value'] is not None else "N/A"
                print(f"IOA {ioa:3d}: {value_str:>10} | Type: 0x{data['type']:02x} | COT: {data['cot']}")
        else:
            print("⚠️  No data received from server")
        
        print("="*60)
        
        return received_data
        
    except ConnectionRefusedError:
        print(f"❌ Connection refused. Is the IEC-104 server running on {host}:{port}?")
        return {}
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {}

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 2404
    
    print("="*60)
    print("IEC 60870-5-104 TCP Client Test")
    print("="*60)
    
    data = test_iec104_tcp(host, port)
    
    # Verify expected values
    print("\n🔍 VERIFICATION:")
    expected = {
        2: 40.0,   # Calctag = rohan10 + rohan20 = 10 + 30
        3: 10.0,   # rohan10
        4: 30.0,   # rohan20
    }
    
    all_correct = True
    for ioa, expected_value in expected.items():
        if ioa in data:
            actual_value = data[ioa]['value']
            if actual_value is not None:
                match = abs(actual_value - expected_value) < 0.1  # Allow small float difference
                status = "✅" if match else "❌"
                print(f"{status} IOA {ioa}: Expected {expected_value}, Got {actual_value:.2f}")
                if not match:
                    all_correct = False
            else:
                print(f"❌ IOA {ioa}: Value is None (expected {expected_value})")
                all_correct = False
        else:
            print(f"❌ IOA {ioa}: Not received (expected {expected_value})")
            all_correct = False
    
    if all_correct and len(data) == len(expected):
        print("\n🎉 All values correct!")
        sys.exit(0)
    else:
        print("\n⚠️  Some values incorrect or missing")
        sys.exit(1)
