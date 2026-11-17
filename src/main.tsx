import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Enregistrement immédiat du Service Worker PWA pour le mode hors-ligne
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
