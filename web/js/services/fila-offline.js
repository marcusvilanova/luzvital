// Pedido "Estou sem luz" feito sem sinal: fica no aparelho e é reenviado com a MESMA
// Idempotency-Key quando a conexão volta, para nunca criar ocorrência em dobro.
import { novoId } from "../lib/dom.js";
import { api } from "./api.js";
import { SemConexao } from "./erros.js";

const CHAVE = "lv.fila-offline";

function ler() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) ?? [];
  } catch {
    return [];
  }
}

function gravar(itens) {
  localStorage.setItem(CHAVE, JSON.stringify(itens));
}

export const filaOffline = {
  pendentes: ler,
  pendenteDoPaciente: (pacienteId) => ler().find((p) => p.pacienteId === pacienteId) ?? null,

  /** Chave estável por paciente enquanto o pedido não for confirmado (toques repetidos reusam a chave). */
  chavePara(pacienteId) {
    return this.pendenteDoPaciente(pacienteId)?.chave ?? novoId();
  },

  guardar(pacienteId, chave) {
    if (this.pendenteDoPaciente(pacienteId)) return;
    gravar([...ler(), { pacienteId, chave, criadoEm: new Date().toISOString() }]);
  },

  remover(pacienteId) {
    gravar(ler().filter((p) => p.pacienteId !== pacienteId));
  },

  /** Reenvia os pendentes; devolve as ocorrências abertas com sucesso. */
  async reenviar() {
    const abertas = [];
    for (const pedido of ler()) {
      try {
        abertas.push(await api.ocorrencias.abrir(pedido.pacienteId, pedido.chave));
        this.remover(pedido.pacienteId);
      } catch (erro) {
        if (erro instanceof SemConexao) break;
        this.remover(pedido.pacienteId); // erro de negócio (ex.: 409): não adianta repetir
      }
    }
    return abertas;
  },
};
