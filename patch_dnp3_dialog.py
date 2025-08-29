#!/usr/bin/env python3
"""
Patch script to add DNP3 write dialog to io-tag-detail.tsx
"""

def patch_file():
    with open('components/forms/io-tag-detail.tsx', 'r') as f:
        content = f.read()
    
    # Step 1: Add import
    if 'import { Dnp3WriteDialog }' not in content:
        content = content.replace(
            'import { OpcuaWriteDialog } from "@/components/dialogs/opcua-write-dialog";',
            'import { OpcuaWriteDialog } from "@/components/dialogs/opcua-write-dialog";\nimport { Dnp3WriteDialog } from "@/components/dialogs/dnp3-write-dialog";'
        )
        print("✓ Added DNP3 dialog import")
    
    # Step 2: Add state variables
    if 'dnp3WriteOpen' not in content:
        content = content.replace(
            'const [opcuaWriteTag, setOpcuaWriteTag] = useState<IOTag | null>(null);',
            'const [opcuaWriteTag, setOpcuaWriteTag] = useState<IOTag | null>(null);\n  const [dnp3WriteOpen, setDnp3WriteOpen] = useState(false);\n  const [dnp3WriteTag, setDnp3WriteTag] = useState<IOTag | null>(null);'
        )
        print("✓ Added DNP3 dialog state")
    
    # Step 3: Add DNP3 write button in table 
    # Find the OPC-UA button block and add DNP3 button after it
    opcua_button_pattern = '''                      {deviceToDisplay.deviceType === "OPC-UA" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpcuaWriteTag(tag);
                            setOpcuaWriteOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only"}
                        >
                          Write
                        </Button>
                      )}'''
    
    dnp3_button = '''                      {deviceToDisplay.deviceType === "DNP3.0" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDnp3WriteTag(tag);
                            setDnp3WriteOpen(true);
                          }}
                          disabled={(tag.readWrite || "Read/Write") === "Read Only" || !tag.address?.match(/^(AO|BO)\\./i)}
                        >
                          Write
                        </Button>
                      )}'''
    
    if opcua_button_pattern in content and 'setDnp3WriteTag(tag)' not in content:
        content = content.replace(opcua_button_pattern, opcua_button_pattern + '\n' + dnp3_button)
        print("✓ Added DNP3 write button")
    
    # Step 4: Add DNP3 dialog component
    opcua_dialog_pattern = '''      {deviceToDisplay.deviceType === "OPC-UA" && opcuaWriteTag && (
        <OpcuaWriteDialog
          open={opcuaWriteOpen}
          onOpenChange={setOpcuaWriteOpen}
          device={deviceToDisplay}
          tag={opcuaWriteTag}
        />
      )}'''
    
    dnp3_dialog = '''      {deviceToDisplay.deviceType === "DNP3.0" && dnp3WriteTag && (
        <Dnp3WriteDialog
          open={dnp3WriteOpen}
          onOpenChange={setDnp3WriteOpen}
          device={deviceToDisplay}
          tag={dnp3WriteTag}
        />
      )}'''
    
    if opcua_dialog_pattern in content and '<Dnp3WriteDialog' not in content:
        content = content.replace(opcua_dialog_pattern, opcua_dialog_pattern + '\n' + dnp3_dialog)
        print("✓ Added DNP3 dialog component")
    
    # Write back the modified content
    with open('components/forms/io-tag-detail.tsx', 'w') as f:
        f.write(content)
    
    return True

if __name__ == "__main__":
    try:
        patch_file()
        print("🎉 DNP3 dialog integration completed successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
