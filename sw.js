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

// Instalación: Precaching de la App Shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

// Activación: Limpieza de cachés antiguos
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

// Sincronización: Cuando la conexión se restablece, reintentar los POST fallidos
self.addEventListener('sync', event => {
  if (event.tag === 'sync-posts') {
    console.log('📡 Intentando sincronizar POST guardados...');
    event.waitUntil(syncPosts());
  }
});

// Guardar POST fallido en IndexedDB si no está duplicado
async function savePostRequest(url, data) {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequests', 'readwrite');
  const store = transaction.objectStore('pendingRequests');

  const allRequests = await store.getAll();
  const isDuplicate = allRequests.some(req => req.url === url && JSON.stringify(req.data) === JSON.stringify(data));

  if (!isDuplicate) {
    await store.add({ url, data });
    console.log('✅ Solicitud guardada en IndexedDB');
  } else {
    console.log('⚠ Solicitud duplicada no guardada');
  }
}

// Recuperar y reenviar POST fallidos guardados en IndexedDB
async function syncPosts() {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequests', 'readonly');
  const store = transaction.objectStore('pendingRequests');
  const requests = await store.getAll();

  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data),
      });
      if (response.ok) {
        await deleteRequestById(db, request.id);
        console.log('✔ POST sincronizado y eliminado de IndexedDB');
      }
    } catch (error) {
      console.error('❌ Error al sincronizar POST', error);
    }
  }
}

// Función para eliminar el registro de forma segura
async function deleteRequestById(db, id) {
  const transaction = db.transaction('pendingRequests', 'readwrite');
  const store = transaction.objectStore('pendingRequests');
  await store.delete(id);
}

// Abrir la base de datos IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('offlineDB', 1);

    dbRequest.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
      }
    };

    dbRequest.onsuccess = event => resolve(event.target.result);
    dbRequest.onerror = event => reject(event.target.error);
  });
}

// Intercepción de solicitudes POST
self.addEventListener('fetch', event => {
  if (event.request.method === 'POST') {
    if (!navigator.onLine) {
      console.warn('⚠ Sin conexión. Guardando POST en IndexedDB...');
      event.respondWith((async () => {
        try {
          const requestClone = event.request.clone();
          const body = await requestClone.json();

          if (body) {
            await savePostRequest(event.request.url, body);

            if ('sync' in self.registration) {
              await self.registration.sync.register('sync-posts');
            }

            return new Response(
              JSON.stringify({ message: 'Offline. Se guardó localmente' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          }
        } catch (error) {
          console.error('❌ Error al procesar la solicitud:', error);
        }
      })());
    }
  }
});
