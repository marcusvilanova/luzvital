// Cartão de atalho dos painéis iniciais: ícone, título, explicação curta e um número vivo da seção.
import { html } from "../lib/dom.js";
import { icone } from "./icones.js";

export function atalho({ href, icone: nome, titulo, texto, numero, unidade = "" }) {
  return html`<a class="atalho c-3" href="${href}">
    ${icone(nome)}<h3>${titulo}</h3><p>${texto}</p>
    <span class="atalho-numero">${numero}<small>${unidade}</small></span>
    <svg class="icon seta" viewBox="0 0 32 32" aria-hidden="true"><path d="M18 6l-1.4 1.4L24.2 15H4v2h20.2l-7.6 7.6L18 26l10-10z"/></svg>
  </a>`;
}
