import express from 'express';
import { getRAGService } from '../services/index.js';
import { validateQuery } from '../middleware/validation.js';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Query documents using RAG
router.post('/', validateQuery, async (req, res) => {
  try {
    const { 
      query, 
      documentIds = [], 
      maxResults = 5, 
      temperature = 0.7,
      includeContext = true,
      analysisType = 'content',
      enhancedQuery
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query cannot be empty'
      });
    }

    logger.info(`Processing query: "${query.substring(0, 100)}..."`);

    const startTime = Date.now();
    
    // Execute RAG query
    const ragService = getRAGService();
    const result = await ragService.query({
      query: query.trim(),
      documentIds,
      maxResults: Math.min(maxResults, 20), // Cap at 20 results
      temperature: Math.max(0, Math.min(temperature, 1)), // Clamp between 0-1
      includeContext
    });

    const processingTime = Date.now() - startTime;

    logger.info(`Query processed in ${processingTime}ms`);

    res.json({
      success: true,
      query: query.trim(),
      answer: result.answer,
      sources: result.sources,
      context: includeContext ? result.context : undefined,
      metadata: {
        processingTime,
        documentsSearched: result.documentsSearched,
        chunksRetrieved: result.sources.length,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error processing query:', error);
    res.status(500).json({
      error: 'Failed to process query',
      message: error.message
    });
  }
});

// Get query history
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const ragService = getRAGService();
    const history = await ragService.getQueryHistory({
      limit: Math.min(parseInt(limit), 100), // Cap at 100
      offset: Math.max(parseInt(offset), 0)
    });

    res.json({
      success: true,
      history: history.queries,
      pagination: {
        total: history.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: history.total > (parseInt(offset) + parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error retrieving query history:', error);
    res.status(500).json({
      error: 'Failed to retrieve query history',
      message: error.message
    });
  }
});

// Get specific query result
router.get('/:queryId', async (req, res) => {
  try {
    const { queryId } = req.params;
    
    const ragService = getRAGService();
    const queryResult = await ragService.getQueryResult(queryId);
    
    if (!queryResult) {
      return res.status(404).json({
        error: 'Query result not found'
      });
    }

    res.json({
      success: true,
      result: queryResult
    });

  } catch (error) {
    logger.error('Error retrieving query result:', error);
    res.status(500).json({
      error: 'Failed to retrieve query result',
      message: error.message
    });
  }
});

// Semantic search (without LLM generation)
router.post('/search', validateQuery, async (req, res) => {
  try {
    const { 
      query, 
      documentIds = [], 
      maxResults = 10,
      threshold = 0.7 
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query cannot be empty'
      });
    }

    logger.info(`Processing semantic search: "${query.substring(0, 100)}..."`);

    const startTime = Date.now();
    
    // Execute semantic search
    const ragService = getRAGService();
    const results = await ragService.semanticSearch({
      query: query.trim(),
      documentIds,
      maxResults: Math.min(maxResults, 50), // Cap at 50 results
      threshold: Math.max(0, Math.min(threshold, 1)) // Clamp between 0-1
    });

    const processingTime = Date.now() - startTime;

    logger.info(`Semantic search completed in ${processingTime}ms`);

    res.json({
      success: true,
      query: query.trim(),
      results: results.chunks,
      metadata: {
        processingTime,
        documentsSearched: results.documentsSearched,
        totalChunks: results.totalChunks,
        threshold,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error processing semantic search:', error);
    res.status(500).json({
      error: 'Failed to process semantic search',
      message: error.message
    });
  }
});

// Get suggested questions based on document content
router.get('/suggestions/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { count = 5 } = req.query;

    logger.info(`Generating question suggestions for document: ${documentId}`);

    const ragService = getRAGService();
    const suggestions = await ragService.generateQuestionSuggestions({
      documentId,
      count: Math.min(parseInt(count), 10) // Cap at 10 suggestions
    });

    res.json({
      success: true,
      documentId,
      suggestions: suggestions.questions,
      metadata: {
        generatedAt: new Date().toISOString(),
        basedOnChunks: suggestions.chunksAnalyzed
      }
    });

  } catch (error) {
    logger.error('Error generating question suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate question suggestions',
      message: error.message
    });
  }
});

// Export query results
router.post('/export', async (req, res) => {
  try {
    const { queryIds, format = 'json' } = req.body;

    if (!queryIds || !Array.isArray(queryIds) || queryIds.length === 0) {
      return res.status(400).json({
        error: 'Query IDs array is required'
      });
    }

    logger.info(`Exporting ${queryIds.length} query results in ${format} format`);

    const exportData = await ragService.exportQueryResults({
      queryIds: queryIds.slice(0, 100), // Limit to 100 queries
      format
    });

    const filename = `padalayai-queries-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    
    res.send(exportData);

  } catch (error) {
    logger.error('Error exporting query results:', error);
    res.status(500).json({
      error: 'Failed to export query results',
      message: error.message
    });
  }
});

// Clear query history
router.delete('/history', async (req, res) => {
  try {
    const { olderThan } = req.query;
    
    let cutoffDate;
    if (olderThan) {
      cutoffDate = new Date(olderThan);
      if (isNaN(cutoffDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format for olderThan parameter'
        });
      }
    }

    const deletedCount = await ragService.clearQueryHistory(cutoffDate);

    logger.info(`Cleared ${deletedCount} query history entries`);

    res.json({
      success: true,
      message: `Cleared ${deletedCount} query history entries`,
      deletedCount
    });

  } catch (error) {
    logger.error('Error clearing query history:', error);
    res.status(500).json({
      error: 'Failed to clear query history',
      message: error.message
    });
  }
});

export default router;
