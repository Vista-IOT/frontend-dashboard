import struct
import math

def apply_conversion_type(value, conversion_type):
    """
    Apply the specified conversion type to the value.
    Supports Modicon double, float swap, BCD, endian swaps, etc.
    """
    if conversion_type is None:
        return value
    ctype = conversion_type.strip().upper()
    try:
        if ctype == "UINT, BIG ENDIAN (ABCD)":
            return int(value)
        elif ctype == "INT, BIG ENDIAN (ABCD)":
            return int(value)
        elif ctype == "UINT32, MODICON DOUBLE PRECISION (REG1*10000+REG2)":
            # Assume value is a tuple/list of two registers
            if isinstance(value, (tuple, list)) and len(value) == 2:
                return int(value[0]) * 10000 + int(value[1])
            return int(value)
        elif ctype == "FLOAT, BIG ENDIAN (ABCD)":
            # Assume value is a 32-bit int, convert to float
            if isinstance(value, int):
                return struct.unpack(">f", struct.pack(">I", value))[0]
            return float(value)
        elif ctype == "FLOAT, BIG ENDIAN, SWAP WORD (CDAB)":
            # Swap words in 32-bit int
            if isinstance(value, int):
                hi = (value & 0xFFFF0000) >> 16
                lo = value & 0x0000FFFF
                swapped = (lo << 16) | hi
                return struct.unpack(">f", struct.pack(">I", swapped))[0]
            return float(value)
        elif ctype == "INT, BIG ENDIAN, SWAP WORD (CDAB)":
            if isinstance(value, int):
                hi = (value & 0xFFFF0000) >> 16
                lo = value & 0x0000FFFF
                swapped = (lo << 16) | hi
                return swapped
            return int(value)
        elif ctype == "UINT, PACKED BCD, BIG ENDIAN (ABCD)":
            # Convert packed BCD to int
            if isinstance(value, int):
                result = 0
                shift = 0
                v = value
                while v > 0:
                    result += (v & 0xF) * (10 ** shift)
                    v >>= 4
                    shift += 1
                return result
            return int(value)
        elif ctype == "FLOAT, LITTLE ENDIAN (DCBA)":
            if isinstance(value, int):
                b = value.to_bytes(4, byteorder="little")
                return struct.unpack("<f", b)[0]
            return float(value)
        # Add more conversion types as needed
        else:
            return value
    except Exception:
        return value

def apply_clamping(value, tag_config):
    """
    Clamp the value according to tag_config (clampToLow, clampToHigh, clampToZero, spanLow, spanHigh).
    """
    try:
        if tag_config.get("clampToLow") and value < tag_config.get("spanLow", float("-inf")):
            value = tag_config.get("spanLow", value)
        if tag_config.get("clampToHigh") and value > tag_config.get("spanHigh", float("inf")):
            value = tag_config.get("spanHigh", value)
        if tag_config.get("clampToZero") and value < 0:
            value = 0
        return value
    except Exception:
        return value

def process_tag_value(raw_value, tag_config):
    """
    Apply scaling, offset, clamping, and conversion to the raw value according to tag_config.
    """
    value = raw_value
    # Scaling
    if tag_config.get("scale") is not None:
        value = value * tag_config["scale"]
    # Offset
    if tag_config.get("offset") is not None:
        value = value + tag_config["offset"]
    # Clamping
    value = apply_clamping(value, tag_config)
    # Conversion
    value = apply_conversion_type(value, tag_config.get("conversionType"))
    return value 