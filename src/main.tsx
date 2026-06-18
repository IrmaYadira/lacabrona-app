import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

// ── Eliminar skeleton de carga apenas React monta ──
const skeleton = document.getElementById('app-skeleton');
if (skeleton) {
  // Fade-out rápido antes de remover
  skeleton.style.transition = 'opacity 0.2s ease-out';
  skeleton.style.opacity = '0';
  setTimeout(() => skeleton.remove(), 250);
}

// ---- Auto-reload on stale chunk (post-deploy cache mismatch) ----
// When Vite rebuilds, chunk hashes change. If a user has the old index.html in cache,
// dynamic imports will fail with "Failed to fetch dynamically imported module".
// We catch those globally and force a hard reload so the browser fetches the new build.
let chunkReloadLock = false;
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message || event.reason || '');
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    if (chunkReloadLock) return;
    chunkReloadLock = true;
    console.warn('[chunk-reload] Stale chunk detected, hard-reloading to fetch latest build...', msg);
    // Use location.replace so we don't accumulate history entries
    window.location.replace(window.location.href);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)