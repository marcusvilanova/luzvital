// Prontidão do paciente para um apagão: checklist acionável, cada item com o caminho para resolver.
import { aparelhoCritico } from "./regras.js";

/**
 * @param {object} paciente com `id`
 * @param {object[]} equipamentos do paciente
 * @param {{planoSalvo: boolean, pontosProximos: number}} contexto
 */
export function prontidao(paciente, equipamentos, { planoSalvo, pontosProximos }) {
  const critico = aparelhoCritico(equipamentos);
  const temSuporte = equipamentos.some((e) => e.suporteVida);
  const reservaOk = Boolean(critico) && (critico.fonteReserva !== "NENHUMA" || critico.autonomiaMin >= 240);
  const itens = [
    {
      id: "aparelho", ok: temSuporte,
      texto: temSuporte ? "Aparelho de suporte à vida cadastrado" : "Cadastre o aparelho de suporte à vida",
      acao: `#/pacientes/${paciente.id}/aparelhos/novo`, rotuloAcao: "Cadastrar", pendencia: "cadastrar o aparelho de suporte à vida",
    },
    {
      id: "reserva", ok: reservaOk,
      texto: reservaOk ? "Fonte reserva ou bateria para mais de 4 h" : "Sem fonte reserva para o aparelho mais crítico",
      acao: critico ? `#/aparelhos/${critico.id}/editar` : `#/pacientes/${paciente.id}`, rotuloAcao: "Informar reserva", pendencia: "definir uma fonte reserva",
    },
    {
      id: "plano", ok: planoSalvo,
      texto: planoSalvo ? "Plano de contingência salvo no celular" : "Plano de contingência ainda não salvo",
      acao: `#/pacientes/${paciente.id}/plano`, rotuloAcao: "Abrir plano", pendencia: "salvar o plano de contingência",
    },
    {
      id: "ponto", ok: pontosProximos > 0,
      texto: pontosProximos > 0 ? `${pontosProximos} ${pontosProximos === 1 ? "ponto" : "pontos"} de energia a até 5 km` : "Nenhum ponto de energia a até 5 km",
      acao: `#/pontos?paciente=${paciente.id}`, rotuloAcao: "Ver pontos", pendencia: "achar um ponto de energia",
    },
  ];
  const feitos = itens.filter((i) => i.ok).length;
  return { itens, feitos, total: itens.length, percentual: Math.round((100 * feitos) / itens.length), critico };
}

/**
 * Resume as pendências de vários pacientes numa frase: "Falta salvar o plano de contingência de A e B."
 * Ignora "ponto de energia", que não depende do cuidador.
 */
export function resumoPendencias(lista) {
  const grupos = new Map();
  for (const { nome, pront } of lista) {
    for (const item of pront.itens.filter((i) => !i.ok && i.id !== "ponto")) {
      grupos.set(item.pendencia, [...(grupos.get(item.pendencia) ?? []), nome]);
    }
  }
  if (!grupos.size) return null;
  const juntar = (nomes) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes[0]);
  const partes = [...grupos.entries()].map(([pendencia, nomes]) => `${pendencia} de ${juntar(nomes)}`);
  return `Falta ${partes.join("; ")}.`;
}

/** Saudação pela hora local. */
export function saudacao(agora = new Date()) {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
