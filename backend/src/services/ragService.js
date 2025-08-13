import OpenAI from 'openai';
import { ChromaClient } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export class RAGService {
  constructor() {
    this.openai = null;
    this.chroma = null;
    this.collection = null;
    this.queryHistory = new Map();
    this.isInitialized = false;
    this.mcpClient = null; // Add MCP client support
  }

  // Method to set MCP client (to be called during initialization)
  setMCPClient(mcpClient) {
    this.mcpClient = mcpClient;
    logger.info('MCP client set for RAGService');
  }

  // Method to call MCP tools
  async callMCPTool(serverName, toolName, args = {}) {
    if (!this.mcpClient) {
      logger.warn('MCP client not available, skipping MCP tool call');
      return null;
    }

    try {
      return await this.mcpClient.callTool(serverName, toolName, args);
    } catch (error) {
      logger.error(`Error calling MCP tool ${serverName}:${toolName}:`, error);
      return null; // Return null instead of throwing to allow query to continue
    }
  }

  async initialize() {
    try {
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: process.env.OPENAI_BASE_URL,
          
        });
        logger.info('OpenAI client initialized');
      } else {
        logger.warn('OpenAI API key not found. LLM features will be limited.');
      }

      // Initialize ChromaDB
      try {
        this.chroma = new ChromaClient({
          path: process.env.CHROMA_URL || 'http://localhost:8001'
        });

        const embeddingDimension = parseInt(process.env.EMBEDDING_DIMENSION, 10);
        if (isNaN(embeddingDimension)) {
          throw new Error('EMBEDDING_DIMENSION is not set in your .env file.');
        }
        
        // Test connection with a timeout
        const testPromise = this.chroma.getOrCreateCollection({
          name: 'padalayai_documents',
          metadata: {
            "hnsw:space": "l2",
            "hnsw:dim": embeddingDimension,
            'description': 'Document chunks for Padalayai'
          }
        });
        
        // Add timeout to prevent hanging
        this.collection = await Promise.race([
          testPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ChromaDB connection timeout')), 5000)
          )
        ]);
        
        logger.info('ChromaDB initialized successfully');
      } catch (chromaError) {
        logger.warn(`ChromaDB not available (${chromaError.message}), using in-memory vector store`);
        this.chroma = null;
        this.collection = new InMemoryVectorStore();
      }

      // Load query history
      await this.loadQueryHistory();

      this.isInitialized = true;
      logger.info('RAG service initialized successfully');

    } catch (error) {
      logger.error('Error initializing RAG service:', error);
      throw error;
    }
  }

  async loadQueryHistory() {
    try {
      const historyFile = 'data/query_history.json';
      const data = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(data);
      
      history.forEach(query => {
        this.queryHistory.set(query.id, query);
      });
      
      logger.info(`Loaded ${history.length} queries from history`);
    } catch (error) {
      logger.info('No existing query history found, starting fresh');
    }
  }

  async saveQueryHistory() {
    try {
      const historyFile = 'data/query_history.json';
      const history = Array.from(this.queryHistory.values());
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      logger.error('Error saving query history:', error);
    }
  }

  async addDocument(documentInfo) {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    try {
      logger.info(`Adding document to vector store: ${documentInfo.filename}`);

      // Generate embeddings for each chunk
      const chunks = documentInfo.chunks || [];
      const embeddings = [];
      const documents = [];
      const metadatas = [];
      const ids = [];

      for (const chunk of chunks) {
        // Generate embedding
        const embedding = await this.generateEmbedding(chunk.text);
        
        embeddings.push(embedding);
        documents.push(chunk.text);
        ids.push(chunk.id);
        metadatas.push({
          documentId: documentInfo.id,
          filename: documentInfo.filename,
          chunkIndex: chunk.index,
          chunkSize: chunk.text.length,
          documentSize: documentInfo.size,
          uploadedAt: documentInfo.uploadedAt
        });
      }

      // Add to vector store
      if (this.collection.add) {
        try {
          await this.collection.add({
            ids,
            embeddings,
            documents,
            metadatas
          });
        } catch (chromaError) {
          logger.warn(`ChromaDB error during add operation: ${chromaError.message}`);
          
          // If it's a compaction error, try to reinitialize ChromaDB
          if (chromaError.message.includes('compaction') || chromaError.message.includes('log store')) {
            logger.info('Attempting to reinitialize ChromaDB due to compaction error...');
            try {
              // Try to recreate the collection
              this.collection = await this.chroma.getOrCreateCollection({
                name: 'padalayai_documents_new',
                metadata: { description: 'Document chunks for PadalayAI (recreated)' }
              });
              
              // Retry the add operation
              await this.collection.add({
                ids,
                embeddings,
                documents,
                metadatas
              });
              
              logger.info('Successfully recovered from ChromaDB compaction error');
            } catch (retryError) {
              logger.warn('Failed to recover from ChromaDB error, falling back to in-memory store');
              this.collection = new InMemoryVectorStore();
              this.collection.addDocuments(ids, embeddings, documents, metadatas);
            }
          } else {
            // For other errors, fall back to in-memory store
            logger.warn('ChromaDB error, falling back to in-memory store');
            this.collection = new InMemoryVectorStore();
            this.collection.addDocuments(ids, embeddings, documents, metadatas);
          }
        }
      } else {
        // In-memory store
        this.collection.addDocuments(ids, embeddings, documents, metadatas);
      }

      logger.info(`Added ${chunks.length} chunks to vector store for document: ${documentInfo.filename}`);

    } catch (error) {
      logger.error(`Error adding document to vector store:`, error);
      throw error;
    }
  }

  async removeDocument(documentId) {
    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    try {
      logger.info(`Removing document from vector store: ${documentId}`);

      if (this.collection.delete) {
        // ChromaDB
        await this.collection.delete({
          where: { documentId: documentId }
        });
      } else {
        // In-memory store
        this.collection.removeDocument(documentId);
      }

      logger.info(`Removed document from vector store: ${documentId}`);

    } catch (error) {
      logger.error(`Error removing document from vector store:`, error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    if (this.openai) {
      try {
        const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
        
        // Handle Cohere embedding models differently
        if (embeddingModel.includes('cohere')) {
          const response = await this.openai.embeddings.create({
            model: embeddingModel,
            input: text,
            embedding_types: ["float"]
          });
          return response.data[0].embedding;
        } else {
          const response = await this.openai.embeddings.create({
            model: embeddingModel,
            input: text
          });
          return response.data[0].embedding;
        }
      } catch (error) {
        console.error(error)
        logger.warn('Error generating OpenAI embedding, using fallback:', error.message);
      }
    }

    // Fallback: simple TF-IDF-like embedding
    return this.generateSimpleEmbedding(text);
  }

  generateSimpleEmbedding(text, dimensions = 384) {
    // Simple hash-based embedding for demo purposes
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const embedding = new Array(dimensions).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const pos = Math.abs(hash) % dimensions;
      embedding[pos] += 1 / Math.sqrt(words.length);
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  async query(options) {
    const {
      query,
      documentIds = [],
      maxResults = 5,
      temperature = 0.7,
      includeContext = true,
      filterBy = null, // New: filter by metadata
      analysisType = 'content' // New: 'content', 'style', 'persona', 'genre'
    } = options;

    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    try {
      logger.info(`Processing RAG query: "${query.substring(0, 100)}..."`);

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Search for relevant chunks from documents
      const searchResults = await this.searchSimilarChunks({
        embedding: queryEmbedding,
        documentIds,
        maxResults: maxResults * 2 // Get more results for better context
      });

      // Try to get additional context from MCP servers if available
      const mcpContext = await this.getMCPContext(query, analysisType);

      // Combine document chunks with MCP context
      let allContext = [...searchResults.chunks];
      if (mcpContext && mcpContext.length > 0) {
        allContext = [...allContext, ...mcpContext];
        logger.info(`Added ${mcpContext.length} MCP context items to query`);
      }

      // Generate answer using LLM with combined context
      const answer = await this.generateAnswer({
        query,
        context: allContext,
        temperature,
        analysisType
      });

      // Create query result
      const queryResult = {
        id: uuidv4(),
        query,
        answer,
        sources: allContext.slice(0, maxResults).map(chunk => ({
          id: chunk.id,
          text: chunk.text,
          documentId: chunk.metadata?.documentId || chunk.id,
          filename: chunk.metadata?.filename || chunk.filename || 'MCP Source',
          chunkIndex: chunk.metadata?.chunkIndex || 0,
          similarity: chunk.similarity || 1.0,
          platform: chunk.metadata?.platform || chunk.platform,
          url: chunk.metadata?.url || chunk.url
        })),
        context: includeContext ? allContext.map(c => c.text).join('\n\n') : undefined,
        confidence: this.calculateConfidence(allContext),
        documentsSearched: searchResults.documentsSearched,
        mcpSourcesUsed: mcpContext ? mcpContext.length : 0,
        timestamp: new Date().toISOString(),
        metadata: {
          temperature,
          maxResults,
          totalChunksFound: searchResults.chunks.length,
          mcpContextAdded: mcpContext ? mcpContext.length : 0,
          analysisType
        }
      };

      // Save to history
      this.queryHistory.set(queryResult.id, queryResult);
      await this.saveQueryHistory();

      return queryResult;

    } catch (error) {
      logger.error('Error processing RAG query:', error);
      throw error;
    }
  }

  // New method to get additional context from MCP servers
  async getMCPContext(query, analysisType = 'content') {
    if (!this.mcpClient) {
      return [];
    }

    const mcpContext = [];

    try {
      // Try to get recent blog posts from blogger server for additional context
      const bloggerResponse = await this.callMCPTool('blogger-server', 'get_blog_posts', {
        maxResults: 5 // Get a few recent posts for context
      });

      if (bloggerResponse && bloggerResponse.content && bloggerResponse.content[0]) {
        const data = JSON.parse(bloggerResponse.content[0].text);
        
        // Convert blog posts to context chunks
        data.posts.forEach((post, index) => {
          mcpContext.push({
            id: `blogger-${post.id}`,
            text: `Title: ${post.title}\n\nContent: ${post.content}`,
            filename: `Blog Post: ${post.title}`,
            platform: 'blogger',
            url: post.url,
            similarity: 0.8, // Give MCP sources a decent similarity score
            metadata: {
              platform: 'blogger',
              originalId: post.id,
              title: post.title,
              url: post.url,
              publishedAt: post.published
            }
          });
        });

        logger.info(`Retrieved ${data.posts.length} blog posts from MCP blogger server`);
      }

      // TODO: Add other MCP servers (Facebook, Instagram) when they're ready
      // const facebookResponse = await this.callMCPTool('facebook-server', 'get_facebook_posts', { limit: 5 });
      // const instagramResponse = await this.callMCPTool('instagram-server', 'get_instagram_media', { limit: 5 });

    } catch (error) {
      logger.warn('Error getting MCP context:', error);
      // Don't throw error, just continue without MCP context
    }

    return mcpContext;
  }

  async searchSimilarChunks(options) {
    const { embedding, documentIds, maxResults = 10 } = options;

    try {
      let results;
      let documentsSearched = 0;

      if (this.collection.query) {
        // ChromaDB
        const whereClause = documentIds.length > 0 
          ? { documentId: { $in: documentIds } }
          : undefined;

        const queryResult = await this.collection.query({
          queryEmbeddings: [embedding],
          nResults: maxResults,
          where: whereClause
        });

        results = queryResult.documents[0].map((doc, index) => ({
          id: queryResult.ids[0][index],
          text: doc,
          metadata: queryResult.metadatas[0][index],
          similarity: 1 - (queryResult.distances[0][index] || 0)
        }));

        documentsSearched = new Set(results.map(r => r.metadata.documentId)).size;

      } else {
        // In-memory store
        const searchResult = this.collection.search(embedding, documentIds, maxResults);
        results = searchResult.chunks;
        documentsSearched = searchResult.documentsSearched;
      }

      return {
        chunks: results,
        documentsSearched
      };

    } catch (error) {
      logger.error('Error searching similar chunks:', error);
      throw error;
    }
  }

  async generateAnswer(options) {
    const { query, context, temperature = 0.7, analysisType = 'content' } = options;

    if (this.openai) {
      try {
        const contextText = context.map(chunk => chunk.text || chunk).join('\n\n');
        
        // Create analysis-specific system prompts
        const systemPrompts = {
          content: 'You are a helpful assistant that analyzes documents and social media content for authors. Provide clear, accurate answers based on the provided context from both documents and social media posts. If information is not available in the context, clearly state that.',
          style: 'You are a writing style analyst. Analyze the writing style, tone, formality, sentence structure, and voice based on the provided context from documents and social media content. Focus on patterns and characteristics of the author\'s writing.',
          persona: 'You are an author persona analyst. Analyze the author\'s voice, personality traits, expertise level, and communication style based on the provided context from documents and social media content. Focus on how the author presents themselves.',
          genre: 'You are a content genre analyst. Analyze and classify the content types, themes, and genres based on the provided context from documents and social media content. Focus on categorization and content characteristics.'
        };

        const systemPrompt = systemPrompts[analysisType] || systemPrompts.content;
        
        const prompt = `Based on the following context from the author's documents and social media content, please answer the question. The context includes both uploaded documents and recent social media posts for comprehensive analysis.

Context:
${contextText}

Question: ${query}

Answer:`;

        const response = await this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature,
          max_tokens: 500
        });

        return response.choices[0].message.content.trim();

      } catch (error) {
        console.error(error)
        logger.warn('Error generating OpenAI answer, using fallback:', error.message);
      }
    }

    // Fallback: simple extractive answer
    return this.generateSimpleAnswer(query, context);
  }

  generateSimpleAnswer(query, context) {
    if (!context || context.length === 0) {
      return "I couldn't find relevant information in the documents to answer your question.";
    }

    // Find the most relevant chunk
    const queryWords = query.toLowerCase().split(/\s+/);
    let bestChunk = context[0];
    let bestScore = 0;

    context.forEach(chunk => {
      const chunkText = (chunk.text || chunk).toLowerCase();
      const score = queryWords.reduce((acc, word) => {
        return acc + (chunkText.includes(word) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
      }
    });

    const chunkText = bestChunk.text || bestChunk;
    
    // Extract a relevant sentence
    const sentences = chunkText.split(/[.!?]+/);
    const relevantSentence = sentences.find(sentence => 
      queryWords.some(word => sentence.toLowerCase().includes(word))
    ) || sentences[0];

    return `Based on the documents: ${relevantSentence.trim()}.`;
  }

  calculateConfidence(chunks) {
    if (!chunks || chunks.length === 0) return 0;
    
    const avgSimilarity = chunks.reduce((sum, chunk) => sum + (chunk.similarity || 0), 0) / chunks.length;
    return Math.round(avgSimilarity * 100) / 100;
  }

  async semanticSearch(options) {
    const { query, documentIds, maxResults, threshold } = options;
    
    const queryEmbedding = await this.generateEmbedding(query);
    const results = await this.searchSimilarChunks({
      embedding: queryEmbedding,
      documentIds,
      maxResults
    });

    // Filter by threshold
    const filteredChunks = results.chunks.filter(chunk => 
      (chunk.similarity || 0) >= threshold
    );

    return {
      chunks: filteredChunks,
      documentsSearched: results.documentsSearched,
      totalChunks: results.chunks.length
    };
  }

  async getQueryHistory(options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    const allQueries = Array.from(this.queryHistory.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      queries: allQueries.slice(offset, offset + limit),
      total: allQueries.length
    };
  }

  async getQueryResult(queryId) {
    return this.queryHistory.get(queryId);
  }

  async generateQuestionSuggestions(options) {
    const { documentId, count = 5 } = options;
    
    // This is a simplified implementation
    // In a real system, you'd analyze document content to generate relevant questions
    const suggestions = [
      "What are the main themes in this document?",
      "Can you summarize the key points?",
      "What are the strengths and weaknesses mentioned?",
      "Are there any contradictions or inconsistencies?",
      "What questions does this document raise?"
    ];

    return {
      questions: suggestions.slice(0, count),
      chunksAnalyzed: 0 // Placeholder
    };
  }

  async exportQueryResults(options) {
    const { queryIds, format = 'json' } = options;
    
    const queries = queryIds.map(id => this.queryHistory.get(id)).filter(Boolean);
    
    if (format === 'json') {
      return JSON.stringify(queries, null, 2);
    } else if (format === 'csv') {
      // Simple CSV export
      const headers = 'Query,Answer,Timestamp,Confidence\n';
      const rows = queries.map(q => 
        `"${q.query}","${q.answer}","${q.timestamp}","${q.confidence}"`
      ).join('\n');
      return headers + rows;
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  async clearQueryHistory(cutoffDate) {
    let deletedCount = 0;
    
    if (cutoffDate) {
      for (const [id, query] of this.queryHistory.entries()) {
        if (new Date(query.timestamp) < cutoffDate) {
          this.queryHistory.delete(id);
          deletedCount++;
        }
      }
    } else {
      deletedCount = this.queryHistory.size;
      this.queryHistory.clear();
    }

    await this.saveQueryHistory();
    return deletedCount;
  }
}

// Simple in-memory vector store for fallback
class InMemoryVectorStore {
  constructor() {
    this.documents = [];
  }

  addDocuments(ids, embeddings, documents, metadatas) {
    for (let i = 0; i < ids.length; i++) {
      this.documents.push({
        id: ids[i],
        embedding: embeddings[i],
        text: documents[i],
        metadata: metadatas[i]
      });
    }
  }

  removeDocument(documentId) {
    this.documents = this.documents.filter(doc => 
      doc.metadata.documentId !== documentId
    );
  }

  search(queryEmbedding, documentIds, maxResults) {
    let candidates = this.documents;
    
    if (documentIds.length > 0) {
      candidates = candidates.filter(doc => 
        documentIds.includes(doc.metadata.documentId)
      );
    }

    // Calculate similarities
    const results = candidates.map(doc => ({
      ...doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    
    const documentsSearched = new Set(results.map(r => r.metadata.documentId)).size;

    return {
      chunks: results.slice(0, maxResults),
      documentsSearched
    };
  }

  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
