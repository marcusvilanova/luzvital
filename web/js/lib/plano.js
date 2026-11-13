// Plano padrão (mesma lógica do serviço de IA quando o Gemini está indisponível).
import { aparelhoCritico, TIPOS_APARELHO } from "./regras.js";

export const AVISO_PLANO =
  "O Luz Vital não substitui o 192, o 193 nem o canal da distribuidora e não dá orientação clínica. " +
  "Em caso de piora do paciente, ligue 192.";

export const CONTATOS = [
  { nome: "SAMU", numero: "192", quando: "Paciente com falta de ar, cor arroxeada ou desmaio" },
  { nome: "Bombeiros", numero: "193", quando: "Risco de incêndio, choque elétrico ou resgate" },
  { nome: "Defesa Civil", numero: "199", quando: "Apagão longo com necessidade de remoção ou abrigo" },
  { nome: "Distribuidora de energia", numero: "Telefone na conta de luz", quando: "Logo após a queda, avisando que há equipamento vital" },
];

export function planoPadrao(equipamentos) {
  const critico = aparelhoCritico(equipamentos);
  const minutos = critico?.autonomiaMin ?? 0;
  const metade = Math.max(Math.floor(minutos / 2), 30);
  return {
    resumo: minutos === 0
      ? "O aparelho mais crítico não tem bateria: ligue a fonte reserva agora e peça ajuda."
      : `Você tem cerca de ${minutos} minutos até o aparelho mais crítico parar. Aja já.`,
    etapas: [
      { faixa: minutos === 0 ? "Imediatamente" : "0 a 15 min", acoes: [
        "Confira se o aparelho passou para a bateria interna.",
        "Toque em 'Estou sem luz' no app.",
        "Ligue para a distribuidora e diga que há equipamento vital na casa.",
      ] },
      { faixa: `15 a ${metade} min`, acoes: [
        "Ligue a fonte reserva (cilindro, bateria externa ou gerador), se houver.",
        "Veja no app o ponto de energia mais próximo.",
      ] },
      { faixa: `${metade} min até o fim da bateria`, acoes: [
        "Se a luz não voltou, prepare a ida ao ponto de energia ou a remoção.",
        "Mantenha o celular carregado e o app aberto para receber o atendimento.",
      ] },
    ],
    quandoPedirAjuda: [
      "Se faltar menos de 60 minutos de bateria e a luz não voltou.",
      "Se o aparelho não tem bateria e não há fonte reserva.",
    ],
    sinaisAlerta: ["Falta de ar", "Lábios ou unhas arroxeados", "Confusão ou sonolência fora do comum"],
    minutosCriticos: minutos,
    aparelhoCritico: critico ? TIPOS_APARELHO[critico.tipo] : "—",
    contatos: CONTATOS,
    aviso: AVISO_PLANO,
    origem: "modelo_padrao",
  };
}
