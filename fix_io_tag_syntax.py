#!/usr/bin/env python3
"""
Fix syntax issues in io-tag-detail.tsx for DNP3 write dialog integration
"""

def fix_syntax():
    with open('components/forms/io-tag-detail.tsx', 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Fix the OPC-UA button (missing </Button>)
    for i, line in enumerate(lines):
        if line.strip() == 'Write' and i > 0:
            # Check if this is the OPC-UA write button
            if any('OPC-UA' in lines[j] for j in range(max(0, i-20), i)):
                # Check if the next line is )} (missing button close)
                if i + 1 < len(lines) and lines[i+1].strip() == ')}':
                    lines[i+1] = '                        </Button>\n                      )}'
                    print(f"✓ Fixed OPC-UA button at line {i+1}")
                    break
    
    # Fix the DNP3 button (missing </Button>)  
    for i, line in enumerate(lines):
        if line.strip() == 'Write' and i > 0:
            # Check if this is the DNP3 write button
            if any('DNP3.0' in lines[j] for j in range(max(0, i-20), i)):
                # Check if the next line is )} (missing button close)
                if i + 1 < len(lines) and lines[i+1].strip() == ')}':
                    lines[i+1] = '                        </Button>\n                      )}'
                    print(f"✓ Fixed DNP3 button at line {i+1}")
                    break
    
    # Fix the OPC-UA dialog (missing closing )})
    for i, line in enumerate(lines):
        if '<OpcuaWriteDialog' in line:
            # Find the end of this dialog block
            j = i
            while j < len(lines) and not lines[j].strip().endswith('/>'):
                j += 1
            if j < len(lines) and lines[j].strip().endswith('/>'):
                # Check if next line is missing )}
                if j + 1 < len(lines) and 'deviceType === "DNP3.0"' in lines[j+1]:
                    lines[j] = lines[j] + '\n      )}'
                    print(f"✓ Fixed OPC-UA dialog at line {j}")
                    break
    
    # Fix the DNP3 dialog (missing closing )})
    for i, line in enumerate(lines):
        if '<Dnp3WriteDialog' in line:
            # Find the end of this dialog block
            j = i
            while j < len(lines) and not lines[j].strip().endswith('/>'):
                j += 1
            if j < len(lines) and lines[j].strip().endswith('/>'):
                # Check if next line should have )}
                if j + 1 < len(lines) and '</div>' in lines[j+1]:
                    lines[j] = lines[j] + '\n      )}'
                    print(f"✓ Fixed DNP3 dialog at line {j}")
                    break
    
    # Write the corrected content
    with open('components/forms/io-tag-detail.tsx', 'w') as f:
        f.write('\n'.join(lines))
    
    print("✓ Applied syntax fixes")
    return True

if __name__ == "__main__":
    try:
        fix_syntax()
        print("🎉 Syntax fixes applied successfully!")
    except Exception as e:
        print(f"❌ Error applying syntax fixes: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
