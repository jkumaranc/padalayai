import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { 
  Upload, 
  FileText, 
  Trash2, 
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react'
import { documentAPI, formatFileSize, formatDate, validateFile, handleAPIError } from '../services/api'

function Documents() {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const queryClient = useQueryClient()

  // Fetch documents
  const { data: documentsData, isLoading, error } = useQuery(
    'documents',
    documentAPI.getAll,
    { staleTime: 2 * 60 * 1000 }
  )

  // Upload mutation
  const uploadMutation = useMutation(
    ({ file }) => documentAPI.upload(file, setUploadProgress),
    {
      onMutate: () => {
        setIsUploading(true)
        setUploadProgress(0)
      },
      onSuccess: (data) => {
        toast.success(`Document "${data.document.filename}" uploaded successfully!`)
        queryClient.invalidateQueries('documents')
        queryClient.invalidateQueries('document-stats')
        setUploadProgress(0)
        setIsUploading(false)
      },
      onError: (error) => {
        toast.error(handleAPIError(error))
        setUploadProgress(0)
        setIsUploading(false)
      }
    }
  )

  // Delete mutation
  const deleteMutation = useMutation(
    documentAPI.delete,
    {
      onSuccess: () => {
        toast.success('Document deleted successfully!')
        queryClient.invalidateQueries('documents')
        queryClient.invalidateQueries('document-stats')
      },
      onError: (error) => {
        toast.error(handleAPIError(error))
      }
    }
  )

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0]
        toast.error(`File rejected: ${error.message}`)
        return
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        try {
          validateFile(file)
          uploadMutation.mutate({ file })
        } catch (error) {
          toast.error(error.message)
        }
      }
    }
  })

  const handleDelete = (document) => {
    if (window.confirm(`Are you sure you want to delete "${document.filename}"?`)) {
      deleteMutation.mutate(document.id)
    }
  }

  const documents = documentsData?.documents || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
        <p className="mt-2 text-gray-600">
          Upload and manage your documents for AI analysis
        </p>
      </div>

      {/* Upload Area */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
        
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? 'active' : ''} ${isDragReject ? 'reject' : ''}`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <div className="text-center">
              <Loader className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Uploading... {uploadProgress}%
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : isDragActive ? (
            <div className="text-center">
              <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your document here
              </p>
            </div>
          ) : (
            <div className="text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drag & drop a document here, or click to select
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supports PDF, DOCX, TXT, and MD files up to 50MB
              </p>
              <button className="btn btn-primary">
                Choose File
              </button>
            </div>
          )}
        </div>

        {/* Upload Guidelines */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Upload Guidelines:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Supported formats: PDF, DOCX, TXT, MD</li>
                <li>Maximum file size: 50MB</li>
                <li>Documents will be processed and chunked for AI analysis</li>
                <li>Processing time depends on document size and complexity</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Documents ({documents.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-gray-200 rounded"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-32"></div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Failed to load documents</p>
            <button 
              onClick={() => queryClient.invalidateQueries('documents')}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-900 mb-2">No documents yet</p>
            <p className="text-gray-500 mb-6">
              Upload your first document to get started with AI analysis
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((document) => (
              <div key={document.id} className="document-item">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="title">{document.filename}</h3>
                      <div className="meta">
                        <span>{formatFileSize(document.size)}</span>
                        <span className="mx-2">•</span>
                        <span>{document.pages} pages</span>
                        <span className="mx-2">•</span>
                        <span>{document.chunks} chunks</span>
                        <span className="mx-2">•</span>
                        <span>Uploaded {formatDate(document.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Processed
                    </div>
                    
                    <button
                      onClick={() => handleDelete(document)}
                      disabled={deleteMutation.isLoading}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors duration-200"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Document Stats */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Word Count:</span>
                      <span className="ml-2 font-medium">{document.wordCount || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Reading Time:</span>
                      <span className="ml-2 font-medium">
                        {document.metadata?.readingTime || 'N/A'} min
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Language:</span>
                      <span className="ml-2 font-medium">
                        {document.metadata?.language?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Processed:</span>
                      <span className="ml-2 font-medium">
                        {formatDate(document.processedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Documents
