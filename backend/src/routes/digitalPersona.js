import express from 'express';
import { DigitalPersonaService } from '../services/digitalPersonaService.js';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Initialize Digital Persona service
const digitalPersonaService = new DigitalPersonaService();
let isInitialized = false;

// Initialize service on first request
const ensureInitialized = async (req, res, next) => {
  if (!isInitialized) {
    try {
      await digitalPersonaService.initialize();
      isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize Digital Persona service:', error);
      return res.status(500).json({
        error: 'Failed to initialize Digital Persona service',
        details: error.message
      });
    }
  }
  next();
};

// Sync social media content
router.post('/sync', ensureInitialized, async (req, res) => {
  try {
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
router.post('/query', ensureInitialized, async (req, res) => {
  try {
    const {
      query,
      maxResults = 5,
      temperature = 0.7,
      includeContext = true,
      documentIds = []
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    logger.info('Processing digital persona query:', { query: query.substring(0, 100) });

    const result = await digitalPersonaService.queryDigitalPersona(query, {
      maxResults,
      temperature,
      includeContext,
      documentIds
    });

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
router.get('/stats', ensureInitialized, async (req, res) => {
  try {
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
router.delete('/platform/:platform', ensureInitialized, async (req, res) => {
  try {
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
router.get('/sync-status', ensureInitialized, async (req, res) => {
  try {
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
      initialized: isInitialized,
      timestamp: new Date().toISOString()
    };
    
    if (isInitialized) {
      const stats = await digitalPersonaService.getDigitalPersonaStats();
      health.contentStats = {
        totalPlatforms: Object.keys(stats.platforms).length,
        totalContent: stats.totalContent
      };
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
