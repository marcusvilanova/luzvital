// Modal acessível: foco preso dentro, Esc fecha, devolve o foco ao elemento de origem.
import { html, mount } from "../lib/dom.js";
import { icone } from "./icones.js";

const FOCAVEIS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Abre um modal. `aoConfirmar(form)` pode lançar erro para manter o modal aberto.
 * @returns {Promise<boolean>} true se confirmou
 */
export function abrirModal({ titulo, corpo, confirmar = "Confirmar", cancelar = "Cancelar", perigo = false, aoConfirmar }) {
  const origem = document.activeElement;
  const fundo = document.createElement("div");
  fundo.className = "modal-backdrop";
  mount(fundo, html`<form class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" novalidate>
    <div class="modal-head">
      <h2 id="modal-titulo">${titulo}</h2>
      <button class="modal-close" type="button" data-fechar aria-label="Fechar">${icone("fechar")}</button>
    </div>
    <div class="modal-body">${corpo}</div>
    <div class="modal-foot">
      <button class="btn btn-secondary" type="button" data-fechar>${cancelar}</button>
      <button class="btn ${perigo ? "btn-danger" : "btn-primary"}" type="submit">${confirmar}</button>
    </div>
  </form>`);
  document.body.append(fundo);
  const form = fundo.querySelector("form");

  return new Promise((resolver) => {
    const fechar = (resultado) => {
      fundo.remove();
      document.removeEventListener("keydown", teclado);
      origem?.focus?.();
      resolver(resultado);
    };
    const teclado = (e) => {
      if (e.key === "Escape") fechar(false);
      if (e.key !== "Tab") return;
      const itens = [...form.querySelectorAll(FOCAVEIS)].filter((el) => !el.disabled);
      const [primeiro, ultimo] = [itens[0], itens.at(-1)];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", teclado);
    fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(false); });
    form.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => fechar(false)));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const botao = form.querySelector('[type="submit"]');
      botao.disabled = true;
      try {
        if (aoConfirmar) await aoConfirmar(form);
        fechar(true);
      } catch {
        botao.disabled = false; // aoConfirmar já mostrou o erro
      }
    });
    (form.querySelector(".modal-body " + FOCAVEIS) ?? form.querySelector('[type="submit"]')).focus();
  });
}
