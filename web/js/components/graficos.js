// Gráficos leves em HTML/SVG (sem biblioteca), no estilo dos data viz do Carbon.
import { html, raw } from "../lib/dom.js";

const pct = (valor, maximo) => (maximo > 0 ? Math.max(2, Math.round((100 * valor) / maximo)) : 0);

/** Barras horizontais: [{rotulo, valor, destaque?}]. `secundario` desenha uma segunda série sobreposta. */
export function barras(itens, { titulo, secundario = null, legenda = null } = {}) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  return html`<figure class="chart">
    ${titulo ? html`<figcaption class="chart-title">${titulo}</figcaption>` : ""}
    ${legenda ? html`<div class="chart-legend">${legenda.map((l, i) => html`<span><i class="sw sw-${i + 1}"></i>${l}</span>`)}</div>` : ""}
    <ul class="chart-bars">${itens.map((i) => html`<li>
      <span class="chart-label">${i.rotulo}</span>
      <span class="chart-track" aria-hidden="true">
        <span class="chart-bar" style="width:${pct(i.valor, maximo)}%"></span>
        ${secundario ? html`<span class="chart-bar chart-bar-2" style="width:${i[secundario] ? pct(i[secundario], maximo) : 0}%"></span>` : ""}
      </span>
      <span class="chart-value">${i.valor}${secundario ? html`<small> · ${i[secundario]}</small>` : ""}</span>
    </li>`)}</ul>
  </figure>`;
}

/** Colunas verticais (histograma). */
export function colunas(itens, { titulo, unidade = "" } = {}) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  return html`<figure class="chart">
    ${titulo ? html`<figcaption class="chart-title">${titulo}</figcaption>` : ""}
    <div class="chart-columns" role="img" aria-label="${itens.map((i) => `${i.rotulo}: ${i.valor}${unidade}`).join("; ")}">
      ${itens.map((i) => html`<div class="chart-col">
        <span class="chart-col-value">${i.valor}</span>
        <span class="chart-col-bar" style="height:${i.valor ? pct(i.valor, maximo) : 0}%"></span>
        <span class="chart-col-label">${i.rotulo}</span>
      </div>`)}
    </div>
  </figure>`;
}

/** Anel de porcentagem com o número no centro. */
export function anel(percentual, rotulo) {
  const raio = 52;
  const circ = 2 * Math.PI * raio;
  const valor = percentual ?? 0;
  const traco = (circ * valor) / 100;
  return html`<figure class="chart chart-ring">
    <svg viewBox="0 0 128 128" role="img" aria-label="${rotulo}: ${percentual === null ? "sem dados" : `${valor}%`}">
      <circle cx="64" cy="64" r="${raio}" class="ring-track"></circle>
      ${raw(`<circle cx="64" cy="64" r="${raio}" class="ring-value" stroke-dasharray="${traco.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 64 64)"></circle>`)}
      <text x="64" y="70" text-anchor="middle" class="ring-text">${percentual === null ? "—" : `${valor}%`}</text>
    </svg>
    <figcaption class="chart-title">${rotulo}</figcaption>
  </figure>`;
}
