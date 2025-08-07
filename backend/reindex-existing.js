// Simple script to manually add existing documents to RAG service
import fs from 'fs/promises';

async function reindexExistingDocument() {
  try {
    console.log('Making API call to re-index existing document...');
    
    // Read the existing document
    const documentsData = JSON.parse(await fs.readFile('data/documents.json', 'utf8'));
    const document = documentsData[0]; // Get the first document
    
    if (!document) {
      console.log('No documents found to re-index');
      return;
    }
    
    console.log(`Re-indexing document: ${document.filename}`);
    
    // Make API call to add document to RAG service
    const response = await fetch('http://localhost:8000/api/documents/reindex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId: document.id })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Document re-indexed successfully:', result);
    } else {
      const error = await response.text();
      console.error('❌ Failed to re-index document:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

reindexExistingDocument();
