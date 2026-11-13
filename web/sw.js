// Service worker do Luz Vital: deixa o app instalável e usável sem sinal.
// Arquivos do app: rede primeiro (sempre a versão nova quando há internet), cache quando cai o sinal.
// Fontes e biblioteca do mapa: cache primeiro. Chamadas às APIs nunca são guardadas aqui.
const VERSAO = "luz-vital-c3b9c4dc9b";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/components.css",
  "./css/dashboard.css",
  "./css/layout.css",
  "./css/tokens.css",
  "./icones/icone-192.png",
  "./icones/icone-512-maskable.png",
  "./icones/icone-512.png",
  "./icones/logo.svg",
  "./icones/marca.svg",
  "./js/app.js",
  "./js/components/acoes-ocorrencia.js",
  "./js/components/alerta.js",
  "./js/components/atalho.js",
  "./js/components/estou-sem-luz.js",
  "./js/components/graficos.js",
  "./js/components/icones.js",
  "./js/components/logo.js",
  "./js/components/mapa.js",
  "./js/components/modal.js",
  "./js/components/ocorrencia.js",
  "./js/components/shell.js",
  "./js/components/simulacao.js",
  "./js/components/toast.js",
  "./js/components/ui.js",
  "./js/config.js",
  "./js/lib/bairros.js",
  "./js/lib/dom.js",
  "./js/lib/formato.js",
  "./js/lib/impacto.js",
  "./js/lib/painel.js",
  "./js/lib/plano.js",
  "./js/lib/prontidao.js",
  "./js/lib/regras.js",
  "./js/router.js",
  "./js/screens/acesso/cadastro.js",
  "./js/screens/acesso/layout.js",
  "./js/screens/acesso/login.js",
  "./js/screens/cuidador/aparelho-form.js",
  "./js/screens/cuidador/inicio.js",
  "./js/screens/cuidador/ocorrencia.js",
  "./js/screens/cuidador/paciente-form.js",
  "./js/screens/cuidador/paciente.js",
  "./js/screens/cuidador/pacientes.js",
  "./js/screens/cuidador/plano.js",
  "./js/screens/cuidador/pontos.js",
  "./js/screens/gestor/fila.js",
  "./js/screens/gestor/impacto.js",
  "./js/screens/gestor/inicio.js",
  "./js/screens/gestor/ocorrencia.js",
  "./js/screens/gestor/ponto-form.js",
  "./js/screens/gestor/pontos.js",
  "./js/screens/sobre.js",
  "./js/services/api-http.js",
  "./js/services/api-mock.js",
  "./js/services/api.js",
  "./js/services/erros.js",
  "./js/services/eventos.js",
  "./js/services/fila-offline.js",
  "./js/services/http.js",
  "./js/services/instalacao.js",
  "./js/services/mock-db.js",
  "./js/services/sessao.js",
  "./js/services/simulador.js",
];
const EXTERNOS_EM_CACHE = ["fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => Promise.allSettled(ARQUIVOS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function redePrimeiro(pedido) {
  const cache = await caches.open(VERSAO);
  try {
    const resposta = await fetch(pedido);
    if (resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  } catch {
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    if (pedido.mode === "navigate") return cache.match("./index.html");
    throw new Error("Sem conexão e sem cópia guardada");
  }
}

async function cachePrimeiro(pedido) {
  const cache = await caches.open(VERSAO);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const resposta = await fetch(pedido);
  if (resposta.ok || resposta.type === "opaque") cache.put(pedido, resposta.clone());
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    evento.respondWith(redePrimeiro(request));
  } else if (EXTERNOS_EM_CACHE.includes(url.hostname)) {
    evento.respondWith(cachePrimeiro(request));
  }
});
