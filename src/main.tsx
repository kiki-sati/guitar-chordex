import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initNative } from './native';
import './styles/tokens.css';
import './styles/global.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 네이티브 앱 초기화 (웹에서는 no-op)
void initNative();
