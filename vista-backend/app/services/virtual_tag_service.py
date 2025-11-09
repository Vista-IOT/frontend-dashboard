"""
Virtual Tag Service - Manages user tags and calculation tags in polled values
Adds user-defined tags and calculated tags to _latest_polled_values so they can be served
over protocol servers (Modbus, OPC-UA, etc.) just like IO tags
"""

import threading
import time
from typing import Dict, Any
from app.logging_config import get_polling_logger

logger = get_polling_logger()

# Import the global polled values storage from polling_service
from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock


def initialize_user_tags(config: Dict[str, Any]):
    """
    Initialize user tags in _latest_polled_values from configuration
    User tags are virtual tags with default values that can be read/written
    """
    user_tags = config.get('user_tags', [])
    
    if not user_tags:
        logger.info("No user tags found in configuration")
        return
    
    with _latest_polled_values_lock:
        # Create a virtual device for user tags
        if 'USER_TAGS' not in _latest_polled_values:
            _latest_polled_values['USER_TAGS'] = {}
        
        for tag in user_tags:
            tag_id = tag.get('id', tag.get('name'))
            tag_name = tag.get('name')
            default_value = tag.get('defaultValue', 0)
            
            # Initialize with default value
            _latest_polled_values['USER_TAGS'][tag_id] = {
                'value': default_value,
                'status': 'good',
                'error': None,
                'timestamp': time.time(),
                'tag_name': tag_name,
                'data_type': tag.get('dataType', 'Analog'),
                'read_write': tag.get('readWrite', 'Read/Write'),
                'description': tag.get('description', '')
            }
            
            # Also store by tag name for easy lookup
            _latest_polled_values[tag_name] = {
                'value': default_value,
                'status': 'good',
                'error': None,
                'timestamp': time.time(),
                'source': 'user_tag'
            }
            
            logger.info(f"Initialized user tag: {tag_name} = {default_value}")
    
    logger.info(f"Initialized {len(user_tags)} user tags")


def initialize_calculation_tags(config: Dict[str, Any]):
    """
    Initialize calculation tags in _latest_polled_values from configuration
    Calculation tags compute values based on formulas referencing other tags
    """
    calc_tags = config.get('calculation_tags', [])
    
    if not calc_tags:
        logger.info("No calculation tags found in configuration")
        return
    
    with _latest_polled_values_lock:
        # Create a virtual device for calculation tags
        if 'CALC_TAGS' not in _latest_polled_values:
            _latest_polled_values['CALC_TAGS'] = {}
        
        for tag in calc_tags:
            tag_id = tag.get('id', tag.get('name'))
            tag_name = tag.get('name')
            formula = tag.get('formula', '0')
            
            # Initialize with 0, will be calculated later
            _latest_polled_values['CALC_TAGS'][tag_id] = {
                'value': 0,
                'status': 'initializing',
                'error': None,
                'timestamp': time.time(),
                'tag_name': tag_name,
                'formula': formula,
                'description': tag.get('description', '')
            }
            
            # Also store by tag name with calc: prefix for easy lookup
            _latest_polled_values[f'calc:{tag_name}'] = {
                'value': 0,
                'status': 'initializing',
                'error': None,
                'timestamp': time.time(),
                'source': 'calculation_tag',
                'formula': formula
            }
            
            logger.info(f"Initialized calculation tag: {tag_name} with formula: {formula}")
    
    logger.info(f"Initialized {len(calc_tags)} calculation tags")


