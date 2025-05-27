// Noxhime Bot - IP and Port Whitelisting Module
// This module provides IP and port whitelisting functionality for the API server

import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Whitelist configuration interface
interface WhitelistConfig {
  ipWhitelist: {
    enabled: boolean;
    addresses: string[];
  };
  portWhitelist: {
    enabled: boolean;
    ports: number[];
  };
}

// Default whitelist configuration
const defaultWhitelistConfig: WhitelistConfig = {
  ipWhitelist: {
    enabled: false,
    addresses: []
  },
  portWhitelist: {
    enabled: false,
    ports: []
  }
};

/**
 * Load the whitelist configuration from a file
 * @param configPath Path to the whitelist configuration file
 * @returns The whitelist configuration object
 */
export function loadWhitelistConfig(configPath: string): WhitelistConfig {
  try {
    if (!fs.existsSync(configPath)) {
      console.log(`Whitelist configuration file not found at ${configPath}. Using default configuration.`);
      return defaultWhitelistConfig;
    }
    
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configFile) as WhitelistConfig;
    
    console.log(`Loaded whitelist configuration:
      - IP Whitelist: ${config.ipWhitelist.enabled ? 'Enabled' : 'Disabled'}
      - Whitelisted IPs: ${config.ipWhitelist.addresses.join(', ') || 'None'}
      - Port Whitelist: ${config.portWhitelist.enabled ? 'Enabled' : 'Disabled'}
      - Whitelisted Ports: ${config.portWhitelist.ports.join(', ') || 'None'}`);
    
    return config;
  } catch (error) {
    console.error('Error loading whitelist configuration:', error);
    return defaultWhitelistConfig;
  }
}

/**
 * Save the whitelist configuration to a file
 * @param config The whitelist configuration to save
 * @param configPath Path to the whitelist configuration file
 * @returns True if the configuration was saved successfully, otherwise false
 */
export function saveWhitelistConfig(config: WhitelistConfig, configPath: string): boolean {
  try {
    const configDir = configPath.substring(0, configPath.lastIndexOf('/'));
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Whitelist configuration saved to ${configPath}`);
    return true;
  } catch (error) {
    console.error('Error saving whitelist configuration:', error);
    return false;
  }
}

/**
 * Add an IP address to the whitelist
 * @param ip The IP address to add
 * @param config The whitelist configuration
 * @returns The updated whitelist configuration
 */
export function addIpToWhitelist(ip: string, config: WhitelistConfig): WhitelistConfig {
  if (!config.ipWhitelist.addresses.includes(ip)) {
    config.ipWhitelist.addresses.push(ip);
    console.log(`Added IP ${ip} to whitelist`);
  }
  return config;
}

/**
 * Remove an IP address from the whitelist
 * @param ip The IP address to remove
 * @param config The whitelist configuration
 * @returns The updated whitelist configuration
 */
export function removeIpFromWhitelist(ip: string, config: WhitelistConfig): WhitelistConfig {
  config.ipWhitelist.addresses = config.ipWhitelist.addresses.filter(addr => addr !== ip);
  console.log(`Removed IP ${ip} from whitelist`);
  return config;
}

/**
 * Add a port to the whitelist
 * @param port The port to add
 * @param config The whitelist configuration
 * @returns The updated whitelist configuration
 */
export function addPortToWhitelist(port: number, config: WhitelistConfig): WhitelistConfig {
  if (!config.portWhitelist.ports.includes(port)) {
    config.portWhitelist.ports.push(port);
    console.log(`Added port ${port} to whitelist`);
  }
  return config;
}

/**
 * Remove a port from the whitelist
 * @param port The port to remove
 * @param config The whitelist configuration
 * @returns The updated whitelist configuration
 */
export function removePortFromWhitelist(port: number, config: WhitelistConfig): WhitelistConfig {
  config.portWhitelist.ports = config.portWhitelist.ports.filter(p => p !== port);
  console.log(`Removed port ${port} from whitelist`);
  return config;
}

/**
 * Express middleware for IP and port whitelisting
 * @param config The whitelist configuration
 * @returns Express middleware function
 */
export function whitelistMiddleware(config: WhitelistConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip whitelisting if it's disabled
    if (!config.ipWhitelist.enabled && !config.portWhitelist.enabled) {
      return next();
    }
    
    const clientIp = req.ip || 
                    req.connection.remoteAddress || 
                    req.headers['x-forwarded-for'] as string;
                    
    // Check if the client IP is whitelisted (if IP whitelist is enabled)
    if (config.ipWhitelist.enabled && 
        clientIp && 
        !config.ipWhitelist.addresses.some(addr => clientIp.includes(addr))) {
      console.log(`Blocked request from non-whitelisted IP: ${clientIp}`);
      return res.status(403).json({ error: 'Access Denied: IP not whitelisted' });
    }
    
    // Check if the request port is whitelisted (if port whitelist is enabled)
    if (config.portWhitelist.enabled) {
      const requestPort = parseInt(req.headers['x-forwarded-port'] as string || '0');
      
      if (requestPort && !config.portWhitelist.ports.includes(requestPort)) {
        console.log(`Blocked request to non-whitelisted port: ${requestPort}`);
        return res.status(403).json({ error: 'Access Denied: Port not whitelisted' });
      }
    }
    
    // If all checks pass, proceed to the next middleware
    next();
  };
}

// Export the default configuration
export const defaultConfig = defaultWhitelistConfig;
