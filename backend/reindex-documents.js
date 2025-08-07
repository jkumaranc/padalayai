import { initializeServices, getRAGService, getDocumentProcessor } from './src/services/index.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function reindexDocuments() {
  try {
    logger.info('Starting document re-indexing...');
    
    // Initialize services
    await initializeServices();
    
    const ragService = getRAGService();
    const documentProcessor = getDocumentProcessor();
    
    // Get all documents
    const documents = await documentProcessor.getAllDocuments();
    logger.info(`Found ${documents.length} documents to re-index`);
    
    // Re-index each document
    for (const docSummary of documents) {
      const fullDocument = await documentProcessor.getDocument(docSummary.id);
      if (fullDocument) {
        logger.info(`Re-indexing document: ${fullDocument.filename}`);
        await ragService.addDocument(fullDocument);
        logger.info(`✅ Successfully re-indexed: ${fullDocument.filename}`);
      }
    }
    
    logger.info('✅ Document re-indexing completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Error during re-indexing:', error);
    process.exit(1);
  }
}

reindexDocuments();
