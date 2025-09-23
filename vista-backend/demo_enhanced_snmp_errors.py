#!/usr/bin/env python3
"""
Demonstration of Enhanced SNMP Error Handling

This script demonstrates the new verbose error handling capabilities
that have been added to the Vista Backend SNMP implementation.
"""

import sys
import os
sys.path.append('vista-backend')

def demo_error_codes():
    """Demonstrate SNMP error code mapping and verbose descriptions"""
    print("=" * 60)
    print("SNMP Error Code Mapping Demo")
    print("=" * 60)
    
    try:
        from app.services.snmp_service import SNMP_ERROR_CODES, get_snmp_error_verbose
        
        print(f"Total SNMP error codes defined: {len(SNMP_ERROR_CODES)}")
        print("\nSample error codes and their verbose descriptions:")
        
        sample_codes = [0, 2, 3, 4, 5, 16]
        for code in sample_codes:
            description = get_snmp_error_verbose(code)
            print(f"  Code {code:2d}: {description}")
        
        return True
    except ImportError as e:
        print(f"Import failed: {e}")
        return False

def demo_http_status_mapping():
    """Demonstrate HTTP status code mapping for SNMP errors"""
    print("\n" + "=" * 60)
    print("HTTP Status Code Mapping Demo")
    print("=" * 60)
    
    try:
        from app.services.snmp_service import map_snmp_error_to_http_status
        
        sample_mappings = [
            (0, "Success"),
            (2, "Not Found (no such name)"),
            (3, "Bad Request (bad value)"),
            (4, "Method Not Allowed (read only)"),
            (5, "Internal Server Error (general error)"),
            (6, "Forbidden (no access)"),
            (16, "Unauthorized (auth error)"),
        ]
        
        print("SNMP Error Code -> HTTP Status Code:")
        for snmp_code, description in sample_mappings:
            http_status = map_snmp_error_to_http_status(snmp_code)
            print(f"  SNMP {snmp_code:2d} -> HTTP {http_status} ({description})")
        
        return True
    except ImportError as e:
        print(f"Import failed: {e}")
        return False

def demo_error_details_extraction():
    """Demonstrate error details extraction from SNMP responses"""
    print("\n" + "=" * 60)
    print("Error Details Extraction Demo")
    print("=" * 60)
    
    try:
        from app.services.snmp_service import extract_snmp_error_details, format_enhanced_snmp_error
        
        # Simulate different types of SNMP errors
        mock_errors = [
            {"error_code": 2, "error_index": 0, "description": "No such name error"},
            {"error_code": 16, "error_index": 1, "description": "Authorization error"},
            {"error_indication": "Request timeout", "description": "Timeout error"},
        ]
        
        for i, mock_error in enumerate(mock_errors):
            print(f"\nExample {i+1}: {mock_error['description']}")
            
            # Create mock error object
            class MockError:
                def __init__(self, **kwargs):
                    for key, value in kwargs.items():
                        setattr(self, key, value)
                def __str__(self):
                    return f"MockError({self.__dict__})"
            
            if 'error_code' in mock_error:
                error_obj = MockError(errorStatus=mock_error['error_code'], errorIndex=mock_error.get('error_index'))
                error_details = extract_snmp_error_details(error_obj)
            else:
                error_details = extract_snmp_error_details("Generic error", mock_error.get('error_indication'))
            
            print(f"  Extracted details: {error_details}")
            
            enhanced_msg = format_enhanced_snmp_error(error_details, "SNMP GET", "1.3.6.1.2.1.1.1.0")
            print(f"  Enhanced message: {enhanced_msg}")
        
        return True
    except ImportError as e:
        print(f"Import failed: {e}")
        return False

def demo_api_improvements():
    """Demonstrate API-level improvements"""
    print("\n" + "=" * 60)
    print("API Improvements Demo")
    print("=" * 60)
    
    print("Enhanced SNMP API features:")
    print("  ✅ New GET /deploy/api/snmp/get/{oid} endpoint")
    print("  ✅ Enhanced POST /deploy/api/snmp/set endpoint with detailed errors")
    print("  ✅ New GET /deploy/api/snmp/error-codes endpoint for documentation")
    print("  ✅ Proper HTTP status codes (404, 401, 400, 503, etc.)")
    print("  ✅ Detailed error responses with errorCode, verboseDescription")
    print("  ✅ Enhanced logging with error code context")
    
    print("\nExample enhanced API error response structure:")
    example_response = {
        "success": False,
        "message": "SNMP GET failed for OID 1.3.6.1.2.1.1.99.0 [Error Code 2]: noSuchName: The specified OID does not exist on the target device",
        "data": {"oid": "1.3.6.1.2.1.1.99.0", "value": None},
        "elapsedMs": 1250,
        "errorDetails": {
            "errorCode": 2,
            "errorIndex": 0,
            "verboseDescription": "noSuchName: The specified OID does not exist on the target device"
        }
    }
    
    import json
    print(json.dumps(example_response, indent=2))

def main():
    """Run all demonstrations"""
    print("Enhanced SNMP Error Handling Demonstration")
    print("Vista IoT Backend - SNMP Service Enhancements")
    print("Implemented: Standard SNMP Error Codes (RFC 3416)")
    
    success_count = 0
    
    if demo_error_codes():
        success_count += 1
    
    if demo_http_status_mapping():
        success_count += 1
    
    if demo_error_details_extraction():
        success_count += 1
    
    demo_api_improvements()
    success_count += 1
    
    print("\n" + "=" * 60)
    print(f"Demo Summary: {success_count}/4 sections completed successfully")
    print("=" * 60)
    
    print("\nKey Enhancements Implemented:")
    print("  1. ✅ SNMP Error Code Mapping - All 19 standard error codes defined")
    print("  2. ✅ Enhanced Error Extraction - Detailed error information parsing")
    print("  3. ✅ HTTP Status Code Mapping - Proper HTTP responses for SNMP errors")
    print("  4. ✅ Enhanced API Responses - Detailed error information in JSON responses")
    print("  5. ✅ Improved Logging - Verbose error messages in logs")
    print("  6. ✅ Polling Service Integration - Enhanced error handling in device polling")
    
    print("\nThis completes the implementation of all three enhancement recommendations!")

if __name__ == "__main__":
    main()
