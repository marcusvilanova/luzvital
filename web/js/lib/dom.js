// Template HTML com escape automático: todo valor interpolado vira texto, exceto o que vem de html``.
const RAW = Symbol("raw");

export function raw(texto) {
  return { [RAW]: String(texto) };
}

export function esc(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paraHtml(valor) {
  if (valor === null || valor === undefined || valor === false) return "";
  if (Array.isArray(valor)) return valor.map(paraHtml).join("");
  if (typeof valor === "object" && RAW in valor) return valor[RAW];
  return esc(valor);
}

export function html(partes, ...valores) {
  let saida = partes[0];
  valores.forEach((valor, i) => {
    saida += paraHtml(valor) + partes[i + 1];
  });
  return raw(saida);
}

export function mount(elemento, template) {
  elemento.innerHTML = paraHtml(template);
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/** Lê um formulário como objeto; checkboxes viram boolean. */
export function lerFormulario(form) {
  const dados = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") dados[el.name] = el.checked;
    else if (el.type === "radio") { if (el.checked) dados[el.name] = el.value; }
    else dados[el.name] = el.value.trim();
  }
  return dados;
}

/** Mostra erros por campo ({campo: mensagem}) e foca o primeiro. */
export function mostrarErros(form, erros) {
  for (const el of form.querySelectorAll("[aria-invalid]")) el.removeAttribute("aria-invalid");
  for (const msg of form.querySelectorAll(".field-error")) msg.textContent = "";
  let primeiro = null;
  for (const [campo, mensagem] of Object.entries(erros)) {
    const el = form.elements[campo];
    const alvo = el instanceof RadioNodeList ? el[0] : el;
    const saida = form.querySelector(`[data-erro-de="${campo}"]`);
    if (alvo) alvo.setAttribute("aria-invalid", "true");
    if (saida) saida.textContent = mensagem;
    primeiro ??= alvo;
  }
  primeiro?.focus();
  return Object.keys(erros).length === 0;
}

export function novoId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
