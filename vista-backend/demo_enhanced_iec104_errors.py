#!/usr/bin/env python3
"""
Enhanced IEC-104 Error Handling Demo

This script demonstrates the new verbose error messages and comprehensive error codes
implemented for IEC-104, similar to the existing Modbus and SNMP implementations.

Features demonstrated:
- IEC-104 specific error codes (COT, ASDU reject reasons, connection states)
- Quality descriptor error handling for measured values
- Verbose error descriptions with technical details
- HTTP status code mapping for web API integration
- Enhanced error extraction from c104 library responses
"""

import sys
import os

# Add the app directory to Python path for importing
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

try:
    from services.iec104_service import (
        # Error code dictionaries
        IEC104_COT_ERROR_CODES,
        IEC104_REJECT_CODES,
        IEC104_CONNECTION_ERROR_CODES,
        IEC104_QUALITY_ERROR_CODES,
        IEC104_COMMAND_ERROR_CODES,
        
        # Verbose error functions
        get_iec104_cot_error_verbose,
        get_iec104_reject_verbose,
        get_iec104_connection_error_verbose,
        get_iec104_quality_error_verbose,
        get_iec104_command_error_verbose,
        
        # Error extraction and mapping
        extract_iec104_error_details,
        map_iec104_error_to_http_status,
        
        # Enhanced service functions
        iec104_get_with_error,
        iec104_set_with_error,
        
        # Address parsing
        parse_iec104_address
    )
    print("✅ Successfully imported IEC-104 service with enhanced error handling")
except ImportError as e:
    print(f"❌ Failed to import IEC-104 service: {e}")
    sys.exit(1)

def demo_error_code_mappings():
    """Demonstrate IEC-104 error code mappings and verbose descriptions"""
    print("\n" + "="*60)
    print("IEC-104 ERROR CODE MAPPINGS DEMONSTRATION")
    print("="*60)
    
    print("\n1. IEC-104 Cause of Transmission (COT) Error Codes:")
    print("-" * 50)
    sample_cot_codes = [7, 8, 44, 45, 46, 47, 99]
    for code in sample_cot_codes:
        verbose = get_iec104_cot_error_verbose(code)
        http_status = map_iec104_error_to_http_status(code)
        print(f"   COT {code:2d}: {verbose:<50} -> HTTP {http_status}")
    
    print("\n2. IEC-104 ASDU Reject Codes:")
    print("-" * 50)
    sample_reject_codes = [1, 2, 6, 10, 12, 99]
    for code in sample_reject_codes:
        verbose = get_iec104_reject_verbose(code)
        http_status = map_iec104_error_to_http_status(code)
        print(f"   REJ {code:2d}: {verbose:<50} -> HTTP {http_status}")
    
    print("\n3. IEC-104 Connection State Codes:")
    print("-" * 50)
    for code in range(8):
        verbose = get_iec104_connection_error_verbose(code)
        print(f"   STATE {code}: {verbose}")
    
    print("\n4. IEC-104 Quality Descriptor Flags:")
    print("-" * 50)
    sample_quality_flags = [0x00, 0x01, 0x10, 0x20, 0x40, 0x80, 0xF1]
    for flags in sample_quality_flags:
        verbose = get_iec104_quality_error_verbose(flags)
        print(f"   QUALITY 0x{flags:02X}: {verbose}")

def demo_error_extraction():
    """Demonstrate error detail extraction from various error scenarios"""
    print("\n" + "="*60)
    print("IEC-104 ERROR DETAIL EXTRACTION DEMONSTRATION")
    print("="*60)
    
    print("\n1. Connection Error Extraction:")
    print("-" * 40)
    error_scenarios = [
        ("Connection timeout", None, None, None),
        ("Connection refused by server", 0, None, None),
        ("Unknown type identification", None, None, 44),
        ("Point blocked", None, 0x10, None),
        ("Invalid value detected", None, 0x81, None),
    ]
    
    for i, (error_msg, conn_state, quality, cot) in enumerate(error_scenarios, 1):
        print(f"\n   Scenario {i}: {error_msg}")
        error_info = extract_iec104_error_details(error_msg, conn_state, quality, cot)
        print(f"   ├─ Error Type: {error_info['error_type']}")
        print(f"   ├─ Error Code: {error_info['error_code']}")
        print(f"   ├─ Connection State: {error_info['connection_state']}")
        print(f"   ├─ Quality Flags: {error_info['quality_flags']}")
        print(f"   ├─ COT Code: {error_info['cot_code']}")
        print(f"   └─ Verbose Description: {error_info['verbose_description']}")

def demo_address_parsing():
    """Demonstrate IEC-104 address parsing"""
    print("\n" + "="*60)
    print("IEC-104 ADDRESS PARSING DEMONSTRATION")
    print("="*60)
    
    test_addresses = [
        "1794",                    # IOA only
        "M_ME_NA_1:1794",         # Type and IOA
        "C_SC_NA_1:100",          # Command type and IOA
        "M_ME_NC_1:2048",         # Float measurement
        "invalid:address",         # Invalid format
        "not_a_number",           # Invalid IOA
        ""                        # Empty address
    ]
    
    for addr in test_addresses:
        type_id, ioa, error = parse_iec104_address(addr)
        status = "✅ Valid" if error is None else "❌ Invalid"
        print(f"   Address: '{addr:20}' -> Type: {type_id:12} IOA: {ioa:4} {status}")
        if error:
            print(f"            Error: {error}")

