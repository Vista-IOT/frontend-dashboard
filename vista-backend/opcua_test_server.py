#!/usr/bin/env python3
import asyncio
import logging
import random
from datetime import datetime
from asyncua import ua, Server


async def main():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("opcua.test.server")

    server = Server()

    url = "opc.tcp://localhost:4840/freeopcua/server/"
    await server.init()
    server.set_endpoint(url)
    server.set_server_name("OPC UA Test Server")
    server.set_security_policy([ua.SecurityPolicyType.NoSecurity])

    namespace = "http://opcua.testserver.com"
    idx = await server.register_namespace(namespace)

    objects = server.nodes.objects
    test_folder = await objects.add_folder(idx, "TestData")

    # Variables
    temp_var = await test_folder.add_variable(idx, "Temperature", 25.0)
    pressure_var = await test_folder.add_variable(idx, "Pressure", 101.3)
    alarm_var = await test_folder.add_variable(idx, "AlarmStatus", False)
    status_var = await test_folder.add_variable(idx, "SystemStatus", "Running")
    counter_var = await test_folder.add_variable(idx, "Counter", 0)
    timestamp_var = await test_folder.add_variable(idx, "LastUpdate", datetime.now())

    for v in [temp_var, pressure_var, alarm_var, status_var, counter_var, timestamp_var]:
        await v.set_writable()

    # Sensors
    sensor_folder = await test_folder.add_folder(idx, "Sensors")
    sensors = {}
    for i in range(1, 6):
        sensor_value = await sensor_folder.add_variable(idx, f"Sensor{i}_Value", random.uniform(0, 100))
        sensor_enabled = await sensor_folder.add_variable(idx, f"Sensor{i}_Enabled", True)
        await sensor_value.set_writable()
        await sensor_enabled.set_writable()
        sensors[i] = {"value": sensor_value, "enabled": sensor_enabled}

    async with server:
        print("=" * 60)
        print("OPC UA Test Server Started Successfully!")
        print("=" * 60)
        print(f"Server URL: {url}")
        print(f"Namespace Index: {idx}")
        print(f"Namespace URI: {namespace}")
        print("Press Ctrl+C to stop the server")
        print("=" * 60)

        counter = 0
        try:
            while True:
                await asyncio.sleep(2)
                counter += 1
                await counter_var.write_value(counter)
                await timestamp_var.write_value(datetime.now())

                # Only change temp/pressure/status if client hasn't just set them
                current_temp = await temp_var.read_value()
                await temp_var.write_value(current_temp + random.uniform(-0.5, 0.5))

                current_pressure = await pressure_var.read_value()
                await pressure_var.write_value(current_pressure + random.uniform(-0.2, 0.2))

                if counter % 10 == 0:
                    current_alarm = await alarm_var.read_value()
                    await alarm_var.write_value(not current_alarm)

                if counter % 5 == 0:
                    await status_var.write_value(random.choice(["Running", "Processing", "Standby", "Active"]))

                # Sensors
                for s in sensors.values():
                    enabled = await s["enabled"].read_value()
                    if enabled:
                        cur_val = await s["value"].read_value()
                        await s["value"].write_value(cur_val + random.uniform(-1, 1))

                logger.info(f"Updated values - Counter: {counter}, Temp: {await temp_var.read_value():.1f}°C")

        except asyncio.CancelledError:
            print("\nShutting down server...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")
