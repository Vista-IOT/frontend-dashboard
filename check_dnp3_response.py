#!/usr/bin/env python3
import socket

def test_what_server_sends():
    # Connect to Docker server
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('127.0.0.1', 20000))
    
    # Send the same request Vista is sending
    request = bytes.fromhex('05640cc4000001002aa1c1011e02170001b89f')
    print(f"Sending request: {request.hex()}")
    print("Request breakdown:")
    print(f"  Start: {request[0]:02x} {request[1]:02x}")
    print(f"  Length: {request[2]:02x}")
    print(f"  Control: {request[3]:02x}")
    print(f"  Dest addr: {request[4]:02x} {request[5]:02x} = {request[4] | (request[5] << 8)}")
    print(f"  Src addr: {request[6]:02x} {request[7]:02x} = {request[6] | (request[7] << 8)}")
    print(f"  App control: {request[10]:02x}")
    print(f"  Function: {request[11]:02x}")
    
    sock.send(request)
    
    # Receive response
    response = sock.recv(1024)
    print(f"\nReceived response: {response.hex()}")
    print(f"Response length: {len(response)} bytes")
    
    # Parse the response
    if len(response) >= 12:
        print("\nResponse breakdown:")
        print(f"  Start: {response[0]:02x} {response[1]:02x}")
        print(f"  Length: {response[2]:02x}")
        print(f"  Control: {response[3]:02x}")
        print(f"  Dest addr: {response[4]:02x} {response[5]:02x} = {response[4] | (response[5] << 8)}")
        print(f"  Src addr: {response[6]:02x} {response[7]:02x} = {response[6] | (response[7] << 8)}")
        print(f"  App control: {response[10]:02x}")
        function_code = response[11]
        print(f"  Function code: {function_code:02x}")
        
        if function_code == 0x00:
            print("  -> This is a CONFIRM (0x00), not a data response!")
        elif function_code == 0x81:
            print("  -> This is a proper response (0x81)")
        else:
            print(f"  -> Unknown function code: 0x{function_code:02x}")
    
    sock.close()

if __name__ == "__main__":
    test_what_server_sends()
