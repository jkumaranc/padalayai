import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { SimpleDocumentProcessor } from '../services/simpleDocumentProcessor.js';
import { validateDocument } from '../middleware/validation.js';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/documents';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt', '.md'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${fileExt}. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Initialize simple document processor
const documentProcessor = new SimpleDocumentProcessor();

// Upload and process document (simplified version)
router.post('/upload', upload.single('document'), validateDocument, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    logger.info(`Processing uploaded file: ${req.file.originalname}`);

    // Process the document with simple processor
    const documentInfo = await documentProcessor.processDocument({
      id: uuidv4(),
      filename: req.file.originalname,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    });

    // Skip RAG service for now to avoid crashes
    logger.info('Skipping RAG service indexing in simple mode');

    logger.info(`Successfully processed document: ${documentInfo.id}`);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully (simple mode)',
      document: {
        id: documentInfo.id,
        filename: documentInfo.filename,
        size: documentInfo.size,
        pages: documentInfo.pages,
        chunks: documentInfo.chunks?.length || 0,
        uploadedAt: documentInfo.uploadedAt,
        processedAt: documentInfo.processedAt
      }
    });

  } catch (error) {
    logger.error('Error processing document:', error);
    
    // Clean up uploaded file if processing failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Failed to process document',
      message: error.message
    });
  }
});

// Get all documents
router.get('/', async (req, res) => {
  try {
    const documents = await documentProcessor.getAllDocuments();
    
    res.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        size: doc.size,
        pages: doc.pages,
        chunks: doc.chunks?.length || 0,
        uploadedAt: doc.uploadedAt,
        processedAt: doc.processedAt
      }))
    });

  } catch (error) {
    logger.error('Error retrieving documents:', error);
    res.status(500).json({
      error: 'Failed to retrieve documents',
      message: error.message
    });
  }
});

// Get specific document
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentProcessor.getDocument(id);
    
    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        size: document.size,
        pages: document.pages,
        chunks: document.chunks?.length || 0,
        uploadedAt: document.uploadedAt,
        processedAt: document.processedAt,
        content: document.content // Include content for detailed view
      }
    });

  } catch (error) {
    logger.error('Error retrieving document:', error);
    res.status(500).json({
      error: 'Failed to retrieve document',
      message: error.message
    });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get document info before deletion
    const document = await documentProcessor.getDocument(id);
    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    // Delete from document processor
    await documentProcessor.deleteDocument(id);
    
    // Clean up physical file
    try {
      await fs.unlink(document.filepath);
    } catch (fileError) {
      logger.warn(`Could not delete physical file: ${document.filepath}`, fileError);
    }

    logger.info(`Deleted document: ${id}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

// Get document statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const documents = await documentProcessor.getAllDocuments();
    
    const stats = {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + (doc.size || 0), 0),
      totalPages: documents.reduce((sum, doc) => sum + (doc.pages || 0), 0),
      totalChunks: documents.reduce((sum, doc) => sum + (doc.chunks?.length || 0), 0),
      fileTypes: {}
    };

    // Count file types
    documents.forEach(doc => {
      const ext = path.extname(doc.filename).toLowerCase();
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
    });

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Error retrieving document stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve document statistics',
      message: error.message
    });
  }
});

export default router;
