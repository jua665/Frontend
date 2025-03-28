const APP_SHELL_CACHE = 'AppShellv6';
const DYNAMIC_CACHE = 'DinamicoV6';

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


// Instalación del Service Worker y caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

// Guardar en IndexedDB en caso de fallo de red
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

    let request = store.add(data);
    request.onsuccess = () => {
      console.log("Datos guardados en IndexedDB");
      if (self.registration.sync) {
        self.registration.sync.register("syncUsuarios").catch(err => {
          console.error("Error al registrar la sincronización:", err);
        });
      }
    };

    request.onerror = event => console.error("Error al guardar en IndexedDB:", event.target.error);
  };

  dbRequest.onerror = event => console.error("Error al abrir IndexedDB:", event.target.error);
}

// Interceptar solicitudes
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith("http")) return; // Evitar extensiones

  if (event.request.method === "POST") {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        const formData = await event.request.clone().formData();
        let data = {};
        formData.forEach((value, key) => {
          data[key] = value;
        });

        InsertIndexedDB(data);
        return new Response(
          JSON.stringify({ message: "Datos guardados offline" }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          let clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});


// Sincronización en segundo plano
self.addEventListener('sync', event => {
  if (event.tag === "syncUsuarios") {
    event.waitUntil(
      new Promise((resolve, reject) => {
        let dbRequest = indexedDB.open("database", 2);

        dbRequest.onsuccess = event => {
          let db = event.target.result;

          if (!db.objectStoreNames.contains("Usuarios")) {
            console.error("No hay datos en IndexedDB.");
            resolve();
            return;
          }

          let transaction = db.transaction("Usuarios", "readonly");
          let store = transaction.objectStore("Usuarios");
          let getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            let usuarios = getAllRequest.result;
            if (usuarios.length === 0) {
              console.log("No hay usuarios para sincronizar.");
              resolve();
              return;
            }

            let postPromises = usuarios.map(user =>
              fetch('https://backend-be7l.onrender.com/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
              })
            );

            Promise.all(postPromises)
              .then(responses => {
                let success = responses.every(response => response.ok);
                if (success) {
                  let deleteTransaction = db.transaction("Usuarios", "readwrite");
                  let deleteStore = deleteTransaction.objectStore("Usuarios");
                  deleteStore.clear().onsuccess = () => console.log("Usuarios sincronizados y eliminados.");
                } else {
                  console.error("Algunas respuestas fallaron:", responses);
                }
              })
              .catch(error => {
                console.error("Error al sincronizar con la API:", error);
                reject(error);
              });
          };

          getAllRequest.onerror = () => {
            console.error("Error al obtener datos de IndexedDB:", getAllRequest.error);
            reject(getAllRequest.error);
          };
        };

        dbRequest.onerror = event => {
          console.error("Error al abrir IndexedDB:", event.target.error);
          reject(event.target.error);
        };
      })
    );
  }
});

// Activación del SW y limpieza de caché antigua
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE) {
            console.log("Eliminando caché antigua:", key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Intentar sincronizar los datos al recuperar conexión
self.addEventListener("sync", (event) => {
  if (event.tag === "syncUsuarios") {
    event.waitUntil(syncData());
  }
});

// También llamar a la sincronización cuando vuelva la conexión
self.addEventListener("online", () => {
  console.log("Conexión restaurada, intentando sincronizar...");
  syncData();
});

// Función de sincronización mejorada
async function syncData() {
  const dbRequest = indexedDB.open("database", 2);

  dbRequest.onsuccess = async (event) => {
    let db = event.target.result;
    if (!db.objectStoreNames.contains("Usuarios")) return;

    let transaction = db.transaction("Usuarios", "readonly");
    let store = transaction.objectStore("Usuarios");
    let getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => {
      let usuarios = getAllRequest.result;
      if (usuarios.length === 0) return;

      let successfulRequests = [];
      for (const user of usuarios) {
        try {
          let response = await fetch("https://backend-be7l.onrender.com/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user),
          });
          if (response.ok) successfulRequests.push(user.id);
        } catch (error) {
          console.error("Error al sincronizar:", error);
        }
      }

      // Si se enviaron con éxito, eliminarlos de IndexedDB
      if (successfulRequests.length > 0) {
        let deleteTx = db.transaction("Usuarios", "readwrite");
        let deleteStore = deleteTx.objectStore("Usuarios");
        successfulRequests.forEach((id) => deleteStore.delete(id));
        console.log("Usuarios sincronizados y eliminados.");
      }
    };
  };
}



self.addEventListener("push", (event) => {

  let options={
      body:event.data.text(),
       body: "Hola, cómo estás?",
      image: "./icons/sao_1.png",
  }
  
  self.registration.showNotification("Titulo",options); 
   
});