#!/usr/bin/env python3
"""
Solve the Advantech CRC algorithm based on known data
"""

def solve_advantech_crc():
    """Analyze the specific Advantech CRC case"""
    
    # Known data from Advantech response
    header_data = bytes([0x03, 0x00, 0x04, 0x00])
    expected_crc = 0x10c9
    
    print("🔍 SOLVING ADVANTECH CRC ALGORITHM")
    print("="*50)
    print(f"Header data: {' '.join(f'{b:02x}' for b in header_data)}")
    print(f"Expected CRC: 0x{expected_crc:04x}")
    print("")
    
    # Test a comprehensive set of CRC variants
    def test_crc_comprehensive(data, expected):
        """Test comprehensive CRC variants"""
        
        # Common CRC polynomials
        polynomials = [
            ("DNP3", 0xA6BC),
            ("CRC-16-IBM", 0x8005),
            ("CRC-16-CCITT", 0x1021),
            ("CRC-16-T10", 0x8BB7),
            ("Modbus", 0xA001),
            ("CRC-16-ANSI", 0x8005),
            ("CRC-16-DECT", 0x0589),
            ("CRC-16-DNP-Alt", 0x3D65),
        ]
        
        # Test parameters: (reflect_in, reflect_out, init, xor_out)
        param_sets = [
            (True, True, 0xFFFF, 0x0000),    # Standard DNP3
            (True, True, 0x0000, 0x0000),    # Init 0
            (True, True, 0xFFFF, 0xFFFF),    # XOR out
            (False, False, 0xFFFF, 0x0000),  # No reflection
            (True, False, 0xFFFF, 0x0000),   # Reflect in only
            (False, True, 0xFFFF, 0x0000),   # Reflect out only
        ]
        
        def calc_crc(data, poly, reflect_in, reflect_out, init, xor_out):
            """Generic CRC calculation"""
            crc = init
            
            for byte in data:
                if reflect_in:
                    # Reflect input byte
                    reflected_byte = 0
                    for i in range(8):
                        if byte & (1 << i):
                            reflected_byte |= (1 << (7 - i))
                    byte = reflected_byte
                
                crc ^= byte
                for _ in range(8):
                    if crc & 0x0001:
                        crc = (crc >> 1) ^ poly
                    else:
                        crc >>= 1
            
            if reflect_out:
                # Reflect output
                reflected_crc = 0
                for i in range(16):
                    if crc & (1 << i):
                        reflected_crc |= (1 << (15 - i))
                crc = reflected_crc
            
            return (crc ^ xor_out) & 0xFFFF
        
        found_match = False
        
        for poly_name, poly in polynomials:
            for reflect_in, reflect_out, init, xor_out in param_sets:
                result = calc_crc(data, poly, reflect_in, reflect_out, init, xor_out)
                if result == expected:
                    param_desc = f"in={reflect_in}, out={reflect_out}, init=0x{init:04x}, xor=0x{xor_out:04x}"
                    print(f"✅ MATCH! {poly_name} with {param_desc}")
                    print(f"   Result: 0x{result:04x}")
                    found_match = True
        
        if not found_match:
            print("❌ No standard CRC variant found")
            
            # Try some non-standard approaches
            print("\n🧪 TESTING NON-STANDARD APPROACHES:")
            
            # Maybe it's not including all header bytes
            for i in range(len(data)):
                for j in range(i+1, len(data)+1):
                    subset = data[i:j]
                    if len(subset) > 0:
                        result = calc_crc(subset, 0xA6BC, True, True, 0xFFFF, 0x0000)
                        if result == expected:
                            print(f"✅ MATCH with subset data[{i}:{j}]: {' '.join(f'{b:02x}' for b in subset)}")
                            found_match = True
            
            # Maybe it's using a simple arithmetic operation
            print("\n🔢 TESTING ARITHMETIC OPERATIONS:")
            byte_sum = sum(data)
            if (byte_sum & 0xFFFF) == expected:
                print(f"✅ MATCH! Simple sum: 0x{byte_sum & 0xFFFF:04x}")
                found_match = True
            
            if ((~byte_sum) & 0xFFFF) == expected:
                print(f"✅ MATCH! Inverted sum: 0x{(~byte_sum) & 0xFFFF:04x}")
                found_match = True
            
            # Maybe it's a different operation entirely
            for multiplier in [1, 2, 3, 5, 7, 11, 13]:
                result = (byte_sum * multiplier) & 0xFFFF
                if result == expected:
                    print(f"✅ MATCH! Sum * {multiplier}: 0x{result:04x}")
                    found_match = True
        
        return found_match

    # Test with the Advantech data
    found = test_crc_comprehensive(header_data, expected_crc)
    
    if not found:
        print("\n💡 HYPOTHESIS:")
        print("The Advantech device may be using:")
        print("1. A proprietary CRC variant not in standard libraries")
        print("2. A checksum that includes additional context data")
        print("3. A completely different algorithm")
        print("4. The frame format might be different than expected")
        
        print("\n🔍 FURTHER ANALYSIS:")
        print("Let's see if this is a recognizable pattern...")
        
        # Check if there's a mathematical relationship
        our_crc = 0xaef2
        their_crc = 0x10c9
        
        print(f"Our CRC:    0x{our_crc:04x} ({our_crc})")
        print(f"Their CRC:  0x{their_crc:04x} ({their_crc})")
        print(f"Difference: 0x{(their_crc - our_crc) & 0xFFFF:04x}")
        print(f"XOR:        0x{our_crc ^ their_crc:04x}")
        print(f"Ratio:      {their_crc / our_crc:.4f}")

if __name__ == "__main__":
    solve_advantech_crc()
