// Cliente HTTP para o backend real (MODO "api"). Envia o JWT e trata erros num formato único.
import { ApiError, SemConexao } from "./erros.js";
import { sessao } from "./sessao.js";

const MENSAGENS = {
  400: "Confira os dados informados.",
  401: "Sessão expirada. Entre de novo.",
  403: "Acesso negado.",
  404: "Não encontrado.",
  409: "Conflito com o estado atual.",
  429: "Muitas tentativas. Aguarde alguns segundos.",
};

async function lerCorpo(resposta) {
  const tipo = resposta.headers.get("content-type") ?? "";
  if (resposta.status === 204) return null;
  return tipo.includes("json") ? resposta.json() : resposta.text();
}

/**
 * @param {string} base URL da API (Java ou .NET)
 * @param {string} caminho ex.: "/pacientes"
 * @param {{metodo?: string, corpo?: unknown, formulario?: FormData, chaveIdempotencia?: string}} opcoes
 */
export async function requisicao(base, caminho, { metodo = "GET", corpo, formulario, chaveIdempotencia } = {}) {
  const cabecalhos = { Accept: "application/json" };
  const token = sessao.atual()?.token;
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (chaveIdempotencia) cabecalhos["Idempotency-Key"] = chaveIdempotencia;
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";

  let resposta;
  try {
    resposta = await fetch(base + caminho, {
      method: metodo,
      headers: cabecalhos,
      body: formulario ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined),
    });
  } catch {
    throw new SemConexao();
  }

  const dados = await lerCorpo(resposta);
  if (resposta.ok) return dados;

  if (resposta.status === 401 && token) sessao.limpar();
  // Aceita os formatos do @RestControllerAdvice (Java) e do ProblemDetails (.NET).
  const mensagem = dados?.mensagem ?? dados?.message ?? dados?.detail ?? dados?.title ?? MENSAGENS[resposta.status];
  const campos = dados?.campos ?? dados?.errors ?? {};
  throw new ApiError(resposta.status, mensagem ?? "Erro inesperado.", {
    campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
    retryAfter: Number(resposta.headers.get("Retry-After")) || null,
  });
}
