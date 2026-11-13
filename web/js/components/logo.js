// Logo do Luz Vital: quadrado azul com uma linha de monitor de sinais vitais que vira um raio no meio (luz).
// O mesmo traço gera o favicon, os ícones do app (gerar-icones.py) e o arquivo icones/logo.svg.
import { html, raw } from "../lib/dom.js";

export const PULSO = "3,18 10,18 16,5 14,16 19.5,16 16.5,28 21,18 29,18";

export function marca(tamanho = "1.5rem") {
  return raw(`<svg class="logo-marca" viewBox="0 0 32 32" width="${tamanho}" height="${tamanho}" aria-hidden="true" focusable="false">
    <rect width="32" height="32" fill="#0f62fe"/>
    <polyline points="${PULSO}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`);
}

/** Marca + nome. `grande` para as telas de acesso. */
export function logo({ grande = false } = {}) {
  return html`<span class="logo ${grande ? "logo-grande" : ""}">${marca(grande ? "2.5rem" : "1.5rem")}<span class="logo-nome"><strong>Luz</strong>Vital</span></span>`;
}
