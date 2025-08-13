import express from 'express';
import { getDigitalPersonaService } from '../services/index.js';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get Digital Persona service from services index
const getService = () => {
  try {
    return getDigitalPersonaService();
  } catch (error) {
    throw new Error('Digital Persona service not available. Please ensure the server is properly initialized.');
  }
};

// Sync social media content
router.post('/sync', async (req, res) => {
  try {
    const digitalPersonaService = getService();
    const { platforms } = req.body;
    
    logger.info('Starting social media sync...', { platforms });
    
    const results = await digitalPersonaService.syncSocialMediaContent(platforms);
    
    res.json({
      success: true,
      message: 'Social media sync completed',
      results
    });
    
  } catch (error) {
    logger.error('Error syncing social media content:', error);
    res.status(500).json({
      error: 'Failed to sync social media content',
      details: error.message
    });
  }
});

// Query digital persona
router.post('/query', async (req, res) => {
  try {
    const digitalPersonaService = getService();
    const {
      query,
      maxResults = 5,
      temperature = 0.7,
      includeContext = true,
      documentIds = [],
      analysisType = 'content',
      enhancedQuery
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    logger.info('Processing digital persona query:', { 
      query: query.substring(0, 100),
      analysisType,
      hasEnhancedQuery: !!enhancedQuery,
      documentIds: documentIds.length
    });

    // Use enhanced query if provided, otherwise use original query
    const queryToUse = enhancedQuery || query;

    // If no specific document IDs provided, search all content (documents + social media)
    // If document IDs are provided, respect the selection
    const searchOptions = {
      maxResults,
      temperature,
      includeContext,
      analysisType
    };

    // Only add documentIds filter if specific documents are selected
    // Empty array means "search all content"
    if (documentIds && documentIds.length > 0) {
      searchOptions.documentIds = documentIds;
    }

    const result = await digitalPersonaService.queryDigitalPersona(queryToUse, searchOptions);

    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('Error querying digital persona:', error);
    res.status(500).json({
      error: 'Failed to query digital persona',
      details: error.message
    });
  }
});

// Get digital persona statistics
router.get('/stats', async (req, res) => {
  try {
    const digitalPersonaService = getService();
    const stats = await digitalPersonaService.getDigitalPersonaStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('Error getting digital persona stats:', error);
    res.status(500).json({
      error: 'Failed to get digital persona stats',
      details: error.message
    });
  }
});

// Remove content from specific platform
router.delete('/platform/:platform', async (req, res) => {
  try {
    const digitalPersonaService = getService();
    const { platform } = req.params;
    
    if (!['blogger', 'facebook', 'instagram'].includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform. Must be one of: blogger, facebook, instagram'
      });
    }
    
    logger.info(`Removing content from platform: ${platform}`);
    
    const removedCount = await digitalPersonaService.removePlatformContent(platform);
    
    res.json({
      success: true,
      message: `Removed ${removedCount} items from ${platform}`,
      removedCount
    });
    
  } catch (error) {
    logger.error(`Error removing ${req.params.platform} content:`, error);
    res.status(500).json({
      error: `Failed to remove ${req.params.platform} content`,
      details: error.message
    });
  }
});

// Get sync status for all platforms
router.get('/sync-status', async (req, res) => {
  try {
    const digitalPersonaService = getService();
    const stats = await digitalPersonaService.getDigitalPersonaStats();
    
    const syncStatus = {
      platforms: Object.keys(stats.platforms).map(platform => ({
        name: platform,
        itemCount: stats.platforms[platform].itemCount,
        lastSync: stats.platforms[platform].lastSync,
        status: stats.platforms[platform].lastSync ? 'synced' : 'not_synced'
      })),
      totalContent: stats.totalContent,
      lastUpdate: new Date().toISOString()
    };
    
    res.json({
      success: true,
      syncStatus
    });
    
  } catch (error) {
    logger.error('Error getting sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
    
    try {
      const digitalPersonaService = getService();
      const stats = await digitalPersonaService.getDigitalPersonaStats();
      health.initialized = true;
      health.contentStats = {
        totalPlatforms: Object.keys(stats.platforms).length,
        totalContent: stats.totalContent
      };
    } catch (serviceError) {
      health.initialized = false;
      health.serviceError = serviceError.message;
    }
    
    res.json(health);
    
  } catch (error) {
    logger.error('Error checking health:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
