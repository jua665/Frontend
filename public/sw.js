const APP_SHELL_CACHE = 'AppShellv3';
const DYNAMIC_CACHE = 'DinamicoV3';

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/src/index.css',
  '/src/App.css',
  '/src/App.jsx',
  '/src/main.jsx',
  '/src/components/Home.jsx',
  '/src/components/Login.jsx',
  '/src/components/Register.jsx',
  '/src/icons/sao_1.png',
  '/src/icons/sao_2.png',
  '/src/icons/sao_3.png',
  '/src/icons/carga.png',
  '/src/screenshots/cap.png',
  '/src/screenshots/cap1.png'
];

// Instalación del SW y almacenamiento en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

// Activación y limpieza de caché viejo
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Escuchar eventos de sincronización en segundo plano
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-usuarios') {
    console.log('📡 Intentando sincronizar usuarios guardados...');
    event.waitUntil(sincronizarUsuariosPendientes());
  }
});

// Función para abrir IndexedDB
async function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('offlineDB', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('usuarios')) {
        db.createObjectStore('usuarios', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('❌ Error al abrir IndexedDB');
  });
}

// Función para sincronizar usuarios guardados en IndexedDB
async function sincronizarUsuariosPendientes() {
  if (!navigator.onLine) {
    console.warn("⚠️ No hay conexión. La sincronización se intentará más tarde.");
    return;
  }

  try {
    const db = await openOfflineDB();
    const transaction = db.transaction('usuarios', 'readonly');
    const store = transaction.objectStore('usuarios');

    const usuarios = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('❌ Error al obtener usuarios');
    });

    if (usuarios.length === 0) {
      console.log("✅ No hay usuarios pendientes por sincronizar.");
      return;
    }

    for (const usuario of usuarios) {
      try {
        const respuesta = await fetch('https://backend-be7l.onrender.com/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usuario.username, password: usuario.password })
        });

        if (respuesta.ok) {
          // Eliminar usuario sincronizado de IndexedDB
          const deleteTransaction = db.transaction('usuarios', 'readwrite');
          const deleteStore = deleteTransaction.objectStore('usuarios');
          deleteStore.delete(usuario.id);

          console.log(`✅ Usuario ${usuario.username} sincronizado y eliminado de IndexedDB.`);
        } else {
          console.warn(`⚠️ No se pudo sincronizar el usuario ${usuario.username}. Reintentando más tarde.`);
        }
      } catch (error) {
        console.error('❌ Error al sincronizar usuario:', error);
      }
    }

    db.close();
  } catch (error) {
    console.error("❌ Error al sincronizar usuarios pendientes:", error);
  }
}
