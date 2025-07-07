import re

# Read the file
with open('src/vista_iot/hardware/detection.py', 'r') as f:
    lines = f.readlines()

# Find and fix the problematic line (around line 235)
for i, line in enumerate(lines):
    if "pnp_device.DeviceID.split" in line and "f\"SELECT" in line:
        # Replace the problematic f-string
        lines[i-1] = "                        device_id_part = pnp_device.DeviceID.split(chr(92))[1]\n"
        lines[i] = "                            f\"SELECT * FROM Win32_PnPEntity WHERE DeviceID='{device_id_part}'\"\n"
        break

# Write back to file
with open('src/vista_iot/hardware/detection.py', 'w') as f:
    f.writelines(lines)

print("Fixed f-string syntax error in detection.py")
