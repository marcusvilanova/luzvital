import { abrirModal } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { cabecalho } from "../components/ui.js";
import { $, html, mount } from "../lib/dom.js";
import { CONFIG } from "../config.js";
import { instalacao } from "../services/instalacao.js";
import { restaurarDemonstracao } from "../services/mock-db.js";

const INTEGRANTES = [
  ["Hebert Lopes do Santos", "563192"],
  ["Nicolas Monteiro Ramiro", "562380"],
  ["Marcus Vinícius Vila Nova da Silva", "558771"],
  ["Bruno Ferreira", "563489"],
  ["Gabriel Robertoni Padilha", "566293"],
];

export default {
  titulo: "Sobre o app",
  render({ main }) {
    mount(main, html`
      ${cabecalho({ sobretitulo: "Global Solution 2026/2 · CitizenTech", titulo: "Sobre o Luz Vital",
        descricao: "Cadastra quem depende de aparelhos elétricos para viver e, quando a luz cai, ordena o socorro pelas horas de bateria que restam em cada casa." })}
      <div class="split">
        <div class="stack-lg">
          <p class="legal"><strong>O Luz Vital não é serviço de emergência.</strong> Não substitui o 192 (SAMU), o 193 (Bombeiros)
            nem o canal da distribuidora, e não dá orientação clínica. A regra de prioridade (menor bateria primeiro) é uma
            decisão de projeto, a validar com profissionais de saúde.</p>
          <section class="tile">
            <h3 style="margin-bottom:var(--space-04)">Grupo Mind-Dev · 2TDS</h3>
            <ul class="list">${INTEGRANTES.map(([nome, rm]) => html`<li><span>${nome}</span><span class="mono muted">RM ${rm}</span></li>`)}</ul>
          </section>
        </div>
        <aside class="stack">
          <section class="tile">
            <h3 style="margin-bottom:var(--space-04)">Versão</h3>
            <dl class="facts">
              <dt>Versão</dt><dd class="mono">${CONFIG.VERSAO}</dd>
              <dt>Commit</dt><dd class="mono">${CONFIG.COMMIT}</dd>
              <dt>Modo</dt><dd>${CONFIG.MODO === "mock" ? "Demonstração (dados locais)" : "Conectado às APIs"}</dd>
            </dl>
          </section>
          <section class="tile">
            <h3 style="margin-bottom:var(--space-04)">Privacidade</h3>
            <p style="font-size:var(--text-body-sm)">Saúde e endereço são dados sensíveis pela LGPD. Pedimos o mínimo e você pode pedir correção ou exclusão a qualquer momento.</p>
          </section>
          <section class="tile">
            <h3 style="margin-bottom:var(--space-04)">Instalar no celular</h3>
            <p style="font-size:var(--text-body-sm);margin-bottom:var(--space-04)">Instalado, o app abre sem barra do navegador e funciona sem internet:
              o plano de contingência fica salvo e o pedido de socorro espera o sinal voltar.</p>
            ${instalacao.instalado()
              ? html`<span class="tag tag-green">app instalado</span>`
              : instalacao.disponivel()
                ? html`<button class="btn btn-primary btn-block" type="button" data-instalar>Instalar o Luz Vital</button>`
                : html`<p class="muted" style="font-size:var(--text-label)">No celular, use o menu do navegador e toque em "Adicionar à tela inicial".</p>`}
          </section>
          ${CONFIG.MODO === "mock" ? html`<button class="btn btn-tertiary btn-block" type="button" data-restaurar>Restaurar dados de demonstração</button>` : ""}
        </aside>
      </div>`);

    $("[data-instalar]", main)?.addEventListener("click", async () => {
      if (await instalacao.instalar()) toast("Luz Vital instalado.", "success");
    });
    $("[data-restaurar]", main)?.addEventListener("click", async () => {
      const ok = await abrirModal({ titulo: "Restaurar dados de demonstração?", perigo: true, confirmar: "Restaurar",
        corpo: html`<p>Apaga tudo o que foi criado neste navegador e volta aos pacientes e pontos de teste.</p>`,
        aoConfirmar: () => restaurarDemonstracao() });
      if (ok) toast("Dados de demonstração restaurados.", "success");
    });
  },
};
