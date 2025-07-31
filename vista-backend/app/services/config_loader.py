
import requests
import yaml
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

def load_latest_config():
    """
    Loads the latest configuration, prioritizing locally saved config over frontend API.
    """
    # First, try to load from locally saved configuration file
    config_dir = Path(__file__).parent.parent.parent / "config"
    config_file = config_dir / "deployed_config.yaml"
    
    if config_file.exists():
        try:
            logger.info(f"Loading configuration from local file: {config_file}")
            with open(config_file, 'r') as f:
                config = yaml.safe_load(f)
            if config:
                logger.info("Successfully loaded configuration from local file.")
                return config
        except Exception as e:
            logger.error(f"Error loading local config file: {e}")
    
    # Fallback: try to load from frontend API
    hostname = os.getenv('FRONTEND_HOST', 'localhost')
    port = os.getenv('FRONTEND_PORT', '3000')
    config_url = f"http://{hostname}:{port}/deploy/config"
    
    try:
        logger.info(f"Fetching configuration from frontend API: {config_url}")
        
        response = requests.get(config_url, timeout=5) # 5-second timeout
        response.raise_for_status() # Raises an exception for bad status codes (4xx or 5xx)

        # The endpoint returns JSON with a 'raw' key containing the YAML string
        raw_config_yaml = response.json().get("raw")

        if raw_config_yaml:
            logger.info("Successfully loaded configuration from frontend API.")
            config = yaml.safe_load(raw_config_yaml)
            
            # Save the config locally for future use
            config_dir.mkdir(exist_ok=True)
            with open(config_file, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
            logger.info(f"Configuration saved locally to: {config_file}")
            
            return config
        else:
            logger.warning("No configuration 'raw' content found in API response.")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error while fetching config: {e}")
        logger.warning("Could not connect to the frontend to get the configuration. This might happen if the frontend is not running yet.")
        return None
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML from API response: {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while loading config: {e}")
        return None 