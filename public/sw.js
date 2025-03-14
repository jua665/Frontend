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
  console.log('🎉 Service Worker Activado');
});

// Manejo de sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === 'sync-posts') {
    console.log('📡 Intentando sincronizar POST guardado...');
    event.waitUntil(syncPost());
  }
});

// Guarda una solicitud POST en IndexedDB cuando no hay conexión
async function savePostRequest(url, data) {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');

  await store.put({ url, data });
  console.log('✅ Solicitud guardada en IndexedDB:', { url, data });
}

async function syncPost() {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readonly');
  const store = transaction.objectStore('pendingRequest');
  const requests = await store.getAll();

  if (requests.length > 0) {
    console.log(`🔄 Sincronizando ${requests.length} solicitudes pendientes...`);
    for (const req of requests) {
      try {
        const response = await fetch(req.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.data),
        });

        if (response.ok) {
          console.log('✔ POST sincronizado');
          // Borra solo si la sincronización fue exitosa
          await clearPendingRequest(db);
        } else {
          console.error('❌ Error al sincronizar POST: Response no OK');
        }
      } catch (error) {
        console.error('❌ Error al sincronizar POST', error);
      }
    }
  } else {
    console.log('✅ No hay solicitudes pendientes en IndexedDB');
  }
}

async function clearPendingRequest(db) {
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');
  await store.clear(); // Borra las solicitudes solo después de la sincronización
}


// Abre o crea la base de datos IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('offlineDB', 1);

    dbRequest.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequest')) {
        db.createObjectStore('pendingRequest', { autoIncrement: true });
      }
    };

    dbRequest.onsuccess = event => resolve(event.target.result);
    dbRequest.onerror = event => reject(event.target.error);
  });
}

// Intercepta las solicitudes de red
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

            // Intentar sincronizar en el siguiente inicio
            event.waitUntil(syncPost());

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
