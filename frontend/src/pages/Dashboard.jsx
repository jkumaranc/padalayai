import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import { 
  FileText, 
  MessageSquare, 
  History, 
  Upload,
  BarChart3,
  TrendingUp,
  Clock,
  Brain
} from 'lucide-react'
import { documentAPI, queryAPI } from '../services/api'
import { formatFileSize } from '../services/api'

function Dashboard() {
  // Fetch dashboard data
  const { data: documents, isLoading: documentsLoading } = useQuery(
    'documents',
    documentAPI.getAll,
    { staleTime: 5 * 60 * 1000 }
  )

  const { data: stats, isLoading: statsLoading } = useQuery(
    'document-stats',
    documentAPI.getStats,
    { staleTime: 5 * 60 * 1000 }
  )

  const { data: queryHistory, isLoading: historyLoading } = useQuery(
    'query-history',
    () => queryAPI.getHistory({ limit: 5 }),
    { staleTime: 2 * 60 * 1000 }
  )

  const isLoading = documentsLoading || statsLoading || historyLoading

  // Quick stats
  const quickStats = [
    {
      name: 'Total Documents',
      value: stats?.stats?.totalDocuments || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Total Pages',
      value: stats?.stats?.totalPages || 0,
      icon: BarChart3,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Storage Used',
      value: formatFileSize(stats?.stats?.totalSize || 0),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Recent Queries',
      value: queryHistory?.history?.length || 0,
      icon: MessageSquare,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to PadalayAI - Your AI-powered document analysis assistant
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/documents"
            className="btn btn-secondary flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Link>
          <Link
            to="/query"
            className="btn btn-primary flex items-center"
          >
            <Brain className="h-4 w-4 mr-2" />
            Ask Question
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoading ? '...' : stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Documents */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
            <Link
              to="/documents"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : documents?.documents?.length > 0 ? (
            <div className="space-y-4">
              {documents.documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-xs">
                        {doc.filename}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(doc.size)} • {doc.pages} pages
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No documents uploaded yet</p>
              <Link
                to="/documents"
                className="btn btn-primary"
              >
                Upload Your First Document
              </Link>
            </div>
          )}
        </div>

        {/* Recent Queries */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Queries</h2>
            <Link
              to="/history"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : queryHistory?.history?.length > 0 ? (
            <div className="space-y-4">
              {queryHistory.history.map((query) => (
                <div key={query.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900 mb-1 line-clamp-2">
                    {query.query}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {new Date(query.timestamp).toLocaleDateString()}
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      {Math.round(query.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No queries yet</p>
              <Link
                to="/query"
                className="btn btn-primary"
              >
                Ask Your First Question
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/documents"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            <Upload className="h-8 w-8 text-blue-600 mr-4" />
            <div>
              <h3 className="font-medium text-gray-900">Upload Documents</h3>
              <p className="text-sm text-gray-500">Add new documents to analyze</p>
            </div>
          </Link>

          <Link
            to="/query"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            <Brain className="h-8 w-8 text-green-600 mr-4" />
            <div>
              <h3 className="font-medium text-gray-900">Ask Questions</h3>
              <p className="text-sm text-gray-500">Query your documents with AI</p>
            </div>
          </Link>

          <Link
            to="/history"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            <History className="h-8 w-8 text-purple-600 mr-4" />
            <div>
              <h3 className="font-medium text-gray-900">View History</h3>
              <p className="text-sm text-gray-500">Review past queries and results</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
