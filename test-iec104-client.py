#!/usr/bin/env python3
"""
Simple IEC 60870-5-104 client to test the Data-Service IEC-104 server
"""
import c104
import time
import sys

def test_iec104_connection(host='127.0.0.1', port=2404):
    """Test IEC-104 connection and read values"""
    print(f"🔌 Connecting to IEC-104 server at {host}:{port}...")
    
    # Create client connection
    client = c104.Client(tick_rate_ms=1000, command_timeout_ms=5000)
    connection = client.add_connection(ip=host, port=port, init=c104.Init.INTERROGATION)
    
    # Track received data
    received_data = {}
    
    def on_receive_point(point: c104.Point):
        """Callback when data point is received"""
        ioa = point.io_address
        value = point.value
        type_str = str(point.type)
        quality = point.quality
        
        received_data[ioa] = {
            'value': value,
            'type': type_str,
            'quality': quality.is_good() if hasattr(quality, 'is_good') else True,
            'timestamp': point.processed_at if hasattr(point, 'processed_at') else time.time()
        }
        
        print(f"📊 IOA {ioa}: Value={value}, Type={type_str}, Quality={'GOOD' if (hasattr(quality, 'is_good') and quality.is_good()) else 'OK'}")
    
    def on_connection_state(connection: c104.Connection, state: c104.ConnectionState):
        """Callback for connection state changes"""
        print(f"🔗 Connection state: {state}")
        if state == c104.ConnectionState.OPEN_MUTED:
            print("✅ Connection established, waiting for data...")
    
    # Set callbacks
    connection.on_receive_point(callable=on_receive_point)
    connection.on_state_change(callable=on_connection_state)
    
    try:
        # Start the client
        client.start()
        print("⏳ Waiting for connection and data (10 seconds)...")
        
        # Wait for data
        time.sleep(10)
        
        # Display results
        print("\n" + "="*60)
        print("📈 RECEIVED DATA SUMMARY")
        print("="*60)
        
        if received_data:
            for ioa, data in sorted(received_data.items()):
                print(f"IOA {ioa:3d}: {data['value']:>10} | Type: {data['type']:15s} | Quality: {'✓' if data['quality'] else '✗'}")
        else:
            print("⚠️  No data received from server")
        
        print("="*60)
        
        return received_data
        
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        client.stop()
        print("\n🔌 Connection closed")

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 2404
    
    print("="*60)
    print("IEC 60870-5-104 Client Test")
    print("="*60)
    
    data = test_iec104_connection(host, port)
    
    # Verify expected values
    print("\n🔍 VERIFICATION:")
    expected = {
        2: 40,   # Calctag = rohan10 + rohan20 = 10 + 30
        3: 10,   # rohan10
        4: 30,   # rohan20
    }
    
    all_correct = True
    for ioa, expected_value in expected.items():
        if ioa in data:
            actual_value = data[ioa]['value']
            match = abs(actual_value - expected_value) < 0.01  # Allow small float difference
            status = "✅" if match else "❌"
            print(f"{status} IOA {ioa}: Expected {expected_value}, Got {actual_value}")
            if not match:
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
