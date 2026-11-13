// Modais de ação sobre a ocorrência (cuidador e gestor): atualizar bateria e encerrar.
import { html, lerFormulario, mostrarErros } from "../lib/dom.js";
import { RESULTADOS } from "../lib/regras.js";
import { api } from "../services/api.js";
import { ApiError, mensagemDeErro } from "../services/erros.js";
import { abrirModal } from "./modal.js";
import { toast } from "./toast.js";
import { campo } from "./ui.js";

function tratarErro(form, erro) {
  if (erro instanceof ApiError) mostrarErros(form, erro.campos);
  toast(mensagemDeErro(erro), "error");
  throw erro;
}

export function modalBateria(ocorrencia, aoAtualizar) {
  const limite = ocorrencia.aparelhoCritico?.autonomiaMin ?? 0;
  return abrirModal({
    titulo: "Quanto de bateria resta?",
    confirmar: "Salvar",
    corpo: html`<p style="margin-bottom:var(--space-05)">Veja no visor do aparelho e informe em minutos. A fila da equipe usa este número.</p>
      ${campo({ nome: "minutos", rotulo: `Minutos restantes (0 a ${limite})`, tipo: "number", extra: `min="0" max="${limite}" step="1" inputmode="numeric"` })}`,
    aoConfirmar: async (form) => {
      const { minutos } = lerFormulario(form);
      const valor = Number(minutos);
      if (minutos === "" || !Number.isInteger(valor) || valor < 0 || (limite > 0 && valor > limite)) {
        mostrarErros(form, { minutos: `Informe um valor entre 0 e ${limite}` });
        throw new Error("invalido");
      }
      try {
        aoAtualizar(await api.ocorrencias.atualizarBateria(ocorrencia.id, valor));
        toast("Bateria atualizada.", "success");
      } catch (erro) {
        tratarErro(form, erro);
      }
    },
  });
}

export function modalEncerrar(ocorrencia, aoAtualizar) {
  return abrirModal({
    titulo: "Encerrar ocorrência",
    confirmar: "Encerrar",
    corpo: html`<fieldset class="field" style="border:0;padding:0;margin:0">
      <legend>Como terminou?</legend>
      <div class="tile-group" style="margin-top:var(--space-03)">
        ${Object.entries(RESULTADOS).map(([k, v]) => html`<label class="tile-option"><input type="radio" name="resultado" value="${k}"><span>${v}</span></label>`)}
      </div>
      <p class="field-error" data-erro-de="resultado" aria-live="polite"></p>
    </fieldset>`,
    aoConfirmar: async (form) => {
      const { resultado } = lerFormulario(form);
      if (!resultado) {
        mostrarErros(form, { resultado: "Escolha o resultado" });
        throw new Error("invalido");
      }
      try {
        aoAtualizar(await api.ocorrencias.encerrar(ocorrencia.id, resultado));
        toast("Ocorrência encerrada.", "success");
      } catch (erro) {
        tratarErro(form, erro);
      }
    },
  });
}
