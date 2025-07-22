from pymodbus.client import ModbusTcpClient
import struct

# Replace '10.0.0.1' with your Advantech board's Ethernet IP
client = ModbusTcpClient('10.0.0.1', port=502)

# Connect to the Modbus TCP server
if not client.connect():
    print("Failed to connect to Modbus server")
    exit(1)

# Read holding registers from 40001 (address 0) to 40012 (address 11)
# 6 tags * 2 registers = 12 registers
response = client.read_holding_registers(address=0, count=12, slave=180)

if response.isError():
    print("Error reading registers:", response)
else:
    registers = response.registers
    print("Raw Registers:", registers)

    # Helper function to convert 2 registers to a float (32 bits)
    def to_float(high, low):
        packed = struct.pack('>HH', high, low)  # Big-endian
        return struct.unpack('>f', packed)[0]

    # Convert values for all tags
    current = to_float(registers[0], registers[1])     # 40001
    voltage = to_float(registers[2], registers[3])     # 40003
    my_tag = to_float(registers[4], registers[5])      # 40005
    my_tag_2 = to_float(registers[6], registers[7])    # 40007
    multiply = to_float(registers[8], registers[9])    # 40009
    calculation_test = to_float(registers[10], registers[11])  # 40011

    # Print results
    print(f"MFM1:Current        = {current}")
    print(f"MFM1:Voltage        = {voltage}")
    print(f"my_tag              = {my_tag}")
    print(f"My_tag_2            = {my_tag_2}")
    print(f"multiply            = {multiply}")
    print(f"Calculation_test    = {calculation_test}")

# Close connection
client.close()
