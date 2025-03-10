const APP_SHELL_CACHE = 'AppShellv3';
const DYNAMIC_CACHE = 'DinamicoV3';

const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/offline.html",
  "/src/index.css",
  "/src/App.css",
  "/src/App.jsx",
  "/src/main.jsx",
  "/src/components/Home.jsx",
  "/src/components/Login.jsx",
  "/src/components/Register.jsx",
  "/src/icons/sao_1.png",
  "/src/icons/sao_2.png",
  "/src/icons/sao_3.png",
  "/src/icons/carga.png",
  "/src/screenshots/cap.png",
  "/src/screenshots/cap1.png",
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

// Guardar POST fallido en IndexedDB
async function savePostRequest(url, data) {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('offlineDB', 1);

    dbRequest.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
      }
    };

    dbRequest.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction('pendingRequests', 'readwrite');
      const store = transaction.objectStore('pendingRequests');
      store.add({ url, data });

      transaction.oncomplete = () => resolve();
      transaction.onerror = event => reject(event.target.error);
    };

    dbRequest.onerror = event => reject(event.target.error);
  });
}

// Recuperar y reenviar POST fallidos guardados en IndexedDB
async function syncPosts() {
  return new Promise((resolve, reject) => {
      const dbRequest = indexedDB.open('offlineDB', 1);

      dbRequest.onsuccess = async event => {
          const db = event.target.result;
          const transaction = db.transaction('pendingRequests', 'readwrite');
          const store = transaction.objectStore('pendingRequests');

          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = async event => {
              const requests = event.target.result;
              console.log('📂 Solicitudes pendientes:', requests);

              for (const request of requests) {
                  try {
                      const response = await fetch(request.url, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(request.data),
                      });

                      if (response.ok) {
                          store.delete(request.id);
                          console.log("✔ POST sincronizado y eliminado de IndexedDB");
                      } else {
                          console.warn("⚠️ Error al sincronizar POST:", response.statusText);
                      }
                  } catch (error) {
                      console.error("❌ Error al sincronizar POST", error);
                  }
              }
              resolve();
          };

          getAllRequest.onerror = event => {
              console.error("❌ Error al obtener las solicitudes fallidas", event.target.error);
              reject(event.target.error);
          };
      };

      dbRequest.onerror = event => {
          console.error("❌ Error al abrir IndexedDB", event.target.error);
          reject(event.target.error);
      };
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method === 'POST') {
    console.log("📡 Interceptando POST a:", event.request.url);

    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        console.warn("❌ Falló el fetch, guardando en IndexedDB...");

        try {
          const requestClone = event.request.clone();
          const body = await requestClone.json();

          if (body) {
            await savePostRequest(event.request.url, body);

            if ('sync' in self.registration) {
              try {
                await self.registration.sync.register('sync-posts');
                console.log("✅ Sincronización registrada con éxito.");
              } catch (syncError) {
                console.error('❌ Error registrando sync:', syncError);
              }
            }

            return new Response(
              JSON.stringify({ message: 'Offline. Se guardó localmente' }), 
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          } else {
            console.error("❌ Cuerpo de la solicitud vacío");
            return new Response(
              JSON.stringify({ error: 'Cuerpo de la solicitud vacío' }), 
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        } catch (error) {
          console.error("❌ Error al procesar el cuerpo de la solicitud:", error);
          return new Response(
            JSON.stringify({ error: 'Error al procesar el cuerpo de la solicitud' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      })
    );
  }
});


self.addEventListener('push', event => {
  let data = {};
  
  try {
    data = event.data.json(); // Intenta obtener el payload JSON
  } catch (e) {
    console.warn('❌ No se recibió un payload JSON. Usando valores predeterminados.');
    data = { title: 'Notificación', body: 'Nuevo mensaje recibido', icon: '/icons/sao_2.png' };
  }

  const options = {
    body: data.body || 'Cuerpo de la notificación por defecto',
    icon: data.icon || '/icons/sao_2.png',
    image: data.image || '/icons/sao_1.png',
    data: data.url || '/'
  };

  self.registration.showNotification(data.title || 'Título por defecto', options);
});

// Permite abrir una URL al hacer clic en la notificación
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const urlToOpen = event.notification.data;
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
