#!/usr/bin/env python3
"""
Simple OPC UA Test Server (asyncua version)
Creates a test server with various data types for testing applications
"""

import asyncio
import logging
import random
from datetime import datetime
from asyncua import ua, Server


async def main():
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("opcua.test.server")

    # Create server instance
    server = Server()

    # Set server endpoint
    url = "opc.tcp://localhost:4840/freeopcua/server/"
    await server.init()
    server.set_endpoint(url)

    # Set server name
    server.set_server_name("OPC UA Test Server")

    # Set security policy (None for testing)
    server.set_security_policy([ua.SecurityPolicyType.NoSecurity])

    # Create a new namespace for our server
    namespace = "http://opcua.testserver.com"
    idx = await server.register_namespace(namespace)

    # Get Objects node - this is where we'll add our custom nodes
    objects = server.nodes.objects

    # Create a folder for our test data
    test_folder = await objects.add_folder(idx, "TestData")

    # Add different types of variables for testing
    temp_var = await test_folder.add_variable(idx, "Temperature", 25.0)
    await temp_var.set_writable()

    pressure_var = await test_folder.add_variable(idx, "Pressure", 101.3)
    await pressure_var.set_writable()

    alarm_var = await test_folder.add_variable(idx, "AlarmStatus", False)
    await alarm_var.set_writable()

    status_var = await test_folder.add_variable(idx, "SystemStatus", "Running")
    await status_var.set_writable()

    counter_var = await test_folder.add_variable(idx, "Counter", 0)
    await counter_var.set_writable()

    timestamp_var = await test_folder.add_variable(idx, "LastUpdate", datetime.now())
    await timestamp_var.set_writable()

    # Create a sensor simulation folder
    sensor_folder = await test_folder.add_folder(idx, "Sensors")

    # Add multiple sensor readings
    sensors = {}
    for i in range(1, 6):
        sensor_name = f"Sensor{i}"
        sensor_value = await sensor_folder.add_variable(idx, f"{sensor_name}_Value", random.uniform(0, 100))
        await sensor_value.set_writable()
        sensor_enabled = await sensor_folder.add_variable(idx, f"{sensor_name}_Enabled", True)
        await sensor_enabled.set_writable()
        sensors[sensor_name] = {"value": sensor_value, "enabled": sensor_enabled}

    # Start the server
    async with server:
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

        counter = 0
        try:
            while True:
                await asyncio.sleep(2)

                counter += 1
                await counter_var.write_value(counter)

                # Simulate temperature fluctuation
                temp_value = 25.0 + random.uniform(-5, 5)
                await temp_var.write_value(temp_value)

                # Simulate pressure changes
                pressure_value = 101.3 + random.uniform(-2, 2)
                await pressure_var.write_value(pressure_value)

                # Toggle alarm occasionally
                if counter % 10 == 0:
                    current_alarm = await alarm_var.read_value()
                    await alarm_var.write_value(not current_alarm)

                # Update timestamp
                await timestamp_var.write_value(datetime.now())

                # Update sensor values
                for sensor_name, sensor_data in sensors.items():
                    enabled = await sensor_data["enabled"].read_value()
                    if enabled:
                        new_value = random.uniform(0, 100)
                        await sensor_data["value"].write_value(new_value)

                # Update status
                status_messages = ["Running", "Processing", "Standby", "Active"]
                if counter % 5 == 0:
                    await status_var.write_value(random.choice(status_messages))

                logger.info(f"Updated values - Counter: {counter}, Temp: {temp_value:.1f}°C")

        except asyncio.CancelledError:
            print("\nShutting down server...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")
