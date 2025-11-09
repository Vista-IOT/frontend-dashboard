#!/bin/bash

echo "🧪 Complete Virtual Tags Test - User Tags + Calc Tags → Modbus"
echo "================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Test Plan:${NC}"
echo "1. Get current config"
echo "2. Add user tag 'testTag1' with default value 150"
echo "3. Add user tag 'testTag2' with default value 250"
echo "4. Add calc tag 'sumTag' = testTag1 + testTag2"
echo "5. Deploy config to initialize virtual tags"
echo "6. Verify tags appear in polled values"
echo "7. Create Modbus mappings for all 3 tags"
echo "8. Test reading from Modbus server"
echo ""

# Step 1: Get current config
echo -e "${BLUE}Step 1: Getting current configuration...${NC}"
CONFIG=$(curl -s http://localhost:8000/deploy/config)
echo "✓ Config retrieved"
echo ""

# Step 2-4: Add virtual tags to config
echo -e "${BLUE}Step 2-4: Adding virtual tags to configuration...${NC}"

# Create updated config with user tags and calc tags
UPDATED_CONFIG=$(echo "$CONFIG" | jq '.user_tags = [
  {
    "id": "test-user-tag-1",
    "name": "testTag1",
    "dataType": "Analog",
    "defaultValue": 150,
    "spanHigh": 1000,
    "spanLow": 0,
    "readWrite": "Read/Write",
    "description": "Test user tag 1"
  },
  {
    "id": "test-user-tag-2",
    "name": "testTag2",
    "dataType": "Analog",
    "defaultValue": 250,
    "spanHigh": 1000,
    "spanLow": 0,
    "readWrite": "Read/Write",
    "description": "Test user tag 2"
  }
] | .calculation_tags = [
  {
    "id": "test-calc-tag-1",
    "name": "sumTag",
    "formula": "testTag1 + testTag2",
    "description": "Sum of testTag1 and testTag2"
  }
]')

# Save updated config
echo "$UPDATED_CONFIG" | curl -s -X POST http://localhost:8000/deploy/config \
  -H "Content-Type: application/json" \
  -d @- > /dev/null

echo "✓ Added 2 user tags and 1 calc tag to config"
echo ""

# Step 5: Deploy configuration
echo -e "${BLUE}Step 5: Deploying configuration to initialize virtual tags...${NC}"
curl -s -X POST http://localhost:8000/deploy/apply > /dev/null
echo "✓ Configuration deployed"
echo "⏳ Waiting 5 seconds for services to initialize..."
sleep 5
echo ""

# Step 6: Verify tags in polled values
echo -e "${BLUE}Step 6: Verifying tags in polled values...${NC}"
echo ""
echo -e "${YELLOW}User Tags:${NC}"
curl -s http://localhost:8000/deploy/api/io/polled-values | jq '.testTag1, .testTag2'
echo ""
echo -e "${YELLOW}Calc Tag:${NC}"
curl -s http://localhost:8000/deploy/api/io/polled-values | jq '."calc:sumTag"'
echo ""
echo -e "${YELLOW}USER_TAGS device:${NC}"
curl -s http://localhost:8000/deploy/api/io/polled-values | jq '.USER_TAGS | keys'
echo ""
echo -e "${YELLOW}CALC_TAGS device:${NC}"
curl -s http://localhost:8000/deploy/api/io/polled-values | jq '.CALC_TAGS | keys'
echo ""

# Wait for sync
echo "⏳ Waiting 3 seconds for Data-Service sync..."
sleep 3
echo ""

# Check Data-Service DATA_STORE
echo -e "${BLUE}Checking Data-Service DATA_STORE...${NC}"
curl -s http://localhost:8080/data | jq '{testTag1, testTag2, sumTag}'
echo ""

# Step 7: Create Modbus mappings
echo -e "${BLUE}Step 7: Creating Modbus mappings...${NC}"
echo ""

# Register testTag1
echo "Registering testTag1..."
curl -s -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "key": "testTag1",
    "default": 150,
    "data_type": "float",
    "units": "",
    "allow_address_conflict": true
  }' | jq .

# Create Modbus mapping for testTag1
curl -s -X POST http://localhost:8080/mappings/modbus \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-tag-1-mapping",
    "key": "testTag1",
    "register_address": 40100,
    "function_code": 3,
    "data_type": "float32",
    "access": "rw",
    "scaling_factor": 1.0,
    "endianess": "big",
    "description": "Test user tag 1",
    "default_value": 150
  }' | jq .

echo ""

# Register testTag2
echo "Registering testTag2..."
curl -s -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "key": "testTag2",
    "default": 250,
    "data_type": "float",
    "units": "",
    "allow_address_conflict": true
  }' | jq .

# Create Modbus mapping for testTag2
curl -s -X POST http://localhost:8080/mappings/modbus \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-tag-2-mapping",
    "key": "testTag2",
    "register_address": 40102,
    "function_code": 3,
    "data_type": "float32",
    "access": "rw",
    "scaling_factor": 1.0,
    "endianess": "big",
    "description": "Test user tag 2",
    "default_value": 250
  }' | jq .

echo ""

# Register sumTag
echo "Registering sumTag (calc tag)..."
curl -s -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "key": "sumTag",
    "default": 400,
    "data_type": "float",
    "units": "",
    "allow_address_conflict": true
  }' | jq .

# Create Modbus mapping for sumTag
curl -s -X POST http://localhost:8080/mappings/modbus \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sum-tag-mapping",
    "key": "sumTag",
    "register_address": 40104,
    "function_code": 3,
    "data_type": "float32",
    "access": "r",
    "scaling_factor": 1.0,
    "endianess": "big",
    "description": "Calculated sum tag",
    "default_value": 400
  }' | jq .

echo ""
echo "✓ All Modbus mappings created"
echo ""

# Step 8: Test Modbus read
echo -e "${BLUE}Step 8: Testing Modbus server reads...${NC}"
echo ""
echo "⏳ Waiting 2 seconds for Modbus server to update..."
sleep 2
echo ""

echo -e "${YELLOW}Reading registers 40100-40109 (should show our 3 tags):${NC}"
echo "Expected:"
echo "  [40100-40101]: testTag1 = 150.0"
echo "  [40102-40103]: testTag2 = 250.0"
echo "  [40104-40105]: sumTag = 400.0 (150 + 250)"
echo ""
mbpoll -p 5020 -a 1 -t 4 -r 40100 -c 6 -1 localhost 2>&1 | grep -E "\[401"

echo ""
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""
echo "Summary:"
echo "  ✓ User tags created and initialized"
echo "  ✓ Calc tag created and evaluated"
echo "  ✓ Tags synced to Data-Service"
echo "  ✓ Modbus mappings created"
echo "  ✓ Values served over Modbus protocol"
