const APP_SHELL_CACHE = 'AppShellv4';
const DYNAMIC_CACHE = 'DinamicoV4';

const APP_SHELL_FILES = [
  '/', 
  '/index.html', 
  '/offline.html', 
  '/index.css',
  '/App.css',
  '/App.jsx',
  '/main.jsx',
  '/components/Home.jsx',
  '/components/Login.jsx',
  '/components/Register.jsx',
  '/icons/sao_1.png',
  '/icons/sao_2.png',
  '/icons/sao_3.png',
  '/icons/carga.png',
  '/screenshots/cap.png',
  '/screenshots/cap1.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache => {
      console.log("Cacheando archivos del APP SHELL...");
      return cache.addAll(APP_SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith("http")) return;

  if (event.request.method === "POST") {
    event.respondWith(
      event.request.clone().json()
        .then(body => 
          fetch(event.request)
            .catch(() => {
              InsertIndexedDB(body);
              return new Response(JSON.stringify({ message: "Datos guardados offline" }), {
                headers: { "Content-Type": "application/json" }
              });
            })
        )
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(response => {
          let clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        });
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return caches.match('/offline.html');
      })
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE) {
            console.log("Eliminando caché antigua:", key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

function InsertIndexedDB(data) {
  const dbRequest = indexedDB.open("database", 2);
  dbRequest.onupgradeneeded = event => {
    let db = event.target.result;
    if (!db.objectStoreNames.contains("Usuarios")) {
      db.createObjectStore("Usuarios", { keyPath: "id", autoIncrement: true });
    }
  };
  dbRequest.onsuccess = event => {
    let db = event.target.result;
    let transaction = db.transaction("Usuarios", "readwrite");
    let store = transaction.objectStore("Usuarios");
    store.add(data);
  };
}

self.addEventListener("push", (event) => {
  let options = {
    body: event.data ? event.data.text() : "Hola, cómo estás?",
    image: "./icons/sao_1.png",
  };
  self.registration.showNotification("Titulo", options);
});