def demo_enhanced_service_functions():
    """Demonstrate enhanced service functions with error handling"""
    print("\n" + "="*60)
    print("IEC-104 ENHANCED SERVICE FUNCTIONS DEMONSTRATION")
    print("="*60)
    
    # Sample device configuration
    device_config = {
        'iec104IpAddress': '192.168.1.100',
        'iec104PortNumber': 2404,
        'iec104AsduAddress': 1,
        'name': 'Demo_IEC104_Device'
    }
    
    print("\n1. Enhanced GET with Error Details:")
    print("-" * 40)
    
    # Test various address scenarios (these will fail since no real device)
    test_addresses = ["1794", "M_ME_NA_1:2048", "C_SC_NA_1:100"]
    
    for addr in test_addresses:
        print(f"\n   Testing address: {addr}")
        try:
            value, error_info = iec104_get_with_error(device_config, addr)
            if error_info:
                print(f"   ├─ Value: {value}")
                print(f"   ├─ Error: {error_info.get('verbose_description', 'Unknown error')}")
                print(f"   ├─ Error Code: {error_info.get('error_code')}")
                print(f"   └─ HTTP Status: {map_iec104_error_to_http_status(error_info.get('error_code', 500))}")
            else:
                print(f"   └─ Success: {value}")
        except Exception as e:
            print(f"   └─ Exception: {e}")
    
    print("\n2. Enhanced SET with Error Details:")
    print("-" * 40)
    
    test_commands = [
        ("C_SC_NA_1:100", True, "Single Command ON"),
        ("C_SE_NC_1:200", 123.45, "Float Setpoint"),
        ("invalid:addr", False, "Invalid Address")
    ]
    
    for addr, value, description in test_commands:
        print(f"\n   Testing {description}: {addr} = {value}")
        try:
            success, error_info = iec104_set_with_error(device_config, addr, value)
            if error_info:
                print(f"   ├─ Success: {success}")
                print(f"   ├─ Error: {error_info.get('verbose_description', 'Unknown error')}")
                print(f"   ├─ Error Code: {error_info.get('error_code')}")
                print(f"   └─ HTTP Status: {map_iec104_error_to_http_status(error_info.get('error_code', 500))}")
            else:
                print(f"   └─ Success: {success}")
        except Exception as e:
            print(f"   └─ Exception: {e}")

def demo_comparison_with_other_protocols():
    """Compare IEC-104 error handling with Modbus and SNMP"""
    print("\n" + "="*60)
    print("PROTOCOL ERROR HANDLING COMPARISON")
    print("="*60)
    
    print("\nCommon Error Scenarios and How Each Protocol Handles Them:")
    print("-" * 60)
    
    scenarios = [
        ("Connection Timeout", "Timeout errors"),
        ("Invalid Address", "Address/object not found errors"),
        ("Access Denied", "Permission/access errors"),
        ("Device Busy", "Resource unavailability errors"),
        ("Invalid Data Type", "Type mismatch errors")
    ]
    
    print(f"{'Scenario':<20} {'Modbus':<15} {'SNMP':<15} {'IEC-104':<20}")
    print("-" * 70)
    
    for scenario, description in scenarios:
        print(f"{scenario:<20} {'Exception':<15} {'Error Code':<15} {'COT/Reject':<20}")
    
    print(f"\nError Detail Structure Comparison:")
    print(f"{'Protocol':<10} {'Error Info Structure'}")
    print("-" * 50)
    print(f"{'Modbus':<10} exception_code + verbose_description")
    print(f"{'SNMP':<10} error_code + error_index + verbose_description")
    print(f"{'IEC-104':<10} error_code + connection_state + quality_flags + cot_code + verbose_description")

def main():
    """Run all demonstration functions"""
    print("IEC-104 ENHANCED ERROR HANDLING DEMONSTRATION")
    print("=" * 80)
    print("This demo shows the comprehensive error handling system implemented for IEC-104,")
    print("similar to the existing Modbus and SNMP error handling in the IOT Gateway.")
    print("=" * 80)
    
    try:
        demo_error_code_mappings()
        demo_error_extraction()
        demo_address_parsing()
        demo_enhanced_service_functions()
        demo_comparison_with_other_protocols()
        
        print("\n" + "="*60)
        print("DEMO COMPLETED SUCCESSFULLY")
        print("="*60)
        print("\nKey Features Implemented:")
        print("✅ Comprehensive IEC-104 error code definitions")
        print("✅ Verbose error descriptions with technical details")
        print("✅ Quality descriptor flag interpretation")
        print("✅ Connection state monitoring and reporting")
        print("✅ HTTP status code mapping for web API integration")
        print("✅ Enhanced error extraction from c104 library responses")
        print("✅ Consistent error handling pattern across all protocols")
        print("\nThe IEC-104 error handling now matches the robustness and detail")
        print("level of the existing Modbus and SNMP implementations.")
        
    except Exception as e:
        print(f"\n❌ Demo failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
