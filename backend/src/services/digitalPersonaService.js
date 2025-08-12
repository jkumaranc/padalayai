import { RAGService } from './ragService.js';
import { DocumentProcessor } from './documentProcessor.js';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class DigitalPersonaService {
  constructor() {
    this.ragService = null;
    this.documentProcessor = null;
    this.isInitialized = false;
    this.socialMediaContent = new Map(); // Cache for social media content
    this.lastSyncTime = new Map(); // Track last sync time for each platform
  }

  async initialize() {
    try {
      // Initialize RAG service and document processor
      this.ragService = new RAGService();
      await this.ragService.initialize();
      
      this.documentProcessor = new DocumentProcessor();
      await this.documentProcessor.initializeStorage();

      this.isInitialized = true;
      logger.info('Digital Persona service initialized successfully');
    } catch (error) {
      logger.error('Error initializing Digital Persona service:', error);
      throw error;
    }
  }

  async syncSocialMediaContent(platforms = ['blogger', 'facebook', 'instagram']) {
    if (!this.isInitialized) {
      throw new Error('Digital Persona service not initialized');
    }

    const results = {
      blogger: null,
      facebook: null,
      instagram: null,
      totalProcessed: 0,
      errors: []
    };

    for (const platform of platforms) {
      try {
        logger.info(`Syncing content from ${platform}...`);
        
        let content = [];
        switch (platform) {
          case 'blogger':
            content = await this.fetchBloggerContent();
            break;
          case 'facebook':
            content = await this.fetchFacebookContent();
            break;
          case 'instagram':
            content = await this.fetchInstagramContent();
            break;
          default:
            logger.warn(`Unknown platform: ${platform}`);
            continue;
        }

        if (content.length > 0) {
          const processed = await this.processAndIndexContent(content, platform);
          results[platform] = {
            fetched: content.length,
            processed: processed.length,
            lastSync: new Date().toISOString()
          };
          results.totalProcessed += processed.length;
          
          // Update cache and sync time
          this.socialMediaContent.set(platform, content);
          this.lastSyncTime.set(platform, new Date());
          
          logger.info(`Successfully synced ${processed.length} items from ${platform}`);
        } else {
          results[platform] = {
            fetched: 0,
            processed: 0,
            lastSync: new Date().toISOString()
          };
          logger.info(`No new content found on ${platform}`);
        }

      } catch (error) {
        logger.error(`Error syncing ${platform}:`, error);
        results.errors.push({
          platform,
          error: error.message
        });
      }
    }

    return results;
  }

  async fetchBloggerContent() {
    // This would use the MCP blogger server
    // For now, return mock data structure
    return [
      {
        id: 'blog-1',
        title: 'Sample Blog Post',
        content: 'This is sample blog content that would be fetched from Blogger API',
        published: new Date().toISOString(),
        url: 'https://example.blogspot.com/post1',
        platform: 'blogger'
      }
    ];
  }

  async fetchFacebookContent() {
    // This would use the MCP facebook server
    // For now, return mock data structure
    return [
      {
        id: 'fb-1',
        message: 'Sample Facebook post content',
        created_time: new Date().toISOString(),
        permalink_url: 'https://facebook.com/post1',
        platform: 'facebook'
      }
    ];
  }

  async fetchInstagramContent() {
    // This would use the MCP instagram server
    // For now, return mock data structure
    return [
      {
        id: 'ig-1',
        caption: 'Sample Instagram post caption',
        timestamp: new Date().toISOString(),
        permalink: 'https://instagram.com/p/post1',
        platform: 'instagram'
      }
    ];
  }

  async processAndIndexContent(content, platform) {
    const processedItems = [];

    for (const item of content) {
      try {
        // Create a unified document structure
        const document = this.createUnifiedDocument(item, platform);
        
        // Process the document using existing document processor
        const processedDoc = await this.processDocument(document);
        
        // Add to RAG service
        await this.ragService.addDocument(processedDoc);
        
        processedItems.push(processedDoc);
        
      } catch (error) {
        logger.error(`Error processing ${platform} item ${item.id}:`, error);
      }
    }

    return processedItems;
  }

  createUnifiedDocument(item, platform) {
    const id = `${platform}-${item.id}`;
    let content = '';
    let title = '';
    let url = '';
    let publishedAt = '';

    switch (platform) {
      case 'blogger':
        title = item.title || 'Untitled Blog Post';
        content = item.content || '';
        url = item.url || '';
        publishedAt = item.published || '';
        break;
      case 'facebook':
        title = 'Facebook Post';
        content = item.message || item.story || '';
        url = item.permalink_url || '';
        publishedAt = item.created_time || '';
        break;
      case 'instagram':
        title = 'Instagram Post';
        content = item.caption || '';
        url = item.permalink || '';
        publishedAt = item.timestamp || '';
        break;
    }

    return {
      id,
      filename: `${platform}-${item.id}.txt`,
      content: `Title: ${title}\n\nContent: ${content}\n\nURL: ${url}\n\nPublished: ${publishedAt}`,
      platform,
      originalId: item.id,
      title,
      url,
      publishedAt,
      size: content.length,
      uploadedAt: new Date().toISOString()
    };
  }

  async processDocument(document) {
    // Use the existing document processor logic
    const chunks = this.chunkText(document.content, {
      chunkSize: 1000,
      chunkOverlap: 200
    });

    return {
      id: document.id,
      filename: document.filename,
      filepath: null, // Social media content doesn't have a file path
      mimetype: 'text/plain',
      size: document.size,
      uploadedAt: document.uploadedAt,
      processedAt: new Date().toISOString(),
      content: document.content,
      chunks: chunks.map((chunk, index) => ({
        id: `${document.id}-chunk-${index}`,
        text: chunk,
        index,
        documentId: document.id,
        metadata: {
          chunkSize: chunk.length,
          startChar: document.content.indexOf(chunk),
          endChar: document.content.indexOf(chunk) + chunk.length,
          platform: document.platform,
          originalId: document.originalId,
          title: document.title,
          url: document.url,
          publishedAt: document.publishedAt
        }
      })),
      pages: this.estimatePages(document.content),
      wordCount: this.countWords(document.content),
      metadata: {
        language: this.detectLanguage(document.content),
        readingTime: Math.ceil(this.countWords(document.content) / 200),
        platform: document.platform,
        originalId: document.originalId,
        title: document.title,
        url: document.url,
        publishedAt: document.publishedAt
      }
    };
  }

  // Utility methods borrowed from DocumentProcessor
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
      
      if (end < text.length) {
        let bestBreak = end;
        
        for (const separator of separators) {
          const lastIndex = text.lastIndexOf(separator, end);
          if (lastIndex > start + chunkSize * 0.5) {
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

      start = Math.max(start + chunkSize - chunkOverlap, end);
    }

    return chunks;
  }

  estimatePages(content) {
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / 250);
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  detectLanguage(text) {
    const sample = text.toLowerCase().slice(0, 1000);
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.reduce((count, word) => {
      return count + (sample.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    }, 0);

    if (englishCount > 5) {
      return 'en';
    }

    return 'unknown';
  }

  async queryDigitalPersona(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Digital Persona service not initialized');
    }

    // Use the existing RAG service to query across all content including social media
    const result = await this.ragService.query({
      query,
      ...options
    });

    // Enhance the result with platform information
    if (result.sources) {
      result.sources = result.sources.map(source => {
        const platformInfo = this.extractPlatformInfo(source);
        return {
          ...source,
          ...platformInfo
        };
      });
    }

    return result;
  }

  extractPlatformInfo(source) {
    const metadata = source.metadata || {};
    
    return {
      platform: metadata.platform || 'document',
      originalId: metadata.originalId,
      title: metadata.title,
      url: metadata.url,
      publishedAt: metadata.publishedAt
    };
  }

  async getDigitalPersonaStats() {
    const stats = {
      platforms: {},
      totalContent: 0,
      lastSyncTimes: {},
      ragStats: null
    };

    // Get platform-specific stats
    for (const [platform, content] of this.socialMediaContent.entries()) {
      stats.platforms[platform] = {
        itemCount: content.length,
        lastSync: this.lastSyncTime.get(platform)?.toISOString() || null
      };
      stats.totalContent += content.length;
    }

    // Get last sync times
    for (const [platform, time] of this.lastSyncTime.entries()) {
      stats.lastSyncTimes[platform] = time.toISOString();
    }

    // Get RAG service stats if available
    if (this.ragService && this.documentProcessor) {
      stats.ragStats = this.documentProcessor.getDocumentStats();
    }

    return stats;
  }

  async removePlatformContent(platform) {
    if (!this.isInitialized) {
      throw new Error('Digital Persona service not initialized');
    }

    try {
      // Get all documents for this platform
      const allDocs = await this.documentProcessor.getAllDocuments();
      const platformDocs = allDocs.filter(doc => 
        doc.metadata && doc.metadata.platform === platform
      );

      // Remove each document from RAG service
      for (const doc of platformDocs) {
        await this.ragService.removeDocument(doc.id);
        await this.documentProcessor.deleteDocument(doc.id);
      }

      // Clear cache
      this.socialMediaContent.delete(platform);
      this.lastSyncTime.delete(platform);

      logger.info(`Removed ${platformDocs.length} documents from ${platform}`);
      return platformDocs.length;

    } catch (error) {
      logger.error(`Error removing ${platform} content:`, error);
      throw error;
    }
  }
}
