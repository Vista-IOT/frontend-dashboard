/**
 * Backend Service
 * This service handles communication with the Vista IoT Gateway backend service
 */
import axios from 'axios';
import { toast } from 'sonner';

// Default backend API URL - dynamically use current hostname
const getBackendApiUrl = () => {
  if (typeof window !== 'undefined') {
    const apiHost = window.location.hostname;
    return `http://${apiHost}:8000/api`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api';
};

const BACKEND_API_URL = getBackendApiUrl();

/**
 * Service to interact with the backend
 */
class BackendService {
  private apiUrl: string;

  constructor(apiUrl: string = BACKEND_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Check if the backend service is running
   */
  async checkStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/status`);
      return response.data?.running === true;
    } catch (error) {
      console.error('Error checking backend status:', error);
      return false;
    }
  }

  /**
   * Restart the backend service with the latest configuration
   */
  async restartBackend(): Promise<boolean> {
    try {
      const response = await axios.post(`${this.apiUrl}/restart`);
      return response.data?.status === 'success';
    } catch (error) {
      console.error('Error restarting backend:', error);
      return false;
    }
  }

  /**
   * Update the backend configuration
   * @param config The configuration to update
   */
  async updateConfig(config: any): Promise<boolean> {
    try {
      const response = await axios.post(`${this.apiUrl}/config`, {
        config,
        save: true
      });
      return response.data?.status === 'success';
    } catch (error) {
      console.error('Error updating backend config:', error);
      return false;
    }
  }

  /**
   * Get the current backend configuration
   */
  async getConfig(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/config`);
      return response.data;
    } catch (error) {
      console.error('Error getting backend config:', error);
      return null;
    }
  }

  /**
   * Get all tags from the backend
   */
  async getTags(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/tags`);
      return response.data || [];
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  }

  /**
   * Update a tag value
   * @param tagId The tag ID
   * @param value The new value
   */
  async updateTagValue(tagId: string, value: any): Promise<boolean> {
    try {
      const response = await axios.put(`${this.apiUrl}/tags/${tagId}`, {
        value
      });
      return response.data?.status === 'success';
    } catch (error) {
      console.error(`Error updating tag ${tagId}:`, error);
      return false;
    }
  }

  /**
   * Get information about active protocols
   */
  async getProtocols(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/protocols`);
      return response.data;
    } catch (error) {
      console.error('Error getting protocols:', error);
      return {};
    }
  }

  /**
   * Launch the backend process
   * @param configPath Optional path to the configuration file
   */
  async launchBackend(configPath?: string): Promise<boolean> {
    try {
      // In a production environment, this would use a different approach
      // to launch the backend process, possibly through a WebSocket or a
      // native integration. For now, we'll use a dedicated endpoint.
      const response = await axios.post(`${this.apiUrl}/launch`, {
        configPath
      });
      return response.data?.status === 'success';
    } catch (error) {
      console.error('Error launching backend:', error);
      return false;
    }
  }
}

// Export singleton instance
const backendService = new BackendService();
export default backendService;
