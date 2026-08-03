import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './lib/i18n'
import { initTheme } from './lib/theme'

// İlk boyamadan önce: koyu/açık geçişi göz kırpması yaşanmasın
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </I18nProvider>
  </StrictMode>,
)
