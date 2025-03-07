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

// Función para suscribirse a las notificaciones push
async function subscribeToPushNotifications(registro, user) {
  try {
    // Suscribirse a las notificaciones push
    const subscription = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keys.publicKey // Reemplaza con tu clave pública
    });

    const subscriptionJSON = subscription.toJSON();
    console.log('📡 Suscripción generada:', subscriptionJSON);

    // Datos que se enviarán al backend
    const payload = {
      subscription: subscriptionJSON,
      userId: user.userId
    };

    // Registrar en consola los datos antes de enviar
    console.log('📤 Enviando al backend:', payload);

    // Enviar la suscripción al backend
    const response = await fetch('http://localhost:5000/auth/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(payload) // Enviar el objeto correctamente
    });

    const result = await response.json();
    console.log('✅ Respuesta del backend:', result);
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
