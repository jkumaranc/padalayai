import React, { useState } from 'react'
import { useQuery } from 'react-query'
import toast from 'react-hot-toast'
import { 
  Settings as SettingsIcon, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Server,
  Database,
  Brain,
  Key
} from 'lucide-react'
import { healthAPI, handleAPIError } from '../services/api'

function Settings() {
  const [apiSettings, setApiSettings] = useState({
    temperature: 0.7,
    maxResults: 5,
    chunkSize: 1000,
    chunkOverlap: 200
  })

  // Fetch system health
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery(
    'system-health',
    healthAPI.check,
    { 
      staleTime: 30 * 1000,
      refetchInterval: 30 * 1000 
    }
  )

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    localStorage.setItem('padalayai-settings', JSON.stringify(apiSettings))
    toast.success('Settings saved successfully!')
  }

  const handleResetSettings = () => {
    const defaultSettings = {
      temperature: 0.7,
      maxResults: 5,
      chunkSize: 1000,
      chunkOverlap: 200
    }
    setApiSettings(defaultSettings)
    toast.success('Settings reset to defaults!')
  }

  const handleRefreshHealth = () => {
    refetchHealth()
    toast.success('Health status refreshed!')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Configure your PadalayAI experience and monitor system status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Settings */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center mb-6">
              <Brain className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">AI Configuration</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Temperature: {apiSettings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={apiSettings.temperature}
                  onChange={(e) => setApiSettings(prev => ({
                    ...prev,
                    temperature: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Controls randomness in AI responses. Lower = more focused, Higher = more creative
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Max Results: {apiSettings.maxResults}
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={apiSettings.maxResults}
                  onChange={(e) => setApiSettings(prev => ({
                    ...prev,
                    maxResults: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of document chunks to retrieve for each query
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chunk Size: {apiSettings.chunkSize}
                </label>
                <input
                  type="range"
                  min="500"
                  max="2000"
                  step="100"
                  value={apiSettings.chunkSize}
                  onChange={(e) => setApiSettings(prev => ({
                    ...prev,
                    chunkSize: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Size of text chunks for document processing (characters)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chunk Overlap: {apiSettings.chunkOverlap}
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="50"
                  value={apiSettings.chunkOverlap}
                  onChange={(e) => setApiSettings(prev => ({
                    ...prev,
                    chunkOverlap: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Overlap between chunks to maintain context (characters)
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveSettings}
                className="btn btn-primary flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </button>
              <button
                onClick={handleResetSettings}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </button>
            </div>
          </div>

          {/* API Information */}
          <div className="card">
            <div className="flex items-center mb-6">
              <Key className="h-6 w-6 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">API Information</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">OpenAI Integration</p>
                    <p>
                      PadalayAI uses OpenAI's GPT models for text generation and embeddings. 
                      Configure your API key in the backend environment variables for full functionality.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Fallback Mode</p>
                    <p>
                      Without an OpenAI API key, the system will use simplified text processing 
                      and basic similarity matching for document analysis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Server className="h-6 w-6 text-purple-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">System Status</h2>
              </div>
              <button
                onClick={handleRefreshHealth}
                disabled={healthLoading}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {healthLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : healthData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <span className="font-medium text-gray-900">API Server</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">Healthy</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Database className="h-5 w-5 text-green-600 mr-3" />
                    <span className="font-medium text-gray-900">Document Storage</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">Active</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Brain className="h-5 w-5 text-green-600 mr-3" />
                    <span className="font-medium text-gray-900">AI Processing</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">Available</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Server className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="font-medium text-gray-900">Vector Store</span>
                  </div>
                  <span className="text-sm text-blue-600 font-medium">In-Memory</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Unable to fetch system status</p>
                <button 
                  onClick={handleRefreshHealth}
                  className="btn btn-primary"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* System Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Environment:</span>
                <span className="font-medium">Development</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Backend URL:</span>
                <span className="font-medium">http://localhost:8000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="font-medium">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Usage Guidelines */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Guidelines</h3>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Upload documents in supported formats (PDF, DOCX, TXT, MD)</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Keep file sizes under 50MB for optimal processing</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Use specific, analytical questions for better results</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Review query history to track your analysis progress</p>
              </div>
              <div className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <p>Adjust temperature settings based on your needs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
