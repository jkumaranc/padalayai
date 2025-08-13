import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class DocumentProcessor {
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

      // Extract text content based on file type
      const content = await this.extractContent(fileInfo.filepath, fileInfo.mimetype);
      
      // Split content into chunks
      const chunks = this.chunkText(content, {
        chunkSize: 1000,
        chunkOverlap: 200
      });

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
        chunks: chunks.map((chunk, index) => ({
          id: `${fileInfo.id}-chunk-${index}`,
          text: chunk,
          index,
          documentId: fileInfo.id,
          metadata: {
            chunkSize: chunk.length,
            startChar: content.indexOf(chunk),
            endChar: content.indexOf(chunk) + chunk.length
          }
        })),
        pages: this.estimatePages(content),
        wordCount: this.countWords(content),
        metadata: {
          language: this.detectLanguage(content),
          readingTime: Math.ceil(this.countWords(content) / 200) // Assuming 200 WPM
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

  async extractContent(filepath, mimetype) {
    try {
      const fileBuffer = await fs.readFile(filepath);

      switch (mimetype) {
        case 'application/pdf':
          const pdfData = await pdfParse(fileBuffer);
          return pdfData.text;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
          return docxResult.value;

        case 'text/plain':
        case 'text/markdown':
          return fileBuffer.toString('utf8');

        case 'application/vnd.apple.pages':
        case 'application/x-iwork-pages-sffpages':
          // Apple Pages files are not supported without additional parsing
          throw new Error('Apple Pages files are not currently supported. Please export to PDF or DOCX format.');

        default:
          // Try to read as text
          return fileBuffer.toString('utf8');
      }
    } catch (error) {
      logger.error(`Error extracting content from ${filepath}:`, error);
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  chunkText(text, options = {}) {
    const {
      chunkSize = 1000,
      chunkOverlap = 200,
      separators = ['\n\n', '\n', '. ', ' ']
    } = options;

    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      
      // If we're not at the end of the text, try to find a good breaking point
      if (end < text.length) {
        let bestBreak = end;
        
        // Look for separators in reverse order of preference
        for (const separator of separators) {
          const lastIndex = text.lastIndexOf(separator, end);
          if (lastIndex > start + chunkSize * 0.5) { // Don't break too early
            bestBreak = lastIndex + separator.length;
            break;
          }
        }
        
        end = bestBreak;
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Move start position with overlap
      start = Math.max(start + chunkSize - chunkOverlap, end);
    }

    return chunks;
  }

  estimatePages(content) {
    // Rough estimate: 250 words per page
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / 250);
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  detectLanguage(text) {
    // Simple language detection based on common words
    const sample = text.toLowerCase().slice(0, 1000);
    
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.reduce((count, word) => {
      return count + (sample.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);

    // If we find enough English words, assume English
    if (englishCount > 5) {
      return 'en';
    }

    return 'unknown';
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

  async searchDocuments(query, options = {}) {
    const {
      limit = 10,
      includeContent = false
    } = options;

    const results = [];
    const queryLower = query.toLowerCase();

    for (const doc of this.documents.values()) {
      let relevanceScore = 0;
      
      // Check filename
      if (doc.filename.toLowerCase().includes(queryLower)) {
        relevanceScore += 10;
      }

      // Check content
      if (doc.content && doc.content.toLowerCase().includes(queryLower)) {
        relevanceScore += 5;
        
        // Count occurrences
        const matches = (doc.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
        relevanceScore += matches;
      }

      if (relevanceScore > 0) {
        results.push({
          document: includeContent ? doc : {
            id: doc.id,
            filename: doc.filename,
            size: doc.size,
            uploadedAt: doc.uploadedAt,
            processedAt: doc.processedAt,
            pages: doc.pages,
            wordCount: doc.wordCount
          },
          relevanceScore
        });
      }
    }

    // Sort by relevance and limit results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  // Method to add already processed documents (for social media content)
  async addDocument(documentInfo) {
    try {
      // Store document
      this.documents.set(documentInfo.id, documentInfo);
      await this.saveDocuments();
      
      logger.info(`Added processed document: ${documentInfo.filename}`);
      return documentInfo;
    } catch (error) {
      logger.error(`Error adding document ${documentInfo.filename}:`, error);
      throw error;
    }
  }

  getDocumentStats() {
    const documents = Array.from(this.documents.values());
    
    return {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + (doc.size || 0), 0),
      totalPages: documents.reduce((sum, doc) => sum + (doc.pages || 0), 0),
      totalWords: documents.reduce((sum, doc) => sum + (doc.wordCount || 0), 0),
      totalChunks: documents.reduce((sum, doc) => sum + (doc.chunks?.length || 0), 0),
      averageWordsPerDocument: documents.length > 0 
        ? Math.round(documents.reduce((sum, doc) => sum + (doc.wordCount || 0), 0) / documents.length)
        : 0
    };
  }
}
