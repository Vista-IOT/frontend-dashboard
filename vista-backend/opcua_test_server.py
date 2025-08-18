#!/usr/bin/env python3
"""
Simple OPC UA Test Server
Creates a test server with various data types for testing applications
"""

import time
import logging
from opcua import Server, ua
import random
from datetime import datetime

def main():
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("opcua.test.server")
    
    # Create server instance
    server = Server()
    
    # Set server endpoint
    url = "opc.tcp://localhost:4840/freeopcua/server/"
    server.set_endpoint(url)
    
    # Set server name
    server.set_server_name("OPC UA Test Server")
    
    # Set security policy (None for testing)
    server.set_security_policy([ua.SecurityPolicyType.NoSecurity])
    
    # Get Objects node - this is where we'll add our custom nodes
    objects = server.get_objects_node()
    
    # Create a new namespace for our server
    namespace = "http://opcua.testserver.com"
    idx = server.register_namespace(namespace)
    
    # Create a folder for our test data
    test_folder = objects.add_folder(idx, "TestData")
    
    # Add different types of variables for testing
    
    # 1. Integer variables
    temp_var = test_folder.add_variable(idx, "Temperature", 25.0)
    temp_var.set_writable()
    
    pressure_var = test_folder.add_variable(idx, "Pressure", 101.3)
    pressure_var.set_writable()
    
    # 2. Boolean variable
    alarm_var = test_folder.add_variable(idx, "AlarmStatus", False)
    alarm_var.set_writable()
    
    # 3. String variable
    status_var = test_folder.add_variable(idx, "SystemStatus", "Running")
    status_var.set_writable()
    
    # 4. Counter variable
    counter_var = test_folder.add_variable(idx, "Counter", 0)
    counter_var.set_writable()
    
    # 5. Timestamp variable
    timestamp_var = test_folder.add_variable(idx, "LastUpdate", datetime.now())
    timestamp_var.set_writable()
    
    # Create a sensor simulation folder
    sensor_folder = test_folder.add_folder(idx, "Sensors")
    
    # Add multiple sensor readings
    sensors = {}
    for i in range(1, 6):
        sensor_name = f"Sensor{i}"
        sensor_value = sensor_folder.add_variable(idx, f"{sensor_name}_Value", random.uniform(0, 100))
        sensor_value.set_writable()
        sensor_enabled = sensor_folder.add_variable(idx, f"{sensor_name}_Enabled", True)
        sensor_enabled.set_writable()
        sensors[sensor_name] = {"value": sensor_value, "enabled": sensor_enabled}
    
    # Start the server
    try:
        server.start()
        print("=" * 60)
        print("OPC UA Test Server Started Successfully!")
        print("=" * 60)
        print(f"Server URL: {url}")
        print(f"Namespace Index: {idx}")
        print(f"Namespace URI: {namespace}")
        print()
        print("Available Test Nodes:")
        print("- TestData/Temperature (Double)")
        print("- TestData/Pressure (Double)")
        print("- TestData/AlarmStatus (Boolean)")
        print("- TestData/SystemStatus (String)")
        print("- TestData/Counter (Integer)")
        print("- TestData/LastUpdate (DateTime)")
        print("- TestData/Sensors/Sensor1_Value to Sensor5_Value (Double)")
        print("- TestData/Sensors/Sensor1_Enabled to Sensor5_Enabled (Boolean)")
        print()
        print("Connection Details for Your Application:")
        print(f"- Endpoint URL: {url}")
        print("- Security Policy: None")
        print("- Security Mode: None")
        print("- Username: (not required)")
        print("- Password: (not required)")
        print()
        print("Press Ctrl+C to stop the server")
        print("=" * 60)
        
        # Simulate data changes
        counter = 0
        while True:
            time.sleep(2)
            
            # Update values to simulate real sensor data
            counter += 1
            counter_var.set_value(counter)
            
            # Simulate temperature fluctuation
            temp_value = 25.0 + random.uniform(-5, 5)
            temp_var.set_value(temp_value)
            
            # Simulate pressure changes
            pressure_value = 101.3 + random.uniform(-2, 2)
            pressure_var.set_value(pressure_value)
            
            # Toggle alarm occasionally
            if counter % 10 == 0:
                current_alarm = alarm_var.get_value()
                alarm_var.set_value(not current_alarm)
            
            # Update timestamp
            timestamp_var.set_value(datetime.now())
            
            # Update sensor values
            for sensor_name, sensor_data in sensors.items():
                if sensor_data["enabled"].get_value():
                    new_value = random.uniform(0, 100)
                    sensor_data["value"].set_value(new_value)
            
            # Update status
            status_messages = ["Running", "Processing", "Standby", "Active"]
            if counter % 5 == 0:
                status_var.set_value(random.choice(status_messages))
            
            logger.info(f"Updated values - Counter: {counter}, Temp: {temp_value:.1f}°C")
            
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.stop()
        print("Server stopped.")

if __name__ == "__main__":
    main()
