import threading
import time
import os
import platform
from .config_loader import load_latest_config
from .hardware_configurator import configure_hardware, apply_network_configuration
from .polling_service import start_polling_from_config
from .network_configurator import get_current_wifi_interface_config
from app.utils.config_summary import generate_config_summary
from app.logging_config import get_startup_logger, get_error_logger

# Use dedicated startup logger for initialization activities
startup_logger = get_startup_logger()
error_logger = get_error_logger()
_init_lock = threading.Lock()

def initialize_backend():
    """Initialize the backend system with comprehensive startup logging"""
    with _init_lock:
        startup_logger.info('='*80)
        startup_logger.info('🚀 VISTA IOT BACKEND INITIALIZATION STARTING')
        startup_logger.info('='*80)
        
        try:
            # Log system information
            startup_logger.info('📊 System Information:')
            startup_logger.info(f'   🐧 Platform: {platform.system()} {platform.release()}')
            startup_logger.info(f'   🏠 Working Directory: {os.getcwd()}')
            startup_logger.info(f'   👤 Running as: {"root" if os.geteuid() == 0 else "non-root user"}')
            
            # Step 1: Network Interface Detection
            startup_logger.info('🔍 Step 1: Network Interface Detection')
            startup_logger.info('-' * 50)
            
            wifi_config = get_current_wifi_interface_config()
            if wifi_config:
                startup_logger.info(f'✅ Active WiFi interface detected: {wifi_config["interface"]}')
                startup_logger.info(f'   📍 IP Address: {wifi_config["ip"]}')
                startup_logger.info(f'   🌐 Gateway: {wifi_config.get("gateway", "N/A")}')
                startup_logger.info('   🛡️  WiFi configuration will be preserved to maintain connectivity')
            else:
                startup_logger.warning('⚠️  No active WiFi interface detected - proceeding with caution')
            
            # Step 2: Configuration Loading
            startup_logger.info('⚙️  Step 2: Configuration Loading')
            startup_logger.info('-' * 50)
            
            config = load_latest_config()
            if config:
                startup_logger.info('✅ Configuration loaded successfully')
                
                # Log configuration summary
                summary = generate_config_summary(config)
                startup_logger.info('📋 Configuration Summary:')
                for line in summary.split('\n'):
                    if line.strip():
                        startup_logger.info(f'   {line}')
            else:
                error_logger.error('❌ Failed to load configuration')
                startup_logger.error('❌ Configuration loading failed - cannot proceed')
                return False
            
            # Step 3: Hardware and Network Configuration
            startup_logger.info('🔧 Step 3: Hardware and Network Configuration')
            startup_logger.info('-' * 50)
            
            has_root = os.geteuid() == 0
            if has_root:
                startup_logger.info('🔑 Running with root privileges - applying full configuration')
                startup_logger.info('   🌐 Network configuration changes will be applied')
                startup_logger.info('   🔌 Hardware configuration will be applied')
                
                try:
                    apply_network_configuration(config)
                    startup_logger.info('✅ Network configuration applied successfully')
                except Exception as e:
                    error_logger.error(f'Network configuration failed: {str(e)}')
                    startup_logger.error(f'❌ Network configuration failed: {str(e)}')
                    # Continue with hardware config even if network config fails
            else:
                startup_logger.warning('⚠️  Running without root privileges')
                startup_logger.info('   ℹ️  Network changes will NOT be applied (requires root)')
                startup_logger.info('   🔍 Hardware configuration will be checked only')
                
                try:
                    configure_hardware(config, apply_network_changes=False)
                    startup_logger.info('✅ Hardware configuration check completed')
                except Exception as e:
                    error_logger.error(f'Hardware configuration check failed: {str(e)}')
                    startup_logger.error(f'❌ Hardware configuration check failed: {str(e)}')
            
            # Step 4: Network Stabilization
            startup_logger.info('⏱️  Step 4: Network Interface Stabilization')
            startup_logger.info('-' * 50)
            startup_logger.info('⏳ Waiting 2 seconds for network interfaces to stabilize...')
            time.sleep(2)
            startup_logger.info('✅ Network stabilization period completed')
            
            # Step 5: Service Initialization
            startup_logger.info('🔄 Step 5: Service Initialization')
            startup_logger.info('-' * 50)
            
            try:
                start_polling_from_config(config)
                startup_logger.info('✅ Polling services started successfully')
            except Exception as e:
                error_logger.error(f'Polling service initialization failed: {str(e)}')
                startup_logger.error(f'❌ Polling service initialization failed: {str(e)}')
                return False
            
            # Initialization Complete
            startup_logger.info('='*80)
            startup_logger.info('🎉 VISTA IOT BACKEND INITIALIZATION COMPLETED SUCCESSFULLY')
            startup_logger.info('='*80)
            startup_logger.info('🟢 Backend is ready to serve requests')
            startup_logger.info('📊 All services initialized and running')
            
            return True
            
        except Exception as e:
            error_logger.error(f'Critical initialization error: {str(e)}', exc_info=True)
            startup_logger.error('='*80)
            startup_logger.error('💥 CRITICAL INITIALIZATION FAILURE')
            startup_logger.error('='*80)
            startup_logger.error(f'❌ Error: {str(e)}')
            startup_logger.error('🔧 Please check logs for detailed error information')
            raise
        
        finally:
            startup_logger.info('🔄 Initialization process completed (with or without errors)')
