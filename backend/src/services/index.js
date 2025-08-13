import { DocumentProcessor } from './documentProcessor.js';
import { RAGService } from './ragService.js';
import { VectorStore } from './vectorStore.js';
import { DigitalPersonaService } from './digitalPersonaService.js';
import { initializeMCPClient, getMCPClient } from './mcpClient.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Global service instances
let documentProcessor = null;
let ragService = null;
let vectorStore = null;
let digitalPersonaService = null;
let mcpClient = null;

export async function initializeServices() {
  try {
    logger.info('Initializing PadalayAI services...');

    // Initialize Document Processor
    documentProcessor = new DocumentProcessor();
    logger.info('Document processor initialized');

    // Initialize Vector Store
    vectorStore = new VectorStore();
    await vectorStore.initialize();
    logger.info('Vector store initialized');

    // Initialize RAG Service
    ragService = new RAGService();
    await ragService.initialize();
    logger.info('RAG service initialized');

    // Initialize MCP Client
    try {
      mcpClient = await initializeMCPClient();
      logger.info('MCP client initialized');
    } catch (error) {
      logger.warn('MCP client initialization failed, continuing without MCP services:', error.message);
      mcpClient = null;
    }

    // Set MCP client for RAG service
    if (mcpClient) {
      ragService.setMCPClient(mcpClient);
    }

    // Initialize Digital Persona Service with shared services
    digitalPersonaService = new DigitalPersonaService();
    if (mcpClient) {
      digitalPersonaService.setMCPClient(mcpClient);
    }
    await digitalPersonaService.initialize(ragService, documentProcessor);
    logger.info('Digital persona service initialized with shared services');

    logger.info('All services initialized successfully');

  } catch (error) {
    logger.error('Error initializing services:', error);
    throw error;
  }
}

export function getDocumentProcessor() {
  if (!documentProcessor) {
    throw new Error('Document processor not initialized');
  }
  return documentProcessor;
}

export function getRAGService() {
  if (!ragService) {
    throw new Error('RAG service not initialized');
  }
  return ragService;
}

export function getVectorStore() {
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }
  return vectorStore;
}

export function getDigitalPersonaService() {
  if (!digitalPersonaService) {
    throw new Error('Digital persona service not initialized');
  }
  return digitalPersonaService;
}

export function getMCPClientInstance() {
  return mcpClient; // Can be null if initialization failed
}

export async function shutdownServices() {
  try {
    logger.info('Shutting down services...');

    if (ragService) {
      await ragService.saveQueryHistory();
    }

    if (documentProcessor) {
      await documentProcessor.saveDocuments();
    }

    if (vectorStore) {
      await vectorStore.close();
    }

    if (mcpClient) {
      await mcpClient.shutdown();
    }

    logger.info('Services shut down successfully');

  } catch (error) {
    logger.error('Error shutting down services:', error);
  }
}

// Health check for all services
export async function getServicesHealth() {
  const health = {
    timestamp: new Date().toISOString(),
    services: {}
  };

  try {
    // Check Document Processor
    health.services.documentProcessor = {
      status: documentProcessor ? 'healthy' : 'not_initialized',
      documentsCount: documentProcessor ? documentProcessor.documents.size : 0
    };

    // Check RAG Service
    health.services.ragService = {
      status: ragService && ragService.isInitialized ? 'healthy' : 'not_initialized',
      queryHistoryCount: ragService ? ragService.queryHistory.size : 0,
      hasOpenAI: ragService && ragService.openai ? true : false,
      hasVectorStore: ragService && ragService.collection ? true : false
    };

    // Check Vector Store
    health.services.vectorStore = {
      status: vectorStore && vectorStore.isInitialized ? 'healthy' : 'not_initialized'
    };

    // Check Digital Persona Service
    health.services.digitalPersonaService = {
      status: digitalPersonaService && digitalPersonaService.isInitialized ? 'healthy' : 'not_initialized',
      hasMCPClient: digitalPersonaService && digitalPersonaService.mcpClient ? true : false
    };

    // Check MCP Client
    health.services.mcpClient = {
      status: mcpClient && mcpClient.isInitialized ? 'healthy' : 'not_initialized',
      servers: mcpClient ? mcpClient.getServerStatus() : {}
    };

    // Overall health
    const coreServices = ['documentProcessor', 'ragService', 'vectorStore'];
    const coreHealthy = coreServices.every(service => 
      health.services[service] && health.services[service].status === 'healthy'
    );
    
    health.overall = coreHealthy ? 'healthy' : 'degraded';

  } catch (error) {
    logger.error('Error checking services health:', error);
    health.overall = 'error';
    health.error = error.message;
  }

  return health;
}
