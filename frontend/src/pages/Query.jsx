import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { 
  Send, 
  Brain, 
  FileText, 
  Loader, 
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Lightbulb
} from 'lucide-react'
import { documentAPI, queryAPI, handleAPIError, formatDate } from '../services/api'

function Query() {
  const [query, setQuery] = useState('')
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [currentResult, setCurrentResult] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [maxResults, setMaxResults] = useState(5)
  const queryClient = useQueryClient()

  // Fetch documents for selection
  const { data: documentsData, isLoading: documentsLoading } = useQuery(
    'documents',
    documentAPI.getAll,
    { staleTime: 5 * 60 * 1000 }
  )

  // Query mutation
  const queryMutation = useMutation(
    queryAPI.query,
    {
      onSuccess: (data) => {
        setCurrentResult(data)
        queryClient.invalidateQueries('query-history')
        toast.success('Query completed successfully!')
      },
      onError: (error) => {
        toast.error(handleAPIError(error))
      }
    }
  )

  const documents = documentsData?.documents || []

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!query.trim()) {
      toast.error('Please enter a question')
      return
    }

    if (documents.length === 0) {
      toast.error('Please upload documents first')
      return
    }

    queryMutation.mutate({
      query: query.trim(),
      documentIds: selectedDocuments,
      maxResults,
      temperature,
      includeContext: true
    })
  }

  const handleDocumentToggle = (documentId) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    )
  }

  const handleSelectAll = () => {
    if (selectedDocuments.length === documents.length) {
      setSelectedDocuments([])
    } else {
      setSelectedDocuments(documents.map(doc => doc.id))
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const suggestedQuestions = [
    "What are the main themes in these documents?",
    "Can you summarize the key points?",
    "What are the strengths and weaknesses mentioned?",
    "Are there any contradictions or inconsistencies?",
    "What questions do these documents raise?",
    "What evidence supports the main arguments?",
    "How do the different documents relate to each other?",
    "What are the implications of the findings?"
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Query Documents</h1>
        <p className="mt-2 text-gray-600">
          Ask analytical questions about your documents using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Query Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Selection */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Select Documents ({selectedDocuments.length} of {documents.length} selected)
            </h2>
            
            {documentsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-3">
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded flex-1"></div>
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No documents available</p>
                <p className="text-sm text-gray-400">
                  Upload documents first to start querying
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedDocuments.length === documents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {documents.map((doc) => (
                    <label key={doc.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleDocumentToggle(doc.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {doc.pages} pages • {doc.chunks} chunks
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Query Input */}
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Question
                </label>
                <textarea
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question about your documents..."
                  rows={4}
                  className="textarea"
                  disabled={queryMutation.isLoading}
                />
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Temperature: {temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Lower values = more focused, Higher values = more creative
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Results: {maxResults}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={maxResults}
                        onChange={(e) => setMaxResults(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Number of document chunks to retrieve
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={queryMutation.isLoading || !query.trim() || selectedDocuments.length === 0}
                className="btn btn-primary w-full flex items-center justify-center"
              >
                {queryMutation.isLoading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Ask Question
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Query Result */}
          {currentResult && (
            <div className="query-result fade-in">
              <div className="flex items-start justify-between mb-4">
                <h3 className="question">{currentResult.query}</h3>
                <button
                  onClick={() => copyToClipboard(currentResult.answer)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  title="Copy answer"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              
              <div className="answer">
                {currentResult.answer}
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center space-x-4">
                  <span>Confidence: {Math.round(currentResult.confidence * 100)}%</span>
                  <span>Processing: {currentResult.metadata.processingTime}ms</span>
                  <span>Sources: {currentResult.sources.length}</span>
                </div>
                <span>{formatDate(currentResult.metadata.timestamp)}</span>
              </div>

              {/* Sources */}
              {currentResult.sources.length > 0 && (
                <div className="sources">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Sources ({currentResult.sources.length})
                  </h4>
                  <div className="space-y-3">
                    {currentResult.sources.map((source, index) => (
                      <div key={source.id} className="source-item">
                        <div className="flex items-center justify-between mb-2">
                          <span className="filename">
                            {source.filename} (Chunk {source.chunkIndex + 1})
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(source.similarity * 100)}% match
                          </span>
                        </div>
                        <p className="content">
                          {source.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Suggested Questions */}
          <div className="card">
            <div className="flex items-center mb-4">
              <Lightbulb className="h-5 w-5 text-yellow-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                Suggested Questions
              </h3>
            </div>
            
            <div className="space-y-2">
              {suggestedQuestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(suggestion)}
                  className="w-full text-left p-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                  disabled={queryMutation.isLoading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Query Tips
            </h3>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Be specific in your questions for better results</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Select relevant documents to focus the search</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Use analytical questions for deeper insights</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Adjust temperature for creative vs focused responses</p>
              </div>
            </div>
          </div>

          {/* Status */}
          {documents.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Status
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Available Documents:</span>
                  <span className="font-medium">{documents.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Selected:</span>
                  <span className="font-medium">{selectedDocuments.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Chunks:</span>
                  <span className="font-medium">
                    {documents.reduce((sum, doc) => sum + doc.chunks, 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Query
