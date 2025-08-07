import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const app = express();
const PORT = 8001; // Use different port to avoid conflicts

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/test';
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
      cb(new Error(`Unsupported file type: ${fileExt}`));
    }
  }
});

// Simple upload endpoint for testing
app.post('/test-upload', upload.single('document'), async (req, res) => {
  try {
    console.log('Upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    console.log('File received:', req.file.originalname);

    // Simple response without any complex processing
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: req.file.originalname,
        size: req.file.size,
        path: req.file.path
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server running' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Server error',
    message: error.message
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Test upload: http://localhost:${PORT}/test-upload`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
