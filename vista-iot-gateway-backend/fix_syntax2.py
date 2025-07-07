# Read the file
with open('src/vista_iot/hardware/detection.py', 'r') as f:
    content = f.read()

# Fix the broken code structure
content = content.replace(
    """                        device_id_part = pnp_device.DeviceID.split(chr(92))[1]
                            f"SELECT * FROM Win32_PnPEntity WHERE DeviceID='{device_id_part}'"
                        )""",
    """                        device_id_part = pnp_device.DeviceID.split(chr(92))[1]
                        device_info = c.query(
                            f"SELECT * FROM Win32_PnPEntity WHERE DeviceID='{device_id_part}'"
                        )"""
)

# Write back to file
with open('src/vista_iot/hardware/detection.py', 'w') as f:
    f.write(content)

print("Fixed the code structure")
