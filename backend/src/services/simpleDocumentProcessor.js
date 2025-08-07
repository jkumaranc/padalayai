import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class SimpleDocumentProcessor {
  constructor() {
    this.documents = new Map(); // In-memory storage for demo
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      // Create necessary directories
      await fs.mkdir('uploads/documents', { recursive: true });
      await fs.mkdir('data', { recursive: true });
      
      // Load existing documents from storage
      await this.loadDocuments();
    } catch (error) {
      logger.error('Error initializing document storage:', error);
    }
  }

  async loadDocuments() {
    try {
      const documentsFile = 'data/documents.json';
      const data = await fs.readFile(documentsFile, 'utf8');
      const documents = JSON.parse(data);
      
      documents.forEach(doc => {
        this.documents.set(doc.id, doc);
      });
      
      logger.info(`Loaded ${documents.length} documents from storage`);
    } catch (error) {
      // File doesn't exist yet, that's okay
      logger.info('No existing documents found, starting fresh');
    }
  }

  async saveDocuments() {
    try {
      const documentsFile = 'data/documents.json';
      const documents = Array.from(this.documents.values());
      await fs.writeFile(documentsFile, JSON.stringify(documents, null, 2));
    } catch (error) {
      logger.error('Error saving documents:', error);
    }
  }

  async processDocument(fileInfo) {
    try {
      logger.info(`Processing document: ${fileInfo.filename}`);

      // Simple text extraction - only for .txt files for now
      let content = '';
      let chunks = [];
      
      try {
        if (fileInfo.mimetype === 'text/plain' || fileInfo.mimetype === 'text/markdown') {
          const fileBuffer = await fs.readFile(fileInfo.filepath);
          content = fileBuffer.toString('utf8');
        } else {
          // For other file types, just store basic info without content extraction
          content = `[${fileInfo.mimetype} file - content extraction not implemented in simple mode]`;
        }

        // Simple chunking
        chunks = this.simpleChunkText(content, fileInfo.id);
      } catch (extractError) {
        logger.warn(`Could not extract content from ${fileInfo.filename}:`, extractError.message);
        content = `[Content extraction failed: ${extractError.message}]`;
        chunks = [];
      }

      // Create document info
      const documentInfo = {
        id: fileInfo.id,
        filename: fileInfo.filename,
        filepath: fileInfo.filepath,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        uploadedAt: fileInfo.uploadedAt,
        processedAt: new Date().toISOString(),
        content,
        chunks,
        pages: this.estimatePages(content),
        wordCount: this.countWords(content),
        metadata: {
          language: 'unknown',
          readingTime: Math.ceil(this.countWords(content) / 200)
        }
      };

      // Store document
      this.documents.set(documentInfo.id, documentInfo);
      await this.saveDocuments();

      logger.info(`Successfully processed document: ${documentInfo.filename} (${chunks.length} chunks)`);
      
      return documentInfo;

    } catch (error) {
      logger.error(`Error processing document ${fileInfo.filename}:`, error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  simpleChunkText(text, documentId, chunkSize = 1000) {
    if (!text || text.length <= chunkSize) {
      return text ? [{
        id: `${documentId}-chunk-0`,
        text: text,
        index: 0,
        documentId: documentId,
        metadata: {
          chunkSize: text.length,
          startChar: 0,
          endChar: text.length
        }
      }] : [];
    }

    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      
      // Try to break at word boundaries
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + chunkSize * 0.5) {
          end = lastSpace;
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          id: `${documentId}-chunk-${index}`,
          text: chunkText,
          index: index,
          documentId: documentId,
          metadata: {
            chunkSize: chunkText.length,
            startChar: start,
            endChar: end
          }
        });
        index++;
      }

      start = end;
    }

    return chunks;
  }

  estimatePages(content) {
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / 250);
  }

  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  async getAllDocuments() {
    return Array.from(this.documents.values()).map(doc => ({
      id: doc.id,
      filename: doc.filename,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      processedAt: doc.processedAt,
      pages: doc.pages,
      wordCount: doc.wordCount,
      chunks: doc.chunks?.length || 0,
      metadata: doc.metadata
    }));
  }

  async getDocument(id) {
    return this.documents.get(id);
  }

  async deleteDocument(id) {
    const document = this.documents.get(id);
    if (!document) {
      throw new Error('Document not found');
    }

    // Remove from memory
    this.documents.delete(id);
    
    // Save updated documents
    await this.saveDocuments();

    logger.info(`Deleted document: ${id}`);
    return true;
  }
}
