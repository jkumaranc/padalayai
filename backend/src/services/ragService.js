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
      includeContext = true
    } = options;

    if (!this.isInitialized) {
      throw new Error('RAG service not initialized');
    }

    try {
      logger.info(`Processing RAG query: "${query.substring(0, 100)}..."`);

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Search for relevant chunks
      const searchResults = await this.searchSimilarChunks({
        embedding: queryEmbedding,
        documentIds,
        maxResults: maxResults * 2 // Get more results for better context
      });

      // Generate answer using LLM
      const answer = await this.generateAnswer({
        query,
        context: searchResults.chunks,
        temperature
      });

      // Create query result
      const queryResult = {
        id: uuidv4(),
        query,
        answer,
        sources: searchResults.chunks.slice(0, maxResults).map(chunk => ({
          id: chunk.id,
          text: chunk.text,
          documentId: chunk.metadata.documentId,
          filename: chunk.metadata.filename,
          chunkIndex: chunk.metadata.chunkIndex,
          similarity: chunk.similarity
        })),
        context: includeContext ? searchResults.chunks.map(c => c.text).join('\n\n') : undefined,
        confidence: this.calculateConfidence(searchResults.chunks),
        documentsSearched: searchResults.documentsSearched,
        timestamp: new Date().toISOString(),
        metadata: {
          temperature,
          maxResults,
          totalChunksFound: searchResults.chunks.length
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
    const { query, context, temperature = 0.7 } = options;

    if (this.openai) {
      try {
        const contextText = context.map(chunk => chunk.text || chunk).join('\n\n');
        
        const prompt = `Based on the following context from the author's documents, please answer the question. If the answer cannot be found in the context, please say so.

Context:
${contextText}

Question: ${query}

Answer:`;

        const response = await this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that analyzes documents for authors. Provide clear, accurate answers based on the provided context. If information is not available in the context, clearly state that.'
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
