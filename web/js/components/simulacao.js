// Botões do simulador de apagão (só no modo demonstração), usados na fila e no painel do gestor.
import { CONFIG } from "../config.js";
import { html } from "../lib/dom.js";
import { icone } from "./icones.js";
import { abrirModal } from "./modal.js";
import { toast } from "./toast.js";

export const simuladorDisponivel = () => CONFIG.MODO === "mock";

export function botoesSimulacao() {
  if (!simuladorDisponivel()) return "";
  return html`<button class="btn btn-danger btn-sm" type="button" data-simular>Simular apagão ${icone("raio")}</button>
    <button class="btn btn-ghost btn-sm" type="button" data-limpar>Limpar simulação</button>`;
}

export async function simularComConfirmacao(aoTerminar) {
  const { simularApagao } = await import("../services/simulador.js");
  const ok = await abrirModal({
    titulo: "Simular apagão em massa?",
    confirmar: "Simular", perigo: true,
    corpo: html`<p>Cria 30 ocorrências abertas e 40 encerradas em bairros da Zona Sul, com pacientes fictícios marcados como "simulado".
      Serve para demonstrar a fila, o mapa e o painel de impacto sob carga.</p>`,
    aoConfirmar: () => simularApagao({ abertas: 30, historico: 40 }),
  });
  if (ok) { toast("Apagão simulado: 30 casas sem luz.", "success"); aoTerminar(); }
}

export async function limparComAviso(aoTerminar) {
  const { limparSimulacao } = await import("../services/simulador.js");
  await limparSimulacao();
  toast("Simulação removida.");
  aoTerminar();
}

/** Liga os botões renderizados por `botoesSimulacao` dentro de `raiz`. */
export function ligarSimulacao(raiz, aoTerminar) {
  raiz.querySelector("[data-simular]")?.addEventListener("click", () => simularComConfirmacao(aoTerminar));
  raiz.querySelector("[data-limpar]")?.addEventListener("click", () => limparComAviso(aoTerminar));
}
