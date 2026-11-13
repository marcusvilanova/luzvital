// Banco de dados de demonstração no localStorage. Só pacientes fictícios (LGPD).
import { BAIRROS, CENTRO_SP, coordenadasDe } from "../lib/bairros.js";
import { avisarMudanca } from "./eventos.js";

const CHAVE = "lv.db.v1";

export async function hashSenha(senha) {
  const bytes = new TextEncoder().encode(`luzvital:${senha}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sem geocodificação real no mock: usa o bairro conhecido ou um ponto próximo ao centro. */
export function coordenadasDoBairro(bairro, cep) {
  const conhecido = coordenadasDe(bairro);
  if (conhecido) return conhecido;
  const semente = Number(String(cep ?? "0").replace(/\D/g, "").slice(-4)) || 0;
  return { lat: CENTRO_SP.lat - (semente % 100) / 1000, lng: CENTRO_SP.lng - (semente % 77) / 1000 };
}

const minutosAtras = (min) => new Date(Date.now() - min * 60000).toISOString();

async function semente() {
  const senhaCuidador = await hashSenha("Luz2026ok");
  const senhaGestor = await hashSenha("Gestor2026ok");
  const termo = { termoVersao: "1.0", termoAceitoEm: minutosAtras(60 * 24 * 7) };
  return {
    usuarios: [
      { id: "u1", nome: "Ana Teste", email: "cuidador.ana@teste.com", telefone: "11987654321", papel: "CUIDADOR", senhaHash: senhaCuidador, ...termo },
      { id: "u2", nome: "Bruno Teste", email: "cuidador.bruno@teste.com", telefone: "11976543210", papel: "CUIDADOR", senhaHash: senhaCuidador, ...termo },
      { id: "u3", nome: "Equipe Defesa Civil Sul", email: "gestor.defesa@teste.com", telefone: "1131112222", papel: "GESTOR", senhaHash: senhaGestor, ...termo },
    ],
    pacientes: [
      { id: "p1", cuidadorId: "u1", nome: "Seu José Teste", cep: "05860000", numero: "120", bairro: "Capão Redondo", contatoEmergencia: "11912345678", ...BAIRROS["Capão Redondo"] },
      { id: "p2", cuidadorId: "u1", nome: "Dona Maria Teste", cep: "04941000", numero: "45", bairro: "Jardim Ângela", contatoEmergencia: "11923456789", ...BAIRROS["Jardim Ângela"] },
      { id: "p3", cuidadorId: "u2", nome: "Sr. Antônio Teste", cep: "04843000", numero: "300", bairro: "Grajaú", contatoEmergencia: "11934567890", ...BAIRROS["Grajaú"] },
      { id: "p4", cuidadorId: "u2", nome: "Dona Lúcia Teste", cep: "04890000", numero: "18", bairro: "Parelheiros", contatoEmergencia: "11945678901", ...BAIRROS["Parelheiros"] },
    ],
    equipamentos: [
      { id: "e1", pacienteId: "p1", tipo: "CONCENTRADOR", fabricante: "PHILIPS RESPIRONICS", modelo: "EverFlo", tensaoV: 220, correnteA: 1.5, potenciaW: 320, potenciaEstimada: false, autonomiaMin: 0, suporteVida: true, fonteReserva: "CILINDRO_OXIGENIO" },
      { id: "e2", pacienteId: "p1", tipo: "VENTILADOR", fabricante: "PHILIPS", modelo: "Trilogy Evo", tensaoV: 100, correnteA: 1.7, potenciaW: 170, potenciaEstimada: true, autonomiaMin: 900, suporteVida: true, fonteReserva: "NENHUMA" },
      { id: "e3", pacienteId: "p2", tipo: "BOMBA_INFUSAO", fabricante: "INFUSA", modelo: "BI-20", tensaoV: 100, correnteA: 0.3, potenciaW: 30, potenciaEstimada: true, autonomiaMin: 240, suporteVida: true, fonteReserva: "NENHUMA" },
      { id: "e4", pacienteId: "p3", tipo: "VENTILADOR", fabricante: "PHILIPS", modelo: "Trilogy Evo", tensaoV: 100, correnteA: 1.7, potenciaW: 170, potenciaEstimada: true, autonomiaMin: 900, suporteVida: true, fonteReserva: "NENHUMA" },
      { id: "e5", pacienteId: "p3", tipo: "ASPIRADOR", fabricante: "ASPIRAMED", modelo: "AS-300", tensaoV: 220, correnteA: 0.5, potenciaW: 90, potenciaEstimada: false, autonomiaMin: 60, suporteVida: false, fonteReserva: "NENHUMA" },
      { id: "e6", pacienteId: "p4", tipo: "CONCENTRADOR", fabricante: "OXIVIDA", modelo: "OX-5 Home", tensaoV: 127, correnteA: 3.1, potenciaW: 390, potenciaEstimada: false, autonomiaMin: 120, suporteVida: true, fonteReserva: "BATERIA_EXTERNA" },
    ],
    pontos: [
      { id: "pt1", nome: "Condomínio Teste Primavera", tipoFonte: "GERADOR", capacidadeW: 3000, telefone: "1133334444", endereco: "R. Exemplo, 100 - Capão Redondo", lat: -23.668, lng: -46.776, ativo: true },
      { id: "pt2", nome: "Mercado Teste Bom Preço", tipoFonte: "GERADOR", capacidadeW: 5000, telefone: "1133335555", endereco: "Av. Exemplo, 900 - Campo Limpo", lat: -23.648, lng: -46.763, ativo: true },
      { id: "pt3", nome: "UBS Teste Grajaú", tipoFonte: "BATERIA", capacidadeW: 1500, telefone: "1133336666", endereco: "R. Teste, 50 - Grajaú", lat: -23.756, lng: -46.69, ativo: true },
      { id: "pt4", nome: "Igreja Teste Esperança", tipoFonte: "TOMADA", capacidadeW: 2000, telefone: "1133337777", endereco: "R. Modelo, 12 - Jardim Ângela", lat: -23.706, lng: -46.766, ativo: true },
      { id: "pt5", nome: "Padaria Teste Pão Quente", tipoFonte: "GERADOR", capacidadeW: 2500, telefone: "1133338888", endereco: "R. Fictícia, 7 - Capão Redondo", lat: -23.662, lng: -46.781, ativo: false },
    ],
    ocorrencias: [
      { id: "o1", pacienteId: "p3", cuidadorId: "u2", status: "ABERTA", abertaEm: minutosAtras(50), bateriaInformadaMin: null, bateriaAtualizadaEm: null,
        encerradaEm: null, resultado: null, encerradaPor: null, pontosAcionados: [], atendimentos: [],
        eventos: [{ tipo: "ABERTURA", em: minutosAtras(50), texto: "Ocorrência aberta pelo cuidador", por: "Bruno Teste" }] },
      { id: "o2", pacienteId: "p4", cuidadorId: "u2", status: "ABERTA", abertaEm: minutosAtras(25), bateriaInformadaMin: 70, bateriaAtualizadaEm: minutosAtras(5),
        encerradaEm: null, resultado: null, encerradaPor: null, pontosAcionados: [], atendimentos: [],
        eventos: [
          { tipo: "ABERTURA", em: minutosAtras(25), texto: "Ocorrência aberta pelo cuidador", por: "Bruno Teste" },
          { tipo: "BATERIA", em: minutosAtras(5), texto: "Bateria informada: 70 min", por: "Bruno Teste" },
        ] },
      { id: "o3", pacienteId: "p2", cuidadorId: "u1", status: "ENCERRADA", abertaEm: minutosAtras(60 * 26), bateriaInformadaMin: null, bateriaAtualizadaEm: null,
        encerradaEm: minutosAtras(60 * 24), resultado: "ATENDIDO", encerradaPor: "Equipe Defesa Civil Sul", pontosAcionados: ["pt4"],
        atendimentos: [{ acao: "RECARGA", observacao: "Bateria recarregada no ponto da igreja", em: minutosAtras(60 * 25 + 25), por: "Equipe Defesa Civil Sul" }],
        eventos: [
          { tipo: "ABERTURA", em: minutosAtras(60 * 26), texto: "Ocorrência aberta pelo cuidador", por: "Ana Teste" },
          { tipo: "ATENDIMENTO", em: minutosAtras(60 * 25 + 25), texto: "Recarga de bateria: Bateria recarregada no ponto da igreja", por: "Equipe Defesa Civil Sul" },
          { tipo: "ENCERRAMENTO", em: minutosAtras(60 * 24), texto: "Encerrada: Atendido", por: "Equipe Defesa Civil Sul" },
        ] },
    ],
    idempotencia: {},
    auditoria: [],
  };
}

let cache = null;

export async function db() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CHAVE));
  } catch {
    cache = null;
  }
  if (!cache) {
    cache = await semente();
    salvar();
  }
  return cache;
}

export function salvar() {
  localStorage.setItem(CHAVE, JSON.stringify(cache));
}

export async function restaurarDemonstracao() {
  cache = await semente();
  salvar();
}

/** Troca o banco inteiro (usado pelo simulador de apagão). */
export function substituirBanco(novo) {
  cache = novo;
  salvar();
}

// Outra janela gravou: descarta o cache e avisa as telas abertas para recarregar.
window.addEventListener("storage", (evento) => {
  if (evento.key !== CHAVE) return;
  cache = null;
  avisarMudanca();
});
