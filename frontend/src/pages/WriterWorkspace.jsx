import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { 
  PenTool,
  FileText, 
  Loader, 
  Copy,
  Lightbulb,
  User,
  Palette,
  BookOpen,
  Upload,
  RefreshCw,
  BarChart3,
  Clock,
  Search,
  Settings,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Bookmark,
  Star,
  TrendingUp
} from 'lucide-react'
import { documentAPI, queryAPI, handleAPIError, formatDate, formatFileSize } from '../services/api'

function WriterWorkspace() {
  // Main state
  const [query, setQuery] = useState('')
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [currentResult, setCurrentResult] = useState(null)
  const [analysisType, setAnalysisType] = useState('content')
  const [temperature, setTemperature] = useState(0.7)
  const [maxResults, setMaxResults] = useState(5)
  
  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [activeSection, setActiveSection] = useState('analysis')
  const [favoriteQueries, setFavoriteQueries] = useState([])
  
  // Digital persona state
  const [syncStatus, setSyncStatus] = useState(null)
  const [stats, setStats] = useState(null)
  const [syncing, setSyncing] = useState(false)
  
  const queryClient = useQueryClient()

  // Fetch data
  const { data: documentsData, isLoading: documentsLoading } = useQuery(
    'documents',
    documentAPI.getAll,
    { 
      staleTime: 5 * 60 * 1000,
      onSuccess: (data) => {
        // Auto-select all documents when they're loaded
        if (data?.documents && selectedDocuments.length === 0) {
          setSelectedDocuments(data.documents.map(doc => doc.id))
        }
      }
    }
  )

  const { data: documentStats, isLoading: statsLoading } = useQuery(
    'document-stats',
    documentAPI.getStats,
    { staleTime: 5 * 60 * 1000 }
  )

  const { data: queryHistory, isLoading: historyLoading } = useQuery(
    'query-history',
    () => queryAPI.getHistory({ limit: 10 }),
    { staleTime: 2 * 60 * 1000 }
  )

  // Load digital persona data
  useEffect(() => {
    loadSyncStatus()
    loadStats()
    loadFavorites()
  }, [])

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('/api/digital-persona/sync-status')
      const data = await response.json()
      setSyncStatus(data.syncStatus)
    } catch (error) {
      console.error('Error loading sync status:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/digital-persona/stats')
      const data = await response.json()
      setStats(data.stats)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadFavorites = () => {
    const saved = localStorage.getItem('padalayai-favorites')
    if (saved) {
      setFavoriteQueries(JSON.parse(saved))
    }
  }

  const saveFavorites = (favorites) => {
    localStorage.setItem('padalayai-favorites', JSON.stringify(favorites))
    setFavoriteQueries(favorites)
  }

  const handleSync = async (platforms = ['blogger']) => {
    try {
      setSyncing(true)
      
      const response = await fetch('/api/digital-persona/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms })
      })
      
      const data = await response.json()
      
      if (data.success) {
        await loadSyncStatus()
        await loadStats()
        queryClient.invalidateQueries('documents')
        toast.success('Content synced successfully!')
      }
    } catch (error) {
      console.error('Error syncing:', error)
      toast.error('Failed to sync content')
    } finally {
      setSyncing(false)
    }
  }

  // Enhanced query mutation - always use digital persona endpoint for MCP integration
  const queryMutation = useMutation(
    async (queryData) => {
      const endpoint = '/api/digital-persona/query'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...queryData,
          analysisType,
          enhancedQuery: getEnhancedQuery(queryData.query, analysisType)
        })
      })
      
      if (!response.ok) {
        throw new Error('Query failed')
      }
      
      return response.json()
    },
    {
      onSuccess: (data) => {
        // Handle the nested result structure from digital persona endpoint
        const result = data.result || data
        setCurrentResult(result)
        queryClient.invalidateQueries('query-history')
        toast.success('Analysis completed!')
      },
      onError: (error) => {
        toast.error(handleAPIError(error))
      }
    }
  )

  const documents = documentsData?.documents || []

  const getEnhancedQuery = (originalQuery, type) => {
    const enhancements = {
      style: `Analyze the writing style in relation to: ${originalQuery}. Focus on tone, formality, sentence structure, voice, and literary techniques.`,
      persona: `Analyze the author persona and voice in relation to: ${originalQuery}. Focus on expertise level, communication style, personality traits, and audience connection.`,
      genre: `Analyze the genre and content type in relation to: ${originalQuery}. Focus on classification, themes, narrative techniques, and content characteristics.`,
      content: originalQuery
    }
    
    return enhancements[type] || originalQuery
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!query.trim()) {
      toast.error('Please enter a question')
      return
    }

    if (documents.length === 0) {
      toast.error('Please upload documents or sync social media content first')
      return
    }

    queryMutation.mutate({
      query: query.trim(),
      documentIds: selectedDocuments,
      maxResults,
      temperature,
      includeContext: true,
      analysisType
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

  const toggleFavorite = (queryText) => {
    const newFavorites = favoriteQueries.includes(queryText)
      ? favoriteQueries.filter(q => q !== queryText)
      : [...favoriteQueries, queryText]
    saveFavorites(newFavorites)
  }

  const getAnalysisTypeQuestions = (type) => {
    const questions = {
      content: [
        "What are the central themes in my writing?",
        "How do my ideas connect across different pieces?",
        "What topics do I explore most deeply?",
        "What unique perspectives do I bring to my subjects?"
      ],
      style: [
        "How would you describe my writing voice?",
        "What makes my writing style distinctive?",
        "How does my tone vary across different pieces?",
        "What literary techniques do I use most often?",
        "How has my writing style evolved over time?"
      ],
      persona: [
        "What kind of writer persona do I project?",
        "How do I connect with my readers?",
        "What expertise and authority do I demonstrate?",
        "What personality traits shine through my writing?",
        "How authentic does my voice feel across platforms?"
      ],
      genre: [
        "What genres or forms do I gravitate toward?",
        "How do I adapt my writing to different formats?",
        "What narrative techniques define my work?",
        "How do I balance different content types?"
      ]
    }
    return questions[type] || questions.content
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      blogger: '📝',
      facebook: '📘',
      instagram: '📷',
      document: '📄'
    }
    return icons[platform] || '📄'
  }

  const totalWords = documentStats?.stats?.totalWords || 0
  const totalDocuments = documents.length
  const recentQueries = queryHistory?.history?.slice(0, 5) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
                <PenTool className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">PadalayAI</h1>
                <p className="text-sm text-amber-600">Writer's Workspace</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <FileText className="h-4 w-4" />
                  <span>{totalDocuments} documents</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>{totalWords.toLocaleString()} words</span>
                </div>
              </div>
              
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {showSidebar ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid gap-8 transition-all duration-300 ${showSidebar ? 'grid-cols-1 lg:grid-cols-4' : 'grid-cols-1'}`}>
          
          {/* Main Content */}
          <div className={`${showSidebar ? 'lg:col-span-3' : 'col-span-1'} space-y-8`}>
            
            {/* Analysis Type Selection */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Palette className="h-5 w-5 mr-2 text-amber-600" />
                Choose Your Analysis Focus
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'content', label: 'Content & Themes', icon: <FileText className="h-5 w-5" />, color: 'blue' },
                  { key: 'style', label: 'Writing Style', icon: <Palette className="h-5 w-5" />, color: 'purple' },
                  { key: 'persona', label: 'Author Voice', icon: <User className="h-5 w-5" />, color: 'green' },
                  { key: 'genre', label: 'Genre & Form', icon: <BookOpen className="h-5 w-5" />, color: 'orange' }
                ].map((type) => (
                  <button
                    key={type.key}
                    onClick={() => setAnalysisType(type.key)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      analysisType === type.key
                        ? `border-${type.color}-500 bg-${type.color}-50 text-${type.color}-700 shadow-md`
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      {type.icon}
                      <span className="text-sm font-medium text-center">{type.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Query Interface */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="query" className="block text-lg font-medium text-gray-900 mb-3">
                    What would you like to explore about your writing?
                  </label>
                  <div className="relative">
                    <textarea
                      id="query"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Ask about your ${analysisType === 'content' ? 'themes and ideas' : 
                        analysisType === 'style' ? 'writing style and voice' : 
                        analysisType === 'persona' ? 'author persona and connection with readers' : 
                        'genre and narrative techniques'}...`}
                      rows={4}
                      className="w-full px-4 py-3 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none bg-white/50 text-gray-900 placeholder-gray-500"
                      disabled={queryMutation.isLoading}
                    />
                    {favoriteQueries.includes(query) && (
                      <Star className="absolute top-3 right-3 h-5 w-5 text-amber-500 fill-current" />
                    )}
                  </div>
                </div>

                {/* Advanced Options */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    Advanced Options
                  </button>
                  
                  {showAdvanced && (
                    <div className="mt-4 p-4 bg-amber-50/50 rounded-xl space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Creativity Level: {temperature}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Focused</span>
                          <span>Creative</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sources to Analyze: {maxResults}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={maxResults}
                          onChange={(e) => setMaxResults(parseInt(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={queryMutation.isLoading || !query.trim() || selectedDocuments.length === 0}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
                >
                  {queryMutation.isLoading ? (
                    <>
                      <Loader className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing your writing...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Analyze My Writing
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Query Result */}
            {currentResult && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 leading-relaxed">
                    {currentResult.query}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleFavorite(currentResult.query)}
                      className={`p-2 rounded-lg transition-colors ${
                        favoriteQueries.includes(currentResult.query)
                          ? 'text-amber-500 bg-amber-100'
                          : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                      title="Add to favorites"
                    >
                      <Star className={`h-4 w-4 ${favoriteQueries.includes(currentResult.query) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => copyToClipboard(currentResult.answer)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copy answer"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="prose prose-amber max-w-none mb-6">
                  <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {currentResult.answer}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4 p-3 bg-amber-50/50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {Math.round((currentResult.confidence || 0) * 100)}% confidence
                    </span>
                    <span>{currentResult.sources?.length || 0} sources</span>
                    <span className="capitalize">{analysisType} analysis</span>
                  </div>
                  <span>{formatDate(currentResult.timestamp || currentResult.metadata?.timestamp)}</span>
                </div>

                {/* Sources */}
                {currentResult.sources && currentResult.sources.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <Bookmark className="h-4 w-4 mr-2" />
                      Sources ({currentResult.sources.length})
                    </h4>
                    <div className="space-y-3">
                      {currentResult.sources.map((source, index) => (
                        <div key={source.id || index} className="p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 rounded-lg border border-amber-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {getPlatformIcon(source.platform || 'document')}
                              </span>
                              <span className="font-medium text-gray-900">
                                {source.filename || source.title || 'Unknown'}
                                {source.chunkIndex !== undefined && ` (Section ${source.chunkIndex + 1})`}
                              </span>
                              {source.platform && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full capitalize">
                                  {source.platform}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                              {Math.round((source.similarity || 0) * 100)}% match
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {source.text.substring(0, 300)}...
                          </p>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-amber-600 hover:text-amber-800 mt-2 inline-block font-medium"
                            >
                              View original →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          {showSidebar && (
            <div className="space-y-6">
              
              {/* Quick Stats */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-amber-600" />
                  Your Writing
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Documents:</span>
                    <span className="font-semibold text-gray-900">{totalDocuments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Words:</span>
                    <span className="font-semibold text-gray-900">{totalWords.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Selected:</span>
                    <span className="font-semibold text-gray-900">{selectedDocuments.length}</span>
                  </div>
                  {stats && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Platforms:</span>
                      <span className="font-semibold text-gray-900">{Object.keys(stats.platforms || {}).length}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Questions */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                <div className="flex items-center mb-4">
                  <Lightbulb className="h-5 w-5 text-amber-500 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Suggested Questions
                  </h3>
                </div>
                
                <div className="space-y-2">
                  {getAnalysisTypeQuestions(analysisType).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(suggestion)}
                      className="w-full text-left p-3 text-sm text-gray-700 hover:bg-amber-50 rounded-lg transition-colors duration-200 border border-transparent hover:border-amber-200"
                      disabled={queryMutation.isLoading}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Selection */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Content Sources
                  </h3>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                  >
                    {selectedDocuments.length === documents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
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
                  <div className="text-center py-6">
                    <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-3">No content available</p>
                    <button
                      onClick={() => setActiveSection('upload')}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Upload documents or sync content
                    </button>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {documents.map((doc) => (
                      <label key={doc.id} className="flex items-center space-x-3 p-2 hover:bg-amber-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={() => handleDocumentToggle(doc.id)}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">
                              {getPlatformIcon(doc.metadata?.platform || 'document')}
                            </span>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.filename}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {doc.pages} pages • {doc.chunks} sections
                            {doc.metadata?.platform && (
                              <span className="ml-2 capitalize">• {doc.metadata.platform}</span>
                            )}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Queries */}
              {recentQueries.length > 0 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                  <div className="flex items-center mb-4">
                    <Clock className="h-5 w-5 text-amber-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Recent Queries
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    {recentQueries.map((query) => (
                      <button
                        key={query.id}
                        onClick={() => setQuery(query.query)}
                        className="w-full text-left p-3 hover:bg-amber-50 rounded-lg transition-colors duration-200 border border-transparent hover:border-amber-200"
                      >
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                          {query.query}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatDate(query.timestamp)}</span>
                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                            {Math.round(query.confidence * 100)}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync Status */}
              {syncStatus && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <RefreshCw className="h-5 w-5 mr-2 text-amber-600" />
                      Social Media
                    </h3>
                    <button
                      onClick={() => handleSync()}
                      disabled={syncing}
                      className="text-sm bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {syncing ? (
                        <>
                          <Loader className="h-3 w-3 inline mr-1 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 inline mr-1" />
                          Sync
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {syncStatus.platforms.map((platform) => (
                      <div key={platform.name} className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getPlatformIcon(platform.name)}</span>
                            <span className="font-medium capitalize text-gray-900">{platform.name}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            platform.status === 'synced' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {platform.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {platform.itemCount} items • Last sync: {formatDate(platform.lastSync)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Section */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-200 p-6 shadow-lg">
                <div className="flex items-center mb-4">
                  <Upload className="h-5 w-5 text-amber-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Upload Documents
                  </h3>
                </div>
                
                <div className="text-center py-6">
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-3">Add your writing to analyze</p>
                  <button
                    onClick={() => window.location.href = '/documents'}
                    className="text-sm bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    Upload Files
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WriterWorkspace
