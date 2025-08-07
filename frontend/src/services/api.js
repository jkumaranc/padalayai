import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth headers here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

// Document API
export const documentAPI = {
  // Upload document
  upload: async (file, onProgress) => {
    const formData = new FormData()
    formData.append('document', file)

    return api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          onProgress(percentCompleted)
        }
      },
    })
  },

  // Get all documents
  getAll: () => api.get('/api/documents'),

  // Get specific document
  getById: (id) => api.get(`/api/documents/${id}`),

  // Delete document
  delete: (id) => api.delete(`/api/documents/${id}`),

  // Get document statistics
  getStats: () => api.get('/api/documents/stats/overview'),
}

// Query API
export const queryAPI = {
  // Submit query
  query: (queryData) => api.post('/api/queries', queryData),

  // Get query history
  getHistory: (params = {}) => {
    const searchParams = new URLSearchParams(params)
    return api.get(`/api/queries/history?${searchParams}`)
  },

  // Get specific query result
  getById: (queryId) => api.get(`/api/queries/${queryId}`),

  // Semantic search
  search: (searchData) => api.post('/api/queries/search', searchData),

  // Get question suggestions
  getSuggestions: (documentId, count = 5) => 
    api.get(`/api/queries/suggestions/${documentId}?count=${count}`),

  // Export query results
  export: (queryIds, format = 'json') => 
    api.post('/api/queries/export', { queryIds, format }),

  // Clear query history
  clearHistory: (olderThan) => {
    const params = olderThan ? `?olderThan=${olderThan}` : ''
    return api.delete(`/api/queries/history${params}`)
  },
}

// Health API
export const healthAPI = {
  // Check API health
  check: () => api.get('/health'),

  // Get service status
  status: () => api.get('/api/status'),
}

// Utility functions
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Error handling utility
export const handleAPIError = (error) => {
  console.error('API Error:', error)
  
  if (error.response) {
    // Server responded with error status
    const status = error.response.status
    const message = error.response.data?.message || error.message
    
    switch (status) {
      case 400:
        return `Bad Request: ${message}`
      case 401:
        return 'Unauthorized: Please check your credentials'
      case 403:
        return 'Forbidden: You do not have permission to perform this action'
      case 404:
        return 'Not Found: The requested resource was not found'
      case 429:
        return 'Too Many Requests: Please try again later'
      case 500:
        return 'Server Error: Something went wrong on our end'
      default:
        return `Error ${status}: ${message}`
    }
  } else if (error.request) {
    // Network error
    return 'Network Error: Unable to connect to the server'
  } else {
    // Other error
    return error.message || 'An unexpected error occurred'
  }
}

// File validation
export const validateFile = (file) => {
  const maxSize = 50 * 1024 * 1024 // 50MB
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]

  if (file.size > maxSize) {
    throw new Error('File size must be less than 50MB')
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not supported. Please upload PDF, DOCX, TXT, or MD files.')
  }

  return true
}

export default api
