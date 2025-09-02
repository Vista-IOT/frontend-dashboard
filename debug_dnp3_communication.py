#!/usr/bin/env python3
"""
Debug script to test DNP3 communication with detailed logging
"""
import socket
import struct
import time

def calculate_crc(data: bytes) -> int:
    """DNP3 CRC-16 (poly 0xA6BC, reflected, init 0xFFFF)."""
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ 0xA6BC
            else:
                crc >>= 1
    return crc & 0xFFFF

def _add_block_crc(payload: bytes) -> bytes:
    """Append CRC every 16 bytes of payload."""
    out = bytearray()
    for i in range(0, len(payload), 16):
        block = payload[i:i + 16]
        out.extend(block)
        out.extend(struct.pack('<H', calculate_crc(block)))
    return bytes(out)

def hex_dump(data: bytes, prefix: str = ""):
    """Print binary data as a hex dump."""
    if not data:
        print(f"{prefix}[EMPTY]")
        return
    
    hex_str = ' '.join(f'{b:02x}' for b in data)
    ascii_str = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in data)
    
    print(f"{prefix}Hex ({len(data)} bytes): {hex_str}")
    print(f"{prefix}ASCII: {ascii_str}")

def create_dnp3_read_frame(point_index=0):
    """Create a DNP3 read request frame for AI.xxx (Analog Input)"""
    
    # Application layer: Read AI.xxx (Group 30, Variation 1)
    app_control = 0xC1  # FIR=1, FIN=1, CON=0, UNS=0, SEQ=1
    function = 0x01     # READ
    group = 30          # Analog Input
    variation = 1       # 32-bit values
    qualifier = 0x17    # 16-bit start/stop
    start_index = point_index
    stop_index = point_index
    
    apdu = struct.pack('<BBBBBHH', app_control, function, group, variation, qualifier, start_index, stop_index)
    
    # Transport layer: Single fragment
    transport = 0xC1    # FIR=1, FIN=1, SEQ=1
    payload = bytes([transport]) + apdu
    
    # Link layer header
    start_bytes = b'\x05\x64'
    length = len(payload) + 5  # payload + 5 bytes for addresses and control
    control = 0xC4    # Primary, confirmed user data
    dest = 4          # Remote address (device)
    src = 3           # Local address (master)
    
    header_without_crc = start_bytes + struct.pack('<BBHH', length, control, dest, src)
    header_crc = calculate_crc(header_without_crc[2:8])
    header = header_without_crc + struct.pack('<H', header_crc)
    
    # Add block CRCs to payload
    payload_with_crc = _add_block_crc(payload)
    
    frame = header + payload_with_crc
    return frame

