/** Erro padronizado da API: status HTTP, mensagem para o usuário e erros por campo. */
export class ApiError extends Error {
  constructor(status, mensagem, { campos = {}, retryAfter = null } = {}) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.campos = campos;
    this.retryAfter = retryAfter;
  }
}

/** Sem conexão: o app trata à parte (fila local do pedido de ocorrência). */
export class SemConexao extends Error {
  constructor() {
    super("Sem conexão com a internet");
    this.name = "SemConexao";
  }
}

export function mensagemDeErro(erro) {
  if (erro instanceof ApiError || erro instanceof SemConexao) return erro.message;
  return "Algo deu errado. Tente de novo em instantes.";
}
