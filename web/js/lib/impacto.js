// Indicadores de impacto prometidos na documentação do projeto. Função pura: recebe as ocorrências
// detalhadas (com paciente e equipamentos) e os pontos, devolve os números do painel.
import { bairroMaisProximo } from "./bairros.js";
import { aparelhoCritico, minutosRestantes, tempoAtendimentoMin, TIPOS_APARELHO } from "./regras.js";

export const FAIXAS_ESPERA = [
  { rotulo: "até 15 min", ate: 15 },
  { rotulo: "15 a 30", ate: 30 },
  { rotulo: "30 a 60", ate: 60 },
  { rotulo: "1 a 2 h", ate: 120 },
  { rotulo: "mais de 2 h", ate: Infinity },
];

const media = (valores) => (valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : null);

/**
 * Atendida a tempo: o primeiro atendimento chegou com bateria sobrando, ou o aparelho crítico
 * (sem bateria) tinha fonte reserva em casa.
 */
export function atendidaATempo(ocorrencia) {
  const primeiro = ocorrencia.atendimentos?.[0];
  if (!primeiro) return false;
  const critico = aparelhoCritico(ocorrencia.equipamentos);
  if (critico?.autonomiaMin === 0) return critico.fonteReserva !== "NENHUMA";
  return minutosRestantes(ocorrencia, ocorrencia.equipamentos, new Date(primeiro.em)) > 0;
}

function contarPor(itens, chave) {
  const contagem = new Map();
  for (const item of itens) {
    const k = chave(item);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  return [...contagem.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));
}

export function calcularImpacto(ocorrencias, pontos) {
  const encerradas = ocorrencias.filter((o) => o.status === "ENCERRADA");
  const atendidas = ocorrencias.filter((o) => o.atendimentos?.length);
  const esperas = atendidas.map(tempoAtendimentoMin).filter((t) => t !== null);
  const aTempo = atendidas.filter(atendidaATempo).length;

  const porBairro = contarPor(ocorrencias, (o) => o.paciente?.bairro ?? "Outros");
  const abertasPorBairro = new Map(contarPor(ocorrencias.filter((o) => o.status === "ABERTA"), (o) => o.paciente?.bairro ?? "Outros").map((i) => [i.rotulo, i.valor]));

  return {
    total: ocorrencias.length,
    abertas: ocorrencias.length - encerradas.length,
    encerradas: encerradas.length,
    atendidas: atendidas.length,
    tempoMedioAtendimentoMin: media(esperas),
    percentualATempo: atendidas.length ? Math.round((100 * aTempo) / atendidas.length) : null,
    distribuicaoEspera: FAIXAS_ESPERA.map((faixa, i) => ({
      rotulo: faixa.rotulo,
      valor: esperas.filter((t) => t < faixa.ate && t >= (FAIXAS_ESPERA[i - 1]?.ate ?? 0)).length,
    })),
    porBairro: porBairro.map((b) => ({ ...b, abertas: abertasPorBairro.get(b.rotulo) ?? 0 })),
    porTipoAparelho: contarPor(ocorrencias, (o) => TIPOS_APARELHO[aparelhoCritico(o.equipamentos)?.tipo] ?? "Sem aparelho"),
    pontosPorBairro: contarPor(pontos.filter((p) => p.ativo), (p) => bairroMaisProximo(p)),
  };
}