def test_with_tcpdump():
    """Test with network packet capture"""
    import subprocess
    import threading
    
    print("🕵️ Starting packet capture...")
    
    # Start tcpdump in background
    tcpdump_cmd = [
        "sudo", "tcpdump", "-i", "any", "-X", "-s", "0", 
        f"host 10.0.0.1 and port 20000"
    ]
    
    try:
        tcpdump_proc = subprocess.Popen(
            tcpdump_cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Give tcpdump time to start
        time.sleep(1)
        
        # Perform the DNP3 test
        print("\n" + "="*60)
        test_dnp3_communication()
        print("="*60)
        
        # Let tcpdump capture for a bit more
        time.sleep(2)
        
        # Stop tcpdump
        tcpdump_proc.terminate()
        stdout, stderr = tcpdump_proc.communicate(timeout=5)
        
        print(f"\n📊 Network packet capture:")
        print("="*60)
        if stdout:
            print(stdout)
        if stderr:
            print(f"STDERR: {stderr}")
            
    except Exception as e:
        print(f"❌ Error with tcpdump: {e}")
        print("💡 Try running the script with sudo or install tcpdump")
        
        # Fallback to basic test
        print("\n🔄 Falling back to basic test...")
        test_dnp3_communication()

def test_dnp3_communication():
    """Test DNP3 communication with detailed logging"""
    
    host = "10.0.0.1"
    port = 20000
    timeout = 15.0
    
    print(f"🔍 Testing DNP3 communication with {host}:{port}")
    print(f"⏱️ Timeout: {timeout}s")
    
    try:
        # Create socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.settimeout(timeout)
        
        print(f"\n📡 Connecting to {host}:{port}...")
        start_time = time.time()
        sock.connect((host, port))
        connect_time = time.time() - start_time
        print(f"✅ Connected successfully in {connect_time:.3f}s")
        
        # Test multiple point indices
        for point_index in [0, 8]:  # Test both AI.000 and AI.008
            print(f"\n" + "="*50)
            print(f"🔍 Testing AI.{point_index:03d}")
            print("="*50)
            
            # Create and send DNP3 frame
            frame = create_dnp3_read_frame(point_index)
            print(f"\n🔼 Sending DNP3 read request for AI.{point_index:03d}:")
            hex_dump(frame, "TX: ")
            
            print(f"\n📤 Sending {len(frame)} bytes...")
            send_start = time.time()
            sock.sendall(frame)
            send_time = time.time() - send_start
            print(f"✅ Sent successfully in {send_time:.3f}s")
            
            # Try to receive response
            print(f"\n⏳ Waiting for response...")
            recv_start = time.time()
            
            try:
                response = sock.recv(4096)
                recv_time = time.time() - recv_start
                
                if response:
                    print(f"\n🔽 Received response in {recv_time:.3f}s:")
                    hex_dump(response, "RX: ")
                    
                    # Try to parse basic DNP3 structure
                    if len(response) >= 10:
                        if response[0] == 0x05 and response[1] == 0x64:
                            length = response[2]
                            control = response[3]
                            dest = struct.unpack('<H', response[4:6])[0]
                            src = struct.unpack('<H', response[6:8])[0]
                            print(f"\n📋 DNP3 Frame Analysis:")
                            print(f"   Length: {length}")
                            print(f"   Control: 0x{control:02x}")
                            print(f"   Destination: {dest}")
                            print(f"   Source: {src}")
                            
                            if len(response) > 10:
                                payload = response[10:]
                                print(f"   Payload: {len(payload)} bytes")
                                hex_dump(payload, "   Payload: ")
                                print(f"   ✅ Valid DNP3 frame structure!")
                            else:
                                print(f"   ⚠️ Header-only frame (no payload)")
                        else:
                            print(f"❌ Invalid DNP3 start bytes: 0x{response[0]:02x} 0x{response[1]:02x}")
                    else:
                        print(f"❌ Response too short: {len(response)} bytes")
                        
                    # Wait a bit between requests
                    time.sleep(1)
                    
                else:
                    print("❌ Empty response received")
                    
            except socket.timeout:
                recv_time = time.time() - recv_start
                print(f"⏱️ Timeout after {recv_time:.3f}s - no response received")
                break  # Don't try more points if we're getting timeouts
                
            except Exception as e:
                recv_time = time.time() - recv_start
                print(f"❌ Error receiving response after {recv_time:.3f}s: {e}")
                break
        
    except socket.timeout:
        print(f"⏱️ Connection timeout after {timeout}s")
    except ConnectionRefused:
        print(f"❌ Connection refused - no service listening on {host}:{port}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    finally:
        try:
            sock.close()
            print(f"\n🔌 Socket closed")
        except:
            pass

if __name__ == "__main__":
    print("🚀 DNP3 Communication Debug Script")
    print("="*60)
    
    # First try basic test
    test_dnp3_communication()
    
    # Then try with packet capture if available
    print(f"\n\n💡 For more detailed analysis, you can also run:")
    print(f"   sudo tcpdump -i any -X -s 0 'host 10.0.0.1 and port 20000'")
    print(f"   (in another terminal while running this script)")
