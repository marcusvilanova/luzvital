// Plano de contingência: gerado pela IA no backend e guardado no aparelho para funcionar sem sinal.
import { icone } from "../../components/icones.js";
import { aviso, cabecalho, carregando } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { dataHora, duracao } from "../../lib/formato.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro, SemConexao } from "../../services/erros.js";

const chaveCache = (pacienteId) => `lv.plano.${pacienteId}`;

function lerCache(pacienteId) {
  try {
    return JSON.parse(localStorage.getItem(chaveCache(pacienteId)));
  } catch {
    return null;
  }
}

const ORIGEM = { ia: "Gerado por IA", modelo_padrao: "Plano padrão" };

/** Texto corrido do plano para leitura em voz alta (cuidadores com pouca visão ou sob tensão). */
function textoParaFala(plano) {
  const etapas = plano.etapas.map((e) => `${e.faixa}: ${e.acoes.join(" ")}`).join(" ");
  return `${plano.resumo} ${etapas} Peça ajuda quando: ${plano.quandoPedirAjuda.join(" ")} `
    + `Sinais de alerta, ligue 192: ${plano.sinaisAlerta.join(", ")}.`;
}

function falar(texto, botao) {
  const voz = window.speechSynthesis;
  if (!voz) return;
  if (voz.speaking) {
    voz.cancel();
    return;
  }
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.9;
  fala.onend = () => botao.setAttribute("aria-pressed", "false");
  botao.setAttribute("aria-pressed", "true");
  voz.speak(fala);
}

function desenharPlano(plano, { offline }) {
  return html`
    ${offline ? aviso("warning", "Você está sem conexão.", `Mostrando o plano salvo em ${dataHora(plano.geradoEm)}.`) : ""}
    <div class="split" style="margin-top:var(--space-06)">
      <div class="stack-lg">
        <section class="countdown" aria-label="Tempo crítico">
          <p class="eyebrow">Tempo até o aparelho mais crítico parar</p>
          <span class="countdown-value">${plano.minutosCriticos === 0 ? "00:00" : duracao(plano.minutosCriticos)}</span>
          <p>${plano.aparelhoCritico}. ${plano.resumo}</p>
        </section>
        <section aria-labelledby="t-etapas">
          <h2 id="t-etapas" style="margin-bottom:var(--space-05)">O que fazer, passo a passo</h2>
          ${plano.etapas.map((e) => html`<div class="plan-step"><h3>${e.faixa}</h3><ol>${e.acoes.map((a) => html`<li>${a}</li>`)}</ol></div>`)}
        </section>
      </div>
      <aside class="stack">
        <section class="tile">
          <h3 style="margin-bottom:var(--space-04)">Ligue para</h3>
          <ul class="list">${plano.contatos.map((c) => html`<li><div class="list-body">
            <p class="list-title">${c.nome}</p><p class="list-meta">${c.quando}</p></div>
            ${/^\d+$/.test(c.numero) ? html`<a class="btn btn-primary btn-sm" href="tel:${c.numero}">${c.numero} ${icone("telefone")}</a>` : html`<span class="list-meta">${c.numero}</span>`}
          </li>`)}</ul>
        </section>
        <section class="tile">
          <h3 style="margin-bottom:var(--space-04)">Peça ajuda quando</h3>
          <ul style="margin:0;padding-left:1.25rem">${plano.quandoPedirAjuda.map((t) => html`<li>${t}</li>`)}</ul>
        </section>
        <section class="tile">
          <h3 style="margin-bottom:var(--space-04)">Sinais de alerta no paciente: ligue 192</h3>
          <div class="cluster">${plano.sinaisAlerta.map((s) => html`<span class="tag tag-outline">${s}</span>`)}</div>
        </section>
        <p class="legal">${plano.aviso}</p>
        <p class="muted" style="font-size:var(--text-label)"><span class="tag tag-blue">${ORIGEM[plano.origem] ?? "Plano"}</span> Atualizado em ${dataHora(plano.geradoEm)}</p>
      </aside>
    </div>`;
}

export default {
  titulo: "Plano de contingência",
  async render({ main, params, aoDeixar }) {
    let planoAtual = null;
    mount(main, html`${cabecalho({
      voltar: `#/pacientes/${params.id}`, sobretitulo: "Funciona sem internet", titulo: "Plano de contingência",
      acoes: html`${"speechSynthesis" in window ? html`<button class="btn btn-primary btn-sm" type="button" data-ouvir aria-pressed="false">Ouvir plano ${icone("som")}</button>` : ""}
        <button class="btn btn-tertiary btn-sm" type="button" data-atualizar>Gerar de novo ${icone("atualizar")}</button>`,
    })}<div data-plano>${carregando("Montando o plano...")}</div>`);
    const alvo = $("[data-plano]", main);

    async function carregar() {
      mount(alvo, carregando("Montando o plano..."));
      try {
        const plano = await api.planos.obter(params.id);
        const salvo = { ...plano, geradoEm: plano.geradoEm ?? new Date().toISOString() };
        localStorage.setItem(chaveCache(params.id), JSON.stringify(salvo));
        planoAtual = salvo;
        mount(alvo, desenharPlano(salvo, { offline: false }));
      } catch (erro) {
        const cache = lerCache(params.id);
        if (erro instanceof SemConexao && cache) {
          planoAtual = cache;
          return mount(alvo, desenharPlano(cache, { offline: true }));
        }
        if (erro instanceof ApiError && erro.status === 409) {
          return mount(alvo, html`${aviso("info", "Cadastre um aparelho para gerar o plano.")}
            <a class="btn btn-primary" style="margin-top:var(--space-05)" href="#/pacientes/${params.id}/aparelhos/novo">Adicionar aparelho ${icone("camera")}</a>`);
        }
        mount(alvo, aviso("error", "Não foi possível montar o plano.", mensagemDeErro(erro)));
      }
    }
    $("[data-atualizar]", main).addEventListener("click", carregar);
    $("[data-ouvir]", main)?.addEventListener("click", (e) => planoAtual && falar(textoParaFala(planoAtual), e.currentTarget));
    aoDeixar(() => window.speechSynthesis?.cancel());
    await carregar();
  },
};
