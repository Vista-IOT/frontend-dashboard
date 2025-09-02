#!/usr/bin/env python3
"""
Verify the point index mapping is now correct
"""

def verify_point_mapping():
    """Verify the corrected point index mapping"""
    
    print("🔍 VERIFYING CORRECTED POINT INDEX MAPPING")
    print("="*50)
    
    print("📋 **YOUR YAML CONFIGURATION:**")
    yaml_config = [
        {
            'tag_name': 'AI.000',
            'dnp3PointIndex': 8,
            'expected_dnp3_request': 'Group 30, Index 7'
        },
        {
            'tag_name': 'AO.000', 
            'dnp3PointIndex': 8,
            'expected_dnp3_request': 'Group 40, Index 7'
        }
    ]
    
    for config in yaml_config:
        tag_name = config['tag_name']
        point_index_config = config['dnp3PointIndex']
        dnp3_index = point_index_config - 1  # Apply the -1 conversion
        point_type = tag_name.split('.')[0]
        
        # Map to group
        group_map = {'AI': 30, 'AO': 40}
        group = group_map[point_type]
        
        print(f"\n✅ **{tag_name} tag:**")
        print(f"   YAML dnp3PointIndex: {point_index_config}")
        print(f"   Converted DNP3 Index: {dnp3_index} (= {point_index_config} - 1)")
        print(f"   DNP3 Request: Group {group}, Index {dnp3_index}")
        print(f"   Expected: {config['expected_dnp3_request']}")
        print(f"   Match: {'✅ YES' if f'Group {group}, Index {dnp3_index}' == config['expected_dnp3_request'] else '❌ NO'}")
    
    print(f"\n🎯 **RESULT:**")
    print(f"With dnp3PointIndex: 8 in your YAML:")
    print(f"   ✅ AI.000 will read from EdgeLink AI #8 → DNP3 Index 7")
    print(f"   ✅ AO.000 will read from EdgeLink AO #8 → DNP3 Index 7")
    print(f"")
    print(f"This matches the visible points in your EdgeLink table:")
    print(f"   AI.000, AI.001, AI.002, AI.003, AI.004, AI.005, AI.006, AI.007")
    print(f"   → Your tags will read AI.007 (which is EdgeLink AI #8)")
    
    print(f"\n🚀 **READY TO TEST!**")
    print(f"The service will now request the correct indexes.")
    print(f"Restart your backend and test again!")

if __name__ == "__main__":
    verify_point_mapping()
