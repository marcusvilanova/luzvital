// Logo do Luz Vital: quadrado azul com o traço de um batimento cardíaco (eletrocardiograma: ondas P, QRS e T).
// O mesmo traço gera o favicon, os ícones do app (gerar-icones.py) e o arquivo icones/logo.svg.
import { html, raw } from "../lib/dom.js";

export const PULSO = "2,18 6.5,18 8,15.5 9.5,18 11.5,18 12.5,21 15,4 17.5,27 19,18 21,18 23.5,13.5 26,18 30,18";

export function marca(tamanho = "1.5rem") {
  return raw(`<svg class="logo-marca" viewBox="0 0 32 32" width="${tamanho}" height="${tamanho}" aria-hidden="true" focusable="false">
    <rect width="32" height="32" fill="#0f62fe"/>
    <polyline points="${PULSO}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`);
}

/** Marca + nome. `grande` para as telas de acesso. */
export function logo({ grande = false } = {}) {
  return html`<span class="logo ${grande ? "logo-grande" : ""}">${marca(grande ? "2.5rem" : "1.5rem")}<span class="logo-nome"><strong>Luz</strong>Vital</span></span>`;
}
