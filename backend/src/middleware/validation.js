import Joi from 'joi';

// Document validation schema
const documentSchema = Joi.object({
  filename: Joi.string().required(),
  size: Joi.number().max(50 * 1024 * 1024).required(), // 50MB max
  mimetype: Joi.string().valid(
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ).required()
});

// Query validation schema
const querySchema = Joi.object({
  query: Joi.string().min(1).max(1000).required(),
  documentIds: Joi.array().items(Joi.string()).optional(),
  maxResults: Joi.number().min(1).max(20).optional(),
  temperature: Joi.number().min(0).max(1).optional(),
  includeContext: Joi.boolean().optional(),
  threshold: Joi.number().min(0).max(1).optional()
});

// Search validation schema
const searchSchema = Joi.object({
  query: Joi.string().min(1).max(500).required(),
  documentIds: Joi.array().items(Joi.string()).optional(),
  maxResults: Joi.number().min(1).max(50).optional(),
  threshold: Joi.number().min(0).max(1).optional()
});

export function validateDocument(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      details: 'A document file is required'
    });
  }

  const { error } = documentSchema.validate({
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  });

  if (error) {
    return res.status(400).json({
      error: 'Invalid document',
      details: error.details[0].message
    });
  }

  next();
}

export function validateQuery(req, res, next) {
  const { error } = querySchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: error.details[0].message
    });
  }

  next();
}

export function validateSearch(req, res, next) {
  const { error } = searchSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Invalid search parameters',
      details: error.details[0].message
    });
  }

  next();
}

// Generic validation middleware factory
export function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    next();
  };
}

// Parameter validation
export function validateParams(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);

    if (error) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: error.details[0].message
      });
    }

    next();
  };
}

// // Query parameter validation
// export function validateQuery(schema) {
//   return (req, res, next) => {
//     const { error } = schema.validate(req.query);

//     if (error) {
//       return res.status(400).json({
//         error: 'Invalid query parameters',
//         details: error.details[0].message
//       });
//     }

//     next();
//   };
// }
