import { html, mount } from "../lib/dom.js";
import { icone } from "./icones.js";

const DURACAO_MS = 5000;
const ICONE = { success: "ok", error: "erro", info: "info" };

function regiao() {
  let el = document.querySelector(".toast-region");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast-region";
    el.setAttribute("aria-live", "polite");
    document.body.append(el);
  }
  return el;
}

export function toast(mensagem, tipo = "info") {
  const item = document.createElement("div");
  item.className = `toast toast-${tipo}`;
  item.setAttribute("role", tipo === "error" ? "alert" : "status");
  mount(item, html`${icone(ICONE[tipo])}<div>${mensagem}</div>`);
  regiao().append(item);
  setTimeout(() => item.remove(), DURACAO_MS);
}
