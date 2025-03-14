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
  if (event.tag === 'sync-usuarios') {
    console.log('📡 Intentando sincronizar datos de usuarios guardados...');
    event.waitUntil(enviarDatosGuardados());
  }
});

async function enviarDatosGuardados() {
  let db = await openDatabase();

  // Accede a los registros de los usuarios en IndexedDB
  const transaction = db.transaction('usuarios', 'readonly');
  const store = transaction.objectStore('usuarios');
  const request = store.getAll(); // Obtiene todos los registros almacenados

  request.onsuccess = async () => {
    let registros = request.result;
    
    if (registros.length > 0) {
      console.log('Enviando usuarios guardados al servidor...');
      // Sincroniza cada registro de usuario
      for (let registro of registros) {
        try {
          const response = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registro),
          });

          if (response.ok) {
            console.log(`✔ Usuario ${registro.id} sincronizado correctamente`);
            await eliminarUsuarioDeIndexedDB(db, registro.id); // Eliminar usuario sincronizado de la base de datos
          } else {
            console.error(`❌ Error al sincronizar usuario ${registro.id}`);
          }
        } catch (error) {
          console.error('❌ Error de red:', error);
        }
      }
    } else {
      console.log('No hay usuarios pendientes por sincronizar.');
    }
  };

  request.onerror = () => {
    console.error('❌ Error al obtener los registros de la base de datos');
  };
}

async function eliminarUsuarioDeIndexedDB(db, id) {
  const transaction = db.transaction('usuarios', 'readwrite');
  const store = transaction.objectStore('usuarios');
  store.delete(id); // Eliminar el usuario de la base de datos
  console.log(`✔ Usuario con ID ${id} eliminado de IndexedDB`);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('offlineDB', 2); // Asegúrate de que la base de datos esté abierta y sea la versión correcta

    dbRequest.onupgradeneeded = event => {
      const db = event.target.result;
      // Crear el almacén de objetos si no existe
      if (!db.objectStoreNames.contains('usuarios')) {
        db.createObjectStore('usuarios', { autoIncrement: true });
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
              await self.registration.sync.register('sync-usuarios');
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

async function savePostRequest(url, data) {
  const db = await openDatabase();
  const transaction = db.transaction('pendingRequest', 'readwrite');
  const store = transaction.objectStore('pendingRequest');

  // Limpiar la base de datos antes de guardar la nueva solicitud
  await store.clear();
  await store.put({ url, data });
  console.log('✅ Solicitud guardada en IndexedDB');
}
