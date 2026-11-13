// Ação "Estou sem luz": abre a ocorrência com Idempotency-Key estável e guarda o pedido se não houver sinal.
// Usada no detalhe do paciente e no painel inicial do cuidador.
import { api } from "../services/api.js";
import { ApiError, mensagemDeErro, SemConexao } from "../services/erros.js";
import { filaOffline } from "../services/fila-offline.js";
import { toast } from "./toast.js";

export const TEXTO_PENDENTE = "Pedido guardado: será enviado quando o sinal voltar";

export async function abrirOcorrencia(pacienteId, botao, navegar) {
  botao.disabled = true; // trava o duplo toque; a Idempotency-Key cobre o reenvio
  const chave = filaOffline.chavePara(pacienteId);
  try {
    const ocorrencia = await api.ocorrencias.abrir(pacienteId, chave);
    filaOffline.remover(pacienteId);
    toast("Ocorrência aberta. A equipe já vê sua contagem.", "success");
    navegar(`/ocorrencias/${ocorrencia.id}`);
  } catch (erro) {
    if (erro instanceof SemConexao) {
      filaOffline.guardar(pacienteId, chave);
      toast("Sem sinal. Seu pedido será enviado assim que a conexão voltar.", "info");
      const legenda = botao.querySelector("small");
      if (legenda) legenda.textContent = TEXTO_PENDENTE;
      botao.disabled = false;
      return;
    }
    if (erro instanceof ApiError && erro.status === 409 && erro.ocorrenciaId) {
      navegar(`/ocorrencias/${erro.ocorrenciaId}`);
      return;
    }
    toast(mensagemDeErro(erro), "error");
    botao.disabled = false;
  }
}
