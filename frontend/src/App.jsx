import React from 'react'
import { Routes, Route } from 'react-router-dom'
import WriterWorkspace from './pages/WriterWorkspace'
import Documents from './pages/Documents'
import History from './pages/History'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<WriterWorkspace />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/history" element={<History />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}

export default App
