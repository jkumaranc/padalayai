import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class VectorStore {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('Vector store initialized (using in-memory fallback)');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Error initializing vector store:', error);
      throw error;
    }
  }

  async addDocument(documentInfo) {
    // This is handled by the RAG service
    logger.info(`Vector store: Document ${documentInfo.filename} will be processed by RAG service`);
  }

  async removeDocument(documentId) {
    // This is handled by the RAG service
    logger.info(`Vector store: Document ${documentId} will be removed by RAG service`);
  }

  async close() {
    logger.info('Vector store closed');
  }
}
