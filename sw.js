const CACHE_NAME = 'vacitoplastico-pos-v1';
const ARCHIVOS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Instalar: guardar archivos en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ARCHIVOS);
    })
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => {
      return Promise.all(
        nombres.filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones: servir desde caché primero
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((respuesta) => {
      // Si está en caché, devolverlo
      if (respuesta) return respuesta;
      // Si no, intentar descargar de internet
      return fetch(event.request).then((respuestaRed) => {
        // Guardar en caché para la próxima vez
        if (respuestaRed && respuestaRed.status === 200) {
          const copia = respuestaRed.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copia);
          });
        }
        return respuestaRed;
      }).catch(() => {
        // Si no hay internet y no está en caché, devolver la página principal
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});