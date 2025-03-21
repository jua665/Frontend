import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';

// Inicializar IndexedDB
let db = window.indexedDB.open('database');

db.onupgradeneeded = event => {
  let result = event.target.result;
  if (!result.objectStoreNames.contains('libros')) {
    result.createObjectStore('libros', { autoIncrement: true });
  }
};

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
