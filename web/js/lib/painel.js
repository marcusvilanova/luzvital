// Dados do painel inicial do gestor. Funções puras: recebem ocorrências detalhadas e pontos.
import { bairroMaisProximo } from "./bairros.js";

const HORA_MS = 60 * 60 * 1000;

/** Últimos eventos de todas as ocorrências (abertura, bateria, atendimento, encerramento), do mais novo ao mais antigo. */
export function atividadeRecente(ocorrencias, limite = 6) {
  return ocorrencias
    .flatMap((o) => (o.eventos ?? []).map((e) => ({ ...e, ocorrenciaId: o.id, paciente: o.paciente?.nome, bairro: o.paciente?.bairro })))
    .sort((a, b) => new Date(b.em) - new Date(a.em))
    .slice(0, limite);
}

/** Aberturas por hora nas últimas 24 h: 24 posições, da mais antiga (índice 0) à hora atual (índice 23). */
export function aberturasPorHora(ocorrencias, agora = new Date()) {
  const fim = agora.getTime();
  const contagem = Array.from({ length: 24 }, (_, i) => ({ inicio: new Date(fim - (24 - i) * HORA_MS), valor: 0 }));
  for (const o of ocorrencias) {
    const idade = fim - new Date(o.abertaEm).getTime();
    if (idade < 0 || idade >= 24 * HORA_MS) continue;
    contagem[23 - Math.floor(idade / HORA_MS)].valor += 1;
  }
  return contagem.map((c) => ({ hora: c.inicio.toISOString(), valor: c.valor }));
}

/**
 * Cobertura por bairro: ocorrências abertas x pontos de energia ativos.
 * Bairro com casa sem luz e nenhum ponto ativo é um vazio de cobertura.
 */
export function coberturaPorBairro(ocorrencias, pontos) {
  const mapa = new Map();
  const linha = (bairro) => {
    if (!mapa.has(bairro)) mapa.set(bairro, { bairro, abertas: 0, criticas: 0, pontos: 0 });
    return mapa.get(bairro);
  };
  for (const o of ocorrencias.filter((x) => x.status === "ABERTA")) {
    const l = linha(o.paciente?.bairro ?? "Outros");
    l.abertas += 1;
    if ((o.minutosRestantes ?? Infinity) < 60) l.criticas += 1;
  }
  for (const p of pontos.filter((x) => x.ativo)) linha(bairroMaisProximo(p)).pontos += 1;
  return [...mapa.values()]
    .map((l) => ({ ...l, semPonto: l.abertas > 0 && l.pontos === 0 }))
    .sort((a, b) => Number(b.semPonto) - Number(a.semPonto) || b.abertas - a.abertas || a.bairro.localeCompare(b.bairro));
}
