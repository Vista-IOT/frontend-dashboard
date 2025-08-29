#!/usr/bin/env python3
"""
Script to add DNP3 write dialog integration to io-tag-detail.tsx
"""

def modify_io_tag_detail():
    """Add DNP3 write dialog functionality to the io-tag-detail component"""
    
    with open('components/forms/io-tag-detail.tsx', 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    modified_lines = []
    
    for i, line in enumerate(lines):
        modified_lines.append(line)
        
        # Step 1: Add import after OpcuaWriteDialog import
        if 'import { OpcuaWriteDialog } from "@/components/dialogs/opcua-write-dialog";' in line:
            modified_lines.append('import { Dnp3WriteDialog } from "@/components/dialogs/dnp3-write-dialog";')
        
        # Step 2: Add state variables after opcuaWriteTag state
        elif 'const [opcuaWriteTag, setOpcuaWriteTag] = useState<IOTag | null>(null);' in line:
            modified_lines.append('  const [dnp3WriteOpen, setDnp3WriteOpen] = useState(false);')
            modified_lines.append('  const [dnp3WriteTag, setDnp3WriteTag] = useState<IOTag | null>(null);')
        
        # Step 3: Add DNP3 write button after OPC-UA write button
        elif line.strip() == 'Write' and i > 0 and 'OPC-UA' in lines[i-10:i]:
            # Look for the closing of the OPC-UA button
            if i + 1 < len(lines) and 'Button>' in lines[i+1]:
                # Add DNP3 button after the OPC-UA button section closes
                j = i + 1
                while j < len(lines) and not ('}' in lines[j] and 'deviceType' not in lines[j]):
                    j += 1
                if j < len(lines):
                    # Insert DNP3 button after finding the closing
                    dnp3_button = [
                        '                      {deviceToDisplay.deviceType === "DNP3.0" && (',
                        '                        <Button',
                        '                          variant="outline"',
                        '                          size="sm"',
                        '                          onClick={(e) => {',
                        '                            e.stopPropagation();',
                        '                            setDnp3WriteTag(tag);',
                        '                            setDnp3WriteOpen(true);',
                        '                          }}',
                        '                          disabled={(tag.readWrite || "Read/Write") === "Read Only" || !tag.address?.match(/^(AO|BO)\\./i)}',
                        '                        >',
                        '                          Write',
                        '                        </Button>',
                        '                      )}'
                    ]
                    # We'll add this later after finding the exact position
    
    # Let me implement a more targeted approach
    # Find the exact locations and insert
    
    # Find OPC-UA write button end and add DNP3 button
    opcua_write_end = -1
    for i, line in enumerate(modified_lines):
        if 'deviceToDisplay.deviceType === "OPC-UA"' in line and 'Write' in modified_lines[i:i+20]:
            # Find the end of this button block
            j = i
            brace_count = 0
            while j < len(modified_lines):
                if '{' in modified_lines[j]:
                    brace_count += modified_lines[j].count('{')
                if '}' in modified_lines[j]:
                    brace_count -= modified_lines[j].count('}')
                    if brace_count == 0:
                        opcua_write_end = j
                        break
                j += 1
            break
    
    if opcua_write_end > 0:
        # Insert DNP3 button after OPC-UA button
        dnp3_button_lines = [
            '                      {deviceToDisplay.deviceType === "DNP3.0" && (',
            '                        <Button',
            '                          variant="outline"',
            '                          size="sm"',
            '                          onClick={(e) => {',
            '                            e.stopPropagation();',
            '                            setDnp3WriteTag(tag);',
            '                            setDnp3WriteOpen(true);',
            '                          }}',
            '                          disabled={(tag.readWrite || "Read/Write") === "Read Only" || !tag.address?.match(/^(AO|BO)\\./i)}',
            '                        >',
            '                          Write',
            '                        </Button>',
            '                      )}'
        ]
        
        # Insert after the OPC-UA button
        modified_lines = modified_lines[:opcua_write_end+1] + dnp3_button_lines + modified_lines[opcua_write_end+1:]
    
    # Find OPC-UA dialog and add DNP3 dialog after it
    opcua_dialog_end = -1
    for i, line in enumerate(modified_lines):
        if 'OpcuaWriteDialog' in line and '<' in line:
            # Find the end of this dialog block  
            j = i
            while j < len(modified_lines) and not (lines[j].strip().endswith('/>') or lines[j].strip().endswith(')')):
                j += 1
            if j < len(modified_lines):
                opcua_dialog_end = j + 1  # After the closing )}
            break
    
    if opcua_dialog_end > 0:
        dnp3_dialog_lines = [
            '      {deviceToDisplay.deviceType === "DNP3.0" && dnp3WriteTag && (',
            '        <Dnp3WriteDialog',
            '          open={dnp3WriteOpen}',
            '          onOpenChange={setDnp3WriteOpen}',
            '          device={deviceToDisplay}',
            '          tag={dnp3WriteTag}',
            '        />',
            '      )}'
        ]
        
        # Insert after OPC-UA dialog
        modified_lines = modified_lines[:opcua_dialog_end] + dnp3_dialog_lines + modified_lines[opcua_dialog_end:]
    
    # Write the modified content back
    with open('components/forms/io-tag-detail.tsx', 'w') as f:
        f.write('\n'.join(modified_lines))
    
    print("✓ Successfully added DNP3 write dialog integration")
    return True

if __name__ == "__main__":
    try:
        modify_io_tag_detail()
        print("🎉 DNP3 dialog integration completed!")
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)
