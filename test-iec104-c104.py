#!/usr/bin/env python3
"""
IEC 60870-5-104 client using c104 library to test the Data-Service IEC-104 server
"""
import c104
import time
import sys

def test_iec104_with_c104(host='127.0.0.1', port=2404, duration=10):
    """Test IEC-104 server using c104 client library"""
    print(f"🔌 Connecting to IEC-104 server at {host}:{port}...")
    
    received_data = {}
    connection_established = False
    
    # Create client
    client = c104.Client()
    connection = client.add_connection(ip=host, port=port, init=c104.Init.INTERROGATION)
    
    def on_state_change(connection: c104.Connection, state: c104.ConnectionState):
        """Callback for connection state changes"""
        nonlocal connection_established
        print(f"🔗 Connection state: {state}")
        if state == c104.ConnectionState.OPEN_MUTED:
            connection_established = True
            print("✅ Connection established!")
    
    # Register callback
    connection.on_state_change(callable=on_state_change)
    
    try:
        # Start client
        client.start()
        print(f"⏳ Waiting for connection and data ({duration} seconds)...")
        
        start_time = time.time()
        last_check = start_time
        
        while time.time() - start_time < duration:
            time.sleep(0.5)
            
            # Periodically check for points
            if time.time() - last_check >= 2.0:
                # Get all stations
                stations = connection.stations
                if stations:
                    for station in stations:
                        points = station.points
                        if points:
                            for point in points:
                                ioa = point.io_address
                                value = point.value
                                
                                if ioa not in received_data or received_data[ioa]['value'] != value:
                                    print(f"📊 IOA {ioa}: Value={value}, Type={point.type}")
                                    received_data[ioa] = {
                                        'value': value,
                                        'type': str(point.type),
                                        'timestamp': time.time()
                                    }
                last_check = time.time()
        
        # Display results
        print("\n" + "="*60)
        print("📈 RECEIVED DATA SUMMARY")
        print("="*60)
        
        if received_data:
            for ioa, data in sorted(received_data.items()):
                print(f"IOA {ioa:3d}: {data['value']:>10.2f} | Type: {data['type']}")
        else:
            print("⚠️  No data received from server")
            if not connection_established:
                print("⚠️  Connection was not established")
        
        print("="*60)
        
        return received_data
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {}
    finally:
        # Cleanup
        client.stop()
        print("\n🔌 Connection closed")

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 2404
    
    print("="*60)
    print("IEC 60870-5-104 Client Test (c104)")
    print("="*60)
    
    data = test_iec104_with_c104(host, port)
    
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
            match = abs(actual_value - expected_value) < 0.1  # Allow small float difference
            status = "✅" if match else "❌"
            print(f"{status} IOA {ioa}: Expected {expected_value}, Got {actual_value:.2f}")
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
