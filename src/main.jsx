import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import keys from '../keys.json';




export async function registerServiceWorkerAndSubscribe() {
  // Recuperar usuario del localStorage
  let user = JSON.parse(localStorage.getItem('user'));
  console.log('🧠 Usuario recuperado del localStorage:', user);

  // Solo continuar si el usuario ha iniciado sesión
  if (!user) {
    console.warn('❌ Usuario no autenticado. No se registrará la notificación.');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      // Registrar el Service Worker
      const registro = await navigator.serviceWorker.register('./sw.js', { type: 'module' });

      // Verificar el estado de los permisos de notificación
      if (Notification.permission === 'granted') {
        // Si ya se otorgó el permiso, suscribirse directamente
        await subscribeToPushNotifications(registro, user);
      } else if (Notification.permission === 'default') {
        // Si no se ha pedido el permiso, solicitarlo una vez
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await subscribeToPushNotifications(registro, user);
        } else {
          console.warn('❌ El usuario no ha concedido permisos para notificaciones');
        }
      } else {
        console.warn('❌ El usuario ha denegado los permisos de notificación');
      }
    } catch (error) {
      console.error('❌ Error al registrar Service Worker o suscripción:', error);
    }
  }
}


async function subscribeToPushNotifications(registro, user) {
  try {
    const subscription = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keys.publicKey
    });

    const subscriptionJSON = subscription.toJSON();
    console.log('📡 Suscripción generada:', subscriptionJSON);

    const payload = {
      subscription: subscriptionJSON,
      userId: user.userId
    };

    console.log('📤 Enviando al backend:', payload);

    const response = await fetch('https://backend-be7l.onrender.com/auth/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('✅ Respuesta del backend:', result);

    // Enviar notificación directa
    if (Notification.permission === 'granted') {
      new Notification('Notificación Activa', {
        body: '¡Ya estás suscrito a las notificaciones!',
        icon: './icons/sao_1.png' // Reemplaza con el ícono de tu preferencia
      });
    }
    
  } catch (error) {
    console.error('❌ Error al suscribirse o enviar la suscripción al backend:', error);
  }
}

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
