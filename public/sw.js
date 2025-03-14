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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

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

self.addEventListener('sync', event => {
  if (event.tag === 'sync-posts') {
    console.log('📡 Intentando sincronizar POST guardado...');
    event.waitUntil(syncPosts());
  }
});

async function savePostRequest(url, data) {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');

  // Guardar la nueva solicitud de POST sin limpiar la base de datos
  await store.put({ url, data });
  console.log('✅ Solicitud guardada en IndexedDB');
}

async function syncPosts() {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readonly');
  const store = transaction.objectStore('pendingRequest');
  const requests = await store.getAll();

  if (requests.length > 0) {
    try {
      for (const request of requests) {
        const response = await fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data),
        });

        if (response.ok) {
          console.log(`✔ POST sincronizado: ${request.url}`);
        } else {
          console.error(`❌ Error al enviar el POST: ${request.url}`);
        }
      }
      await clearPendingRequests(db);
      console.log('✔ Todos los POST sincronizados y eliminados de IndexedDB');
    } catch (error) {
      console.error('❌ Error al sincronizar los POST:', error);
    }
  } else {
    console.log('No hay solicitudes pendientes para sincronizar.');
  }
}

async function clearPendingRequests(db) {
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');
  await store.clear();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('offlineDB', 2); // Aumentamos la versión de la base de datos

    dbRequest.onupgradeneeded = event => {
      const db = event.target.result;

      // Crear el almacén de objetos si no existe
      if (!db.objectStoreNames.contains('pendingRequest')) {
        db.createObjectStore('pendingRequest', { autoIncrement: true });
      }
    };

    dbRequest.onsuccess = event => resolve(event.target.result);
    dbRequest.onerror = event => reject(event.target.error);
  });
}

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

            // Registrar la sincronización para la próxima vez que haya conexión
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
