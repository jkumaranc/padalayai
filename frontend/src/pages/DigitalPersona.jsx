import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const DigitalPersona = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSyncStatus();
    loadStats();
  }, []);

  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/digital-persona/sync-status');
      setSyncStatus(response.data.syncStatus);
    } catch (error) {
      console.error('Error loading sync status:', error);
      setError('Failed to load sync status');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/digital-persona/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSync = async (platforms = ['blogger', 'facebook', 'instagram']) => {
    try {
      setSyncing(true);
      setError(null);
      
      const response = await api.post('/digital-persona/sync', { platforms });
      
      if (response.data.success) {
        await loadSyncStatus();
        await loadStats();
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setError('Failed to sync social media content');
    } finally {
      setSyncing(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setQuerying(true);
      setError(null);
      
      const response = await api.post('/digital-persona/query', {
        query: query.trim(),
        maxResults: 5,
        temperature: 0.7,
        includeContext: true
      });
      
      if (response.data.success) {
        setQueryResult(response.data.result);
      }
    } catch (error) {
      console.error('Error querying:', error);
      setError('Failed to query digital persona');
    } finally {
      setQuerying(false);
    }
  };

  const handleRemovePlatform = async (platform) => {
    if (!confirm(`Are you sure you want to remove all content from ${platform}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/digital-persona/platform/${platform}`);
      
      if (response.data.success) {
        await loadSyncStatus();
        await loadStats();
      }
    } catch (error) {
      console.error(`Error removing ${platform} content:`, error);
      setError(`Failed to remove ${platform} content`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'blogger':
        return '📝';
      case 'facebook':
        return '📘';
      case 'instagram':
        return '📷';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'synced':
        return 'text-green-600';
      case 'not_synced':
        return 'text-gray-500';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Digital Persona</h1>
        <p className="text-gray-600">
          Aggregate and query your public-facing content from social media platforms
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-red-600 hover:text-red-800 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sync Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Platform Status</h2>
          <button
            onClick={() => handleSync()}
            disabled={syncing || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Syncing...' : 'Sync All Platforms'}
          </button>
        </div>

        {loading && !syncStatus ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading sync status...</p>
          </div>
        ) : syncStatus ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {syncStatus.platforms.map((platform) => (
              <div key={platform.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{getPlatformIcon(platform.name)}</span>
                    <h3 className="font-medium capitalize">{platform.name}</h3>
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(platform.status)}`}>
                    {platform.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Items: {platform.itemCount}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Last sync: {formatDate(platform.lastSync)}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSync([platform.name])}
                    disabled={syncing || loading}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    Sync
                  </button>
                  <button
                    onClick={() => handleRemovePlatform(platform.name)}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No sync status available</p>
        )}
      </div>

      {/* Query Interface */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Query Digital Persona</h2>
        
        <form onSubmit={handleQuery} className="mb-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your content across all platforms..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={querying || !query.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {querying ? 'Querying...' : 'Query'}
            </button>
          </div>
        </form>

        {queryResult && (
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-2">Answer:</h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-gray-800">{queryResult.answer}</p>
            </div>

            {queryResult.sources && queryResult.sources.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Sources:</h4>
                <div className="space-y-2">
                  {queryResult.sources.map((source, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getPlatformIcon(source.platform)}</span>
                          <span className="font-medium text-sm capitalize">
                            {source.platform}
                          </span>
                          {source.title && (
                            <span className="text-sm text-gray-600 ml-2">
                              - {source.title}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {(source.similarity * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        {source.text.substring(0, 200)}...
                      </p>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          View original →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              Confidence: {(queryResult.confidence * 100).toFixed(1)}% | 
              Documents searched: {queryResult.documentsSearched} | 
              Query time: {formatDate(queryResult.timestamp)}
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalContent}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.keys(stats.platforms).length}
              </div>
              <div className="text-sm text-gray-600">Active Platforms</div>
            </div>
            
            {stats.ragStats && (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.ragStats.totalChunks}
                  </div>
                  <div className="text-sm text-gray-600">Total Chunks</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.ragStats.totalWords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Words</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalPersona;
