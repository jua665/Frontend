const APP_SHELL_CACHE = 'AppShellv3';
const DYNAMIC_CACHE = 'DinamicoV3';

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/offline.html', // Página offline
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
    event.waitUntil(syncPost());
  }
});

async function savePostRequest(url, data) {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');

  await store.clear();
  await store.put({ url, data });
  console.log('✅ Solicitud guardada en IndexedDB');
}

async function syncPost() {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readonly');
  const store = transaction.objectStore('pendingRequest');
  const request = await store.getAll();

  if (request.length > 0) {
    try {
      const response = await fetch(request[0].url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request[0].data),
      });

      if (response.ok) {
        await clearPendingRequest(db);
        console.log('✔ POST sincronizado y eliminado de IndexedDB');
      }
    } catch (error) {
      console.error('❌ Error al sincronizar POST', error);
    }
  }
}

async function clearPendingRequest(db) {
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');
  await store.clear();
}

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
  } else {
    // Si no es un POST y no hay conexión, sirve la página offline
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).catch(() => caches.match('/offline.html'));
      })
    );
  }
});
