import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// V82: /area-cliente es la página pública para clientes (sin login del ERP).
// Cada parte se carga por separado para que el cliente no descargue el ERP entero.
const esAreaCliente = window.location.pathname.replace(/\/+$/, '') === '/area-cliente'
const App = lazy(() => import('./App.jsx'))
const AreaCliente = lazy(() => import('./AreaCliente.jsx'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      {esAreaCliente ? <AreaCliente /> : <App />}
    </Suspense>
  </React.StrictMode>,
)
