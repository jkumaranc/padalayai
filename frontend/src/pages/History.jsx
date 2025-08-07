import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { 
  History as HistoryIcon, 
  Search, 
  Download, 
  Trash2, 
  Copy,
  Clock,
  Brain,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { queryAPI, handleAPIError, formatDate } from '../services/api'

function History() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedQuery, setExpandedQuery] = useState(null)
  const [selectedQueries, setSelectedQueries] = useState([])
  const queryClient = useQueryClient()

  // Fetch query history
  const { data: historyData, isLoading, error } = useQuery(
    ['query-history', searchTerm],
    () => queryAPI.getHistory({ limit: 100 }),
    { staleTime: 2 * 60 * 1000 }
  )

  // Clear history mutation
  const clearHistoryMutation = useMutation(
    queryAPI.clearHistory,
    {
      onSuccess: () => {
        toast.success('Query history cleared successfully!')
        queryClient.invalidateQueries('query-history')
      },
      onError: (error) => {
        toast.error(handleAPIError(error))
      }
    }
  )

  const queries = historyData?.history || []

  // Filter queries based on search term
  const filteredQueries = queries.filter(query =>
    query.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
    query.answer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggleExpand = (queryId) => {
    setExpandedQuery(expandedQuery === queryId ? null : queryId)
  }

  const handleSelectQuery = (queryId) => {
    setSelectedQueries(prev =>
      prev.includes(queryId)
        ? prev.filter(id => id !== queryId)
        : [...prev, queryId]
    )
  }

  const handleSelectAll = () => {
    if (selectedQueries.length === filteredQueries.length) {
      setSelectedQueries([])
    } else {
      setSelectedQueries(filteredQueries.map(q => q.id))
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all query history? This action cannot be undone.')) {
      clearHistoryMutation.mutate()
    }
  }

  const exportSelected = async () => {
    if (selectedQueries.length === 0) {
      toast.error('Please select queries to export')
      return
    }

    try {
      const data = await queryAPI.export(selectedQueries, 'json')
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `padalayai-queries-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Queries exported successfully!')
    } catch (error) {
      toast.error(handleAPIError(error))
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Query History</h1>
          <p className="mt-2 text-gray-600">
            Review and manage your past queries and results
          </p>
        </div>
        <div className="flex space-x-3">
          {selectedQueries.length > 0 && (
            <button
              onClick={exportSelected}
              className="btn btn-secondary flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selected ({selectedQueries.length})
            </button>
          )}
          <button
            onClick={handleClearHistory}
            disabled={clearHistoryMutation.isLoading || queries.length === 0}
            className="btn btn-danger flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear History
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search queries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {filteredQueries.length} of {queries.length} queries
            </span>
            
            {filteredQueries.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedQueries.length === filteredQueries.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Query List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card text-center py-8">
            <HistoryIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Failed to load query history</p>
            <button 
              onClick={() => queryClient.invalidateQueries('query-history')}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="card text-center py-12">
            <HistoryIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-900 mb-2">
              {searchTerm ? 'No matching queries found' : 'No query history yet'}
            </p>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Start asking questions about your documents to build up your history'
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="btn btn-secondary"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredQueries.map((query) => (
            <div key={query.id} className="card">
              <div className="flex items-start space-x-4">
                <input
                  type="checkbox"
                  checked={selectedQueries.includes(query.id)}
                  onChange={() => handleSelectQuery(query.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                />
                
                <div className="flex-1 min-w-0">
                  {/* Query Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {query.query}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatDate(query.timestamp)}
                        </span>
                        <span className="flex items-center">
                          <Brain className="h-4 w-4 mr-1" />
                          {Math.round(query.confidence * 100)}% confidence
                        </span>
                        <span>
                          {query.sources.length} sources
                        </span>
                        <span>
                          {query.metadata.processingTime}ms
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(query.answer)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                        title="Copy answer"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleExpand(query.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                        title={expandedQuery === query.id ? "Collapse" : "Expand"}
                      >
                        {expandedQuery === query.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Answer Preview */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <p className="text-gray-700 leading-relaxed">
                      {expandedQuery === query.id 
                        ? query.answer
                        : `${query.answer.substring(0, 200)}${query.answer.length > 200 ? '...' : ''}`
                      }
                    </p>
                  </div>

                  {/* Expanded Content */}
                  {expandedQuery === query.id && (
                    <div className="space-y-4 fade-in">
                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg text-sm">
                        <div>
                          <span className="text-gray-600">Documents Searched:</span>
                          <span className="ml-2 font-medium">{query.documentsSearched}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Chunks Retrieved:</span>
                          <span className="ml-2 font-medium">{query.sources.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Temperature:</span>
                          <span className="ml-2 font-medium">{query.metadata.temperature}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Max Results:</span>
                          <span className="ml-2 font-medium">{query.metadata.maxResults}</span>
                        </div>
                      </div>

                      {/* Sources */}
                      {query.sources.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Sources ({query.sources.length})
                          </h4>
                          <div className="space-y-3">
                            {query.sources.map((source, index) => (
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {queries.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {queries.length}
              </div>
              <div className="text-gray-600">Total Queries</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {Math.round(queries.reduce((sum, q) => sum + q.confidence, 0) / queries.length * 100) || 0}%
              </div>
              <div className="text-gray-600">Avg Confidence</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {Math.round(queries.reduce((sum, q) => sum + q.metadata.processingTime, 0) / queries.length) || 0}ms
              </div>
              <div className="text-gray-600">Avg Processing</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {Math.round(queries.reduce((sum, q) => sum + q.sources.length, 0) / queries.length) || 0}
              </div>
              <div className="text-gray-600">Avg Sources</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default History
