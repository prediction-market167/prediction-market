import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import App from './App'
import { store } from './store'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </Provider>
    </TonConnectUIProvider>
  </React.StrictMode>,
)
