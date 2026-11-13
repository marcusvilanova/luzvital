// Peças de interface reutilizadas pelas telas. Todas devolvem templates seguros (html``).
import { html } from "../lib/dom.js";
import { duracao } from "../lib/formato.js";
import { MINUTOS_ALERTA } from "../lib/regras.js";
import { icone } from "./icones.js";

const ICONE_AVISO = { info: "info", success: "ok", warning: "alerta", error: "erro", dark: "info" };

export function aviso(tipo, titulo, texto = "") {
  const papel = tipo === "error" ? "alert" : "status";
  return html`<div class="notice notice-${tipo}" role="${papel}">
    ${icone(ICONE_AVISO[tipo])}
    <div><strong>${titulo}</strong>${texto ? html` ${texto}` : ""}</div>
  </div>`;
}

export function carregando(texto = "Carregando...") {
  return html`<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${texto}</div>`;
}

export function esqueleto(linhas = 3) {
  return html`<div aria-busy="true" aria-label="Carregando">${Array.from({ length: linhas }, () => html`<div class="skeleton"></div>`)}</div>`;
}

export function vazio(titulo, texto, acao = "") {
  return html`<section class="empty">
    <div class="empty-art" aria-hidden="true"><span></span><span></span><span></span></div>
    <h2>${titulo}</h2><p>${texto}</p>${acao}
  </section>`;
}

export function cabecalho({ sobretitulo = "", titulo, descricao = "", acoes = "", voltar = "" }) {
  return html`<header class="page-head">
    <div>
      ${voltar ? html`<a class="btn btn-ghost btn-sm" href="${voltar}">${icone("voltar")}Voltar</a>` : ""}
      ${sobretitulo ? html`<p class="eyebrow">${sobretitulo}</p>` : ""}
      <h1 tabindex="-1" data-titulo>${titulo}</h1>
      ${descricao ? html`<p class="muted" style="margin-top:var(--space-03);max-width:60ch">${descricao}</p>` : ""}
    </div>
    ${acoes ? html`<div class="cluster">${acoes}</div>` : ""}
  </header>`;
}

export function campo({ nome, rotulo, tipo = "text", valor = "", ajuda = "", extra = "", obrigatorio = true }) {
  const id = `f-${nome}`;
  return html`<div class="field">
    <label for="${id}">${rotulo}${obrigatorio ? "" : " (opcional)"}</label>
    <input class="input" id="${id}" name="${nome}" type="${tipo}" value="${valor ?? ""}" aria-describedby="${id}-erro ${id}-ajuda" ${extra}>
    ${ajuda ? html`<p class="helper" id="${id}-ajuda">${ajuda}</p>` : ""}
    <p class="field-error" id="${id}-erro" data-erro-de="${nome}" aria-live="polite"></p>
  </div>`;
}

export function selecao({ nome, rotulo, opcoes, valor = "", vazio: textoVazio = "Selecione" }) {
  const id = `f-${nome}`;
  return html`<div class="field">
    <label for="${id}">${rotulo}</label>
    <select class="select" id="${id}" name="${nome}" aria-describedby="${id}-erro">
      <option value="">${textoVazio}</option>
      ${Object.entries(opcoes).map(([chave, texto]) => html`<option value="${chave}" ${chave === valor ? "selected" : ""}>${texto}</option>`)}
    </select>
    <p class="field-error" id="${id}-erro" data-erro-de="${nome}" aria-live="polite"></p>
  </div>`;
}

export function medidor(minutos, autonomia) {
  const total = autonomia > 0 ? autonomia : 1;
  const cheios = Math.round(Math.min(1, minutos / total) * 10);
  const baixo = minutos < MINUTOS_ALERTA;
  return html`<div class="meter ${baixo ? "low" : ""}" role="img" aria-label="Bateria: ${duracao(minutos)}">
    ${Array.from({ length: 10 }, (_, i) => html`<span class="${i < cheios ? "on" : ""}"></span>`)}
  </div>`;
}

export function tagMinutos(minutos) {
  if (minutos <= 0) return html`<span class="tag tag-yellow">sem bateria</span>`;
  if (minutos < MINUTOS_ALERTA) return html`<span class="tag tag-yellow">${duracao(minutos)}</span>`;
  return html`<span class="tag tag-outline">${duracao(minutos)}</span>`;
}

export function avisoLegal() {
  return html`<p class="legal"><strong>Em risco de vida, ligue 192.</strong>
    O Luz Vital não substitui o 192, o 193 nem o canal da distribuidora e não dá orientação clínica.</p>`;
}
