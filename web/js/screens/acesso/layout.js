import { logo } from "../../components/logo.js";
import { html } from "../../lib/dom.js";

/** Moldura das telas públicas: painel editorial escuro à esquerda (desktop) e formulário à direita. */
export function molduraAcesso(conteudo) {
  return html`<div class="auth-layout">
    <aside class="auth-aside" aria-hidden="true">
      <div class="grid-lines"></div>
      <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:var(--space-05)">
        ${logo({ grande: true })}
        <span class="eyebrow" style="color:var(--gray-30)">Global Solution 2026/2 · Mind-Dev</span>
      </div>
      <div style="position:relative">
        <h1>Quando a luz cai, cada minuto de bateria conta.</h1>
        <p>Cadastre os aparelhos de quem depende de energia para viver. No apagão, o socorro chega primeiro a quem tem menos tempo.</p>
      </div>
      <div class="battery-art"><span></span><span></span><span></span><span></span><span></span><span></span></div>
    </aside>
    <main class="auth-panel" id="conteudo">
      <a class="shell-brand" href="#/login" aria-label="Luz Vital" style="color:var(--text-primary);padding:0;margin-bottom:var(--space-09)">${logo({ grande: true })}</a>
      ${conteudo}
    </main>
  </div>`;
}
