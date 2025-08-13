import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class MCPClient extends EventEmitter {
  constructor() {
    super();
    this.servers = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing MCP Client...');
      
      // Initialize MCP servers
      await this.startMCPServers();
      
      this.isInitialized = true;
      logger.info('MCP Client initialized successfully');
    } catch (error) {
      logger.error('Error initializing MCP Client:', error);
      throw error;
    }
  }

  async startMCPServers() {
    const mcpPath = path.resolve(__dirname, '../../../mcp');
    
    // For now, only start blogger-server
    const servers = [
      {
        name: 'blogger-server',
        path: path.join(mcpPath, 'blogger-server'),
        command: 'node',
        args: ['build/index.js']
      }
    ];

    for (const serverConfig of servers) {
      try {
        await this.startServer(serverConfig);
      } catch (error) {
        console.log(error)
        logger.warn(`Failed to start ${serverConfig.name}:`, error.message);
        // Continue with other servers even if one fails
      }
    }
  }

  async  startServer(serverConfig) {
  // Load environment variables for the child process
  const envPath = path.join(serverConfig.path, '.env');
  const serverEnv = { ...process.env }; // Use the global 'process' object

  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    Object.assign(serverEnv, envConfig); // Safely merge env variables
    logger.info(`Loaded environment variables for ${serverConfig.name}`);
  }

  // CRITICAL: Rename 'process' to 'childProcess' to avoid shadowing the global
  const childProcess = spawn(serverConfig.command, serverConfig.args, {
    cwd: serverConfig.path,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: serverEnv,
  });

  const server = {
    name: serverConfig.name,
    process: childProcess, // Store the renamed variable
    stdin: childProcess.stdin,
    stdout: childProcess.stdout,
    stderr: childProcess.stderr,
    isReady: false,
    messageId: 0,
  };

  this.servers.set(serverConfig.name, server);
  logger.info(`Starting ${serverConfig.name}...`);

  // Use Promise.race to handle multiple outcomes elegantly
  try {
    await Promise.race([
      // Outcome 1: Server becomes ready
      new Promise((resolve) => {
        const onData = (data) => {
          const message = data.toString();
          // For debugging, log all output
          logger.info(`[${serverConfig.name}]: ${message.trim()}`);
          
          // More robust "ready" check (ideally from stdout)
          if (message.includes('MCP server running') || message.includes('server running')) {
            server.isReady = true;
            logger.info(`✅ ${serverConfig.name} is ready!`);
            // Clean up listener to prevent memory leaks
            childProcess.stderr.removeListener('data', onData);
            resolve();
          }
        };
        childProcess.stderr.on('data', onData);
      }),

      // Outcome 2: Server fails to start (e.g., command not found)
      new Promise((_, reject) => {
        childProcess.on('error', (error) => {
          logger.error(`Error spawning ${serverConfig.name}:`, error);
          reject(error);
        });
      }),

      // Outcome 3: Server exits prematurely
      new Promise((_, reject) => {
        childProcess.on('exit', (code) => {
          // Only reject if the server exits *before* it was ready
          if (!server.isReady) {
            const errorMsg = `${serverConfig.name} exited prematurely with code ${code}`;
            logger.error(errorMsg);
            reject(new Error(errorMsg));
          }
        });
      }),

      // Outcome 4: Timeout is reached
      new Promise((_, reject) => {
        setTimeout(() => {
          if (!server.isReady) {
            reject(new Error(`⏰ ${serverConfig.name} failed to start within the timeout period.`));
          }
        }, 10000); // 10 second timeout
      }),
    ]);
    
    // If we get here, the server started successfully.
    // The Promise.race is resolved, and the function can return.
  } catch (error) {
    // If any of the promises in Promise.race reject, it will be caught here.
    // Ensure the process is killed to prevent orphaned processes.
    childProcess.kill();
    logger.error(`Failed to start ${serverConfig.name}. Cleaning up...`);
    // Re-throw the error so the caller knows the start failed.
    throw error;
  }
}

  async callTool(serverName, toolName, args = {}) {
    if (!this.isInitialized) {
      throw new Error('MCP Client not initialized');
    }

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    if (!server.isReady) {
      throw new Error(`Server ${serverName} not ready`);
    }

    return new Promise((resolve, reject) => {
      const messageId = ++server.messageId;
      
      const request = {
        jsonrpc: '2.0',
        id: messageId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      let responseBuffer = '';
      
      // Set up response handler
      const responseHandler = (data) => {
        try {
          responseBuffer += data.toString();
          const lines = responseBuffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          responseBuffer = lines.pop() || '';
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const response = JSON.parse(line);
              
              if (response.id === messageId) {
                clearTimeout(timeout);
                server.stdout.removeListener('data', responseHandler);
                
                if (response.error) {
                  reject(new Error(response.error.message || 'MCP tool call failed'));
                } else {
                  resolve(response.result);
                }
                return;
              }
            } catch (parseError) {
              // Log parsing errors for debugging
              logger.warn(`Failed to parse JSON response: ${line}`);
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          server.stdout.removeListener('data', responseHandler);
          reject(error);
        }
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        server.stdout.removeListener('data', responseHandler);
        reject(new Error(`Tool call timeout for ${serverName}:${toolName}`));
      }, 30000); // 30 second timeout

      server.stdout.on('data', responseHandler);

      // Send request
      try {
        const requestStr = JSON.stringify(request) + '\n';
        logger.info(`Sending request to ${serverName}: ${requestStr.trim()}`);
        server.stdin.write(requestStr);
      } catch (error) {
        clearTimeout(timeout);
        server.stdout.removeListener('data', responseHandler);
        reject(error);
      }
    });
  }

  async listTools(serverName) {
    if (!this.isInitialized) {
      throw new Error('MCP Client not initialized');
    }

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    return new Promise((resolve, reject) => {
      const messageId = ++server.messageId;
      
      const request = {
        jsonrpc: '2.0',
        id: messageId,
        method: 'tools/list'
      };

      const responseHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.id === messageId) {
            server.stdout.removeListener('data', responseHandler);
            
            if (response.error) {
              reject(new Error(response.error.message || 'Failed to list tools'));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          server.stdout.removeListener('data', responseHandler);
          reject(error);
        }
      };

      server.stdout.on('data', responseHandler);
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  getServerStatus() {
    const status = {};
    
    for (const [name, server] of this.servers.entries()) {
      status[name] = {
        isReady: server.isReady,
        pid: server.process.pid,
        connected: !server.process.killed
      };
    }
    
    return status;
  }

  async shutdown() {
    logger.info('Shutting down MCP Client...');
    
    for (const [name, server] of this.servers.entries()) {
      try {
        server.process.kill('SIGTERM');
        logger.info(`Stopped ${name}`);
      } catch (error) {
        logger.error(`Error stopping ${name}:`, error);
      }
    }
    
    this.servers.clear();
    this.isInitialized = false;
    logger.info('MCP Client shut down');
  }
}

// Singleton instance
let mcpClientInstance = null;

export function getMCPClient() {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}

export async function initializeMCPClient() {
  const client = getMCPClient();
  if (!client.isInitialized) {
    await client.initialize();
  }
  return client;
}