def evaluate_calculation_tags(config: Dict[str, Any]):
    """
    Evaluate all calculation tags based on their formulas
    This should be called periodically to update calculated values
    """
    calc_tags = config.get('calculation_tags', [])
    
    if not calc_tags:
        return
    
    with _latest_polled_values_lock:
        for tag in calc_tags:
            tag_name = tag.get('name')
            formula = tag.get('formula', '0')
            
            try:
                # Build evaluation context with all available tag values
                eval_context = {}
                
                # Add all polled values to context
                for device_name, device_tags in _latest_polled_values.items():
                    if isinstance(device_tags, dict):
                        for tag_id, tag_data in device_tags.items():
                            if isinstance(tag_data, dict) and 'value' in tag_data:
                                # Add by tag_name if available
                                if 'tag_name' in tag_data:
                                    eval_context[tag_data['tag_name']] = tag_data['value']
                                # Also add by tag_id
                                eval_context[tag_id] = tag_data['value']
                
                # Add direct tag name mappings
                for key, value in _latest_polled_values.items():
                    if isinstance(value, dict) and 'value' in value and 'source' in value:
                        # Remove calc: prefix for evaluation
                        clean_key = key.replace('calc:', '')
                        eval_context[clean_key] = value['value']
                
                # Evaluate the formula
                # Note: This uses eval() which can be dangerous - in production, use a safe expression evaluator
                result = eval(formula, {"__builtins__": {}}, eval_context)
                
                # Update the calculated value
                if 'CALC_TAGS' in _latest_polled_values:
                    for tag_id, tag_data in _latest_polled_values['CALC_TAGS'].items():
                        if tag_data.get('tag_name') == tag_name:
                            tag_data['value'] = result
                            tag_data['status'] = 'good'
                            tag_data['timestamp'] = time.time()
                
                # Update the direct lookup
                if f'calc:{tag_name}' in _latest_polled_values:
                    _latest_polled_values[f'calc:{tag_name}']['value'] = result
                    _latest_polled_values[f'calc:{tag_name}']['status'] = 'good'
                    _latest_polled_values[f'calc:{tag_name}']['timestamp'] = time.time()
                
                logger.debug(f"Calculated {tag_name} = {result}")
                
            except Exception as e:
                logger.error(f"Error evaluating calculation tag {tag_name}: {e}")
                # Update with error status
                if 'CALC_TAGS' in _latest_polled_values:
                    for tag_id, tag_data in _latest_polled_values['CALC_TAGS'].items():
                        if tag_data.get('tag_name') == tag_name:
                            tag_data['status'] = 'error'
                            tag_data['error'] = str(e)
                
                if f'calc:{tag_name}' in _latest_polled_values:
                    _latest_polled_values[f'calc:{tag_name}']['status'] = 'error'
                    _latest_polled_values[f'calc:{tag_name}']['error'] = str(e)


def start_calculation_engine(config: Dict[str, Any], update_interval: float = 1.0):
    """
    Start a background thread that periodically evaluates calculation tags
    
    Args:
        config: Configuration dictionary containing calculation_tags
        update_interval: How often to recalculate (in seconds)
    """
    calc_tags = config.get('calculation_tags', [])
    
    if not calc_tags:
        logger.info("No calculation tags to evaluate")
        return None
    
    stop_event = threading.Event()
    
    def calculation_loop():
        logger.info(f"Calculation engine started, updating every {update_interval}s")
        while not stop_event.is_set():
            try:
                evaluate_calculation_tags(config)
            except Exception as e:
                logger.error(f"Error in calculation loop: {e}")
            
            # Wait for next update cycle
            stop_event.wait(update_interval)
        
        logger.info("Calculation engine stopped")
    
    # Start the calculation thread
    calc_thread = threading.Thread(target=calculation_loop, daemon=True, name="CalculationEngine")
    calc_thread.start()
    
    logger.info(f"Started calculation engine for {len(calc_tags)} calculation tags")
    
    return stop_event


def update_user_tag_value(tag_name: str, new_value: Any) -> bool:
    """
    Update a user tag value
    
    Args:
        tag_name: Name of the user tag
        new_value: New value to set
        
    Returns:
        True if successful, False otherwise
    """
    with _latest_polled_values_lock:
        # Update in USER_TAGS device
        if 'USER_TAGS' in _latest_polled_values:
            for tag_id, tag_data in _latest_polled_values['USER_TAGS'].items():
                if tag_data.get('tag_name') == tag_name:
                    tag_data['value'] = new_value
                    tag_data['timestamp'] = time.time()
                    logger.info(f"Updated user tag {tag_name} = {new_value}")
        
        # Update direct lookup
        if tag_name in _latest_polled_values:
            _latest_polled_values[tag_name]['value'] = new_value
            _latest_polled_values[tag_name]['timestamp'] = time.time()
            return True
    
    logger.warning(f"User tag {tag_name} not found")
    return False


def initialize_virtual_tags(config: Dict[str, Any]):
    """
    Initialize all virtual tags (user tags + calculation tags)
    This should be called when the configuration is loaded
    
    Args:
        config: Configuration dictionary
    """
    logger.info("Initializing virtual tags (user tags + calculation tags)")
    
    # Initialize user tags first
    initialize_user_tags(config)
    
    # Initialize calculation tags
    initialize_calculation_tags(config)
    
    # Start calculation engine
    calc_stop_event = start_calculation_engine(config, update_interval=1.0)
    
    logger.info("Virtual tags initialization complete")
    
    return calc_stop_event
