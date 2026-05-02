// ============================================================
// SERVICE WORKER — AUTHON v2.0
// Atualizado para incluir todos os módulos JS e CSS
// Para forçar atualização: suba arquivos novos no GitHub
// ============================================================

const CACHE_VERSION = 'authon-cache-v61';

const urlsToCache = [
  // ── Fontes e ícones externos ──
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Oswald:wght@500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',

  // ── Bibliotecas externas ──
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js',

  // ── CSS do app ──
  'css/app.css',
  'css/nova-operacao.css',
  'css/historico.css',

  // ── Módulos JS (ordem de carregamento) ──
  'js/ui.js',
  'js/firebase.js',
  'js/configuracoes.js',
  'js/catalogo.js',
  'js/dashboard.js',
  'js/operacoes.js',
  'js/despesas.js',
  'js/agenda.js',
  'js/inspecao.js',
  'js/admin.js',
  'js/funcionarios.js',
  'js/fixes.js',

  // ── Assets ──
  'logo-icone-web.png',
];

// ── INSTALA E CACHEIA ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Cacheia um por um para não falhar tudo se um recurso estiver indisponível
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Não foi possível cachear:', url, err);
        }))
      );
    })
  );
});

// ── ATIVA E LIMPA CACHES ANTIGOS ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── ESTRATÉGIA DE FETCH ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // app.html — sempre da rede (garante versão mais recente)
  if (url.pathname.endsWith('app.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('app.html'))
    );
    return;
  }

  // index.html — sempre da rede
  if (url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Módulos JS e CSS — rede primeiro, cache como fallback offline
  const isModulo = url.pathname.includes('/js/') || url.pathname.includes('/css/');
  if (isModulo) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Atualiza o cache com a versão mais recente
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tudo mais (fontes, ícones, libs externas) — cache primeiro
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
