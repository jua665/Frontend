import React, { useState } from 'react';
import axios from 'axios';


const API_URL = process.env.REACT_APP_API_URL;

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  console.log(API_URL);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      setError('Por favor, complete todos los campos.');
      return;
    }

    try {
      // Intentamos enviar los datos al backend
      await axios.post('https://backend-be7l.onrender.com/auth/register', { username, password })


      alert('Usuario registrado exitosamente');
      setUsername('');
      setPassword('');
      setError('');
    } catch (err) {
      console.error("❌ Error en POST. Guardando en IndexedDB...", err);
      // Guardamos en IndexedDB con la estructura que espera el SW:
      // { data: { url: <endpoint>, data: { ...payload } } }
      saveToIndexedDB({
        data: {
          url: `${API_URL}/register`,
          data: { username, password },
        },
      });

      // Si el navegador soporta SyncManager, registramos la sincronización
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.sync.register('sync-posts')
            .then(() => console.log("✅ Sincronización registrada en SW"))
            .catch(err => console.error("❌ Error registrando sync", err));
        });
      }
    }
  };

  function saveToIndexedDB(data) {
    const request = indexedDB.open('offlineDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction('pendingRequests', 'readwrite');
      const store = transaction.objectStore('pendingRequests');
      store.add(data);
      console.log("📥 Datos guardados en IndexedDB", data);
    };

    request.onerror = (error) => {
      console.error("❌ Error guardando en IndexedDB", error);
    };
  }

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.heading}>Registro</h2>
        {error && <div style={styles.error}>{error}</div>}
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Registrar</button>
      </form>
    </div>
  );
};

// Estilos en línea
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f4f4f9',
  },
  form: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    width: '300px',
    textAlign: 'center',
  },
  heading: {
    fontSize: '2rem',
    color: '#4CAF50',
    marginBottom: '20px',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginBottom: '15px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    fontSize: '1.2rem',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  error: {
    color: '#f44336',
    marginBottom: '10px',
  },
};

export default Register;
