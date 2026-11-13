// Mapa do gestor (Leaflet + OpenStreetMap). A biblioteca só é baixada quando a tela do mapa abre.
import { esc } from "../lib/dom.js";
import { duracao, watts } from "../lib/formato.js";
import { MINUTOS_ALERTA, RAIO_PONTOS_KM, TIPOS_APARELHO, TIPOS_FONTE_PONTO } from "../lib/regras.js";

const LEAFLET = {
  css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  cssSri: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
  js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  jsSri: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
};
const COR_CRITICA = "#f1c21b";
const COR_OK = "#0f62fe";

let carregamento = null;

function carregarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  carregamento ??= new Promise((resolver, rejeitar) => {
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: LEAFLET.css, integrity: LEAFLET.cssSri, crossOrigin: "" });
    const js = Object.assign(document.createElement("script"), { src: LEAFLET.js, integrity: LEAFLET.jsSri, crossOrigin: "" });
    js.onload = () => resolver(window.L);
    js.onerror = () => { carregamento = null; rejeitar(new Error("Não foi possível carregar o mapa.")); };
    document.head.append(css, js);
  });
  return carregamento;
}

function popupOcorrencia(o) {
  const critico = o.aparelhoCritico;
  return `<strong>${esc(o.paciente.nome)}</strong><br>${esc(o.paciente.bairro)}<br>
    ${esc(critico ? TIPOS_APARELHO[critico.tipo] : "—")} · <strong>${esc(duracao(o.minutosRestantes))}</strong><br>
    <a href="#/gestor/ocorrencias/${encodeURIComponent(o.id)}">Abrir ocorrência</a>`;
}

function popupPonto(p) {
  return `<strong>${esc(p.nome)}</strong><br>${esc(TIPOS_FONTE_PONTO[p.tipoFonte])} · ${esc(watts(p.capacidadeW))}<br>${esc(p.endereco ?? "")}`;
}

/**
 * Cria o mapa em `elemento`. Devolve { atualizar(ocorrencias, pontos), destruir() }.
 * Mantém o zoom do usuário entre atualizações; só enquadra tudo na primeira carga.
 */
export async function criarMapa(elemento) {
  const L = await carregarLeaflet();
  const mapa = L.map(elemento, { scrollWheelZoom: false }).setView([-23.69, -46.72], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  const camada = L.layerGroup().addTo(mapa);
  let enquadrado = false;

  function atualizar(ocorrencias, pontos) {
    camada.clearLayers();
    const limites = [];
    for (const p of pontos.filter((x) => x.ativo)) {
      const icone = L.divIcon({ className: "map-ponto", iconSize: [14, 14] });
      L.marker([p.lat, p.lng], { icon: icone, title: p.nome }).bindPopup(popupPonto(p)).addTo(camada);
      L.circle([p.lat, p.lng], { radius: RAIO_PONTOS_KM * 1000, color: "#009d9a", weight: 1, opacity: 0.35, fillOpacity: 0.04, interactive: false }).addTo(camada);
      limites.push([p.lat, p.lng]);
    }
    for (const o of ocorrencias) {
      const critica = o.minutosRestantes < MINUTOS_ALERTA;
      L.circleMarker([o.paciente.lat, o.paciente.lng], {
        radius: critica ? 10 : 8, color: "#161616", weight: 1.5,
        fillColor: critica ? COR_CRITICA : COR_OK, fillOpacity: 0.95,
      }).bindPopup(popupOcorrencia(o)).bindTooltip(`${o.paciente.nome} · ${duracao(o.minutosRestantes)}`).addTo(camada);
      limites.push([o.paciente.lat, o.paciente.lng]);
    }
    if (!enquadrado && limites.length) {
      mapa.fitBounds(limites, { padding: [24, 24], maxZoom: 14 });
      enquadrado = true;
    }
  }

  return { atualizar, destruir: () => mapa.remove() };
}
