# Pull Request: Modbus RTU Implementation + Dynamic API Hostname

## 📋 Overview
This pull request contains two major improvements to the Vista IoT Gateway:

1. **Modbus RTU Polling Support** - Complete implementation for serial-based Modbus devices
2. **Dynamic API Hostname Resolution** - Frontend now adapts to any deployment environment

## 🔧 Changes Made

### **Backend Changes (Modbus RTU)**
- **File**: `vista-backend/app/services/polling_service.py`
- **New Function**: `poll_modbus_rtu_device()` - Complete RTU polling implementation
- **Device Detection**: Automatic recognition of "Modbus RTU" device types
- **Serial Communication**: Full support for COM ports, baud rates, parity, stop bits
- **Error Handling**: Comprehensive RTU-specific error states and messages

### **Frontend Changes (Dynamic Hostname)**
- **Files Modified**: 16 API calls across multiple components
- **Key Files**:
  - `lib/services/backend-service.ts` - Dynamic API base URL
  - `lib/stores/configuration-store.ts` - Hostname-aware configuration
  - `hooks/useDashboardOverview.ts` - Dynamic polling endpoints
  - `hooks/useNetworkInterfaces.ts` - Network-aware API calls
  - `package.json` - Development server binds to all interfaces

## 🚀 Features Added

### **Modbus RTU Support**
- ✅ Serial port communication (COM1, COM2, /dev/ttyUSB0, etc.)
- ✅ Configurable baud rates (9600, 19200, 38400, 115200)
- ✅ Parity support (None, Even, Odd)
- ✅ Stop bits and data bits configuration
- ✅ Same register reading and conversion logic as TCP
- ✅ Identical frontend display (no UI changes needed)

### **Dynamic API Resolution**
- ✅ Frontend adapts to any deployment environment
- ✅ Works on localhost, network IPs, or domain names
- ✅ Automatic backend discovery using `window.location.hostname`
- ✅ Network-accessible development server

## 🎯 How to Test

### **RTU Testing**
1. Configure an IO Port with serial settings
2. Add a device with `deviceType: "Modbus RTU"`
3. Add tags with Modbus addresses
4. Values should appear in frontend identical to TCP devices

### **Network Testing**
1. Run `pnpm run dev` 
2. Access via `http://localhost:3000` (local)
3. Access via `http://your-ip:3000` (network)
4. API calls automatically adapt to the access method

## 📦 Git Information

### **Branch**: `sanskar`
### **Commits**:
1. `5bc5e35` - Update API calls to use window.location.hostname for dynamic backend resolution
2. `d61b837` - Implement Modbus RTU polling support

### **Files Changed**:
- `vista-backend/app/services/polling_service.py` (+224 lines)
- Frontend files (11 files, dynamic hostname changes)

## 🏃‍♂️ Instructions for Teammate

### **Option 1: Pull the Branch Directly**
```bash
git fetch origin
git checkout -b sanskar origin/sanskar
```

### **Option 2: Cherry-pick Commits**
```bash
git checkout main
git cherry-pick 5bc5e35  # Dynamic hostname changes
git cherry-pick d61b837  # Modbus RTU implementation
```

### **Option 3: Manual Merge**
```bash
git checkout main
git merge sanskar
```

## 🔧 Backend Dependencies
Make sure these Python packages are installed:
```bash
pip install pymodbus serial
```

## 🎉 Impact

### **For Users**:
- Can now use both TCP and RTU Modbus devices seamlessly
- Frontend works regardless of deployment environment
- Consistent UI experience for all device types

### **For Developers**:
- Cleaner network-agnostic development
- Easy deployment to any environment
- Scalable polling architecture for future protocols

## 🐛 Error Handling

### **RTU-Specific Errors**:
- `serial_connect_failed` - Serial port connection issues
- `rtu_exception` - Communication exceptions
- `rtu_modbus_error` - Protocol-level errors
- `serial_port_error` - Hardware/driver problems

### **Network Errors**:
- Automatic fallback to environment variables
- SSR compatibility maintained

## 📋 Testing Checklist
- [ ] Frontend loads on localhost:3000
- [ ] Frontend accessible from network IP
- [ ] TCP Modbus polling still works
- [ ] RTU Modbus polling works with serial devices
- [ ] Error messages display properly
- [ ] Configuration saves and loads correctly

---

**Ready for review and merge!** 🚀

Contact: Sanskar (Intern) for any questions about implementation details.
