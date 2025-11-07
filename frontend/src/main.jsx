import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css'; 

const el = document.getElementById('root');
if (!el) {  
  const rootDiv = document.createElement('div');
  rootDiv.id = 'root';
  document.body.appendChild(rootDiv);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
