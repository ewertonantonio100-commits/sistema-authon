// ============================================================
// SERVICE WORKER — AUTHON
// A versão muda automaticamente a cada deploy
// Para forçar atualização: basta subir arquivos novos no GitHub
// ============================================================

const CACHE_VERSION = 'authon-cache-v19';
const urlsToCache = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Oswald:wght@500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instala e salva apenas recursos externos (não o app.html)
self.addEventListener('install', event => {
  self.skipWaiting(); // Ativa imediatamente sem esperar fechar abas
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume controle imediato
  );
});

// Estratégia: app.html sempre busca da rede (nunca do cache)
// Recursos externos: cache primeiro, rede como fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // app.html: SEMPRE busca da rede para garantir versão atualizada
  if (url.pathname.endsWith('app.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('app.html')) // offline: usa cache se tiver
    );
    return;
  }

  // Recursos externos: cache primeiro
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
