import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('[Frontend] Application starting...')
console.log('[Frontend] API Base URL:', import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
