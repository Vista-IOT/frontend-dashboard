
import requests
import yaml
import logging

logger = logging.getLogger(__name__)

def load_latest_config():
    """
    Connects to the frontend API to load the latest configuration.
    """
    config_url = "http://localhost:3000/deploy/config"
    try:
        logger.info(f"Fetching latest configuration from: {config_url}")
        
        response = requests.get(config_url, timeout=5) # 5-second timeout
        response.raise_for_status() # Raises an exception for bad status codes (4xx or 5xx)

        # The endpoint returns JSON with a 'raw' key containing the YAML string
        raw_config_yaml = response.json().get("raw")

        if raw_config_yaml:
            logger.info("Successfully loaded latest configuration from frontend API.")
            return yaml.safe_load(raw_config_yaml)
        else:
            logger.warning("No configuration 'raw' content found in API response.")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error while fetching config: {e}")
        logger.warning("Could not connect to the frontend to get the configuration. This might happen if the frontend is not running yet. Continuing with no config.")
        return None
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML from API response: {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while loading config from API: {e}")
        return None 