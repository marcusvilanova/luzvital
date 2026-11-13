// Simulador de apagão em massa (só no modo demonstração): cria pacientes, ocorrências abertas e um
// histórico de ocorrências encerradas na Zona Sul, para mostrar a fila e o painel de impacto sob carga.
import { BAIRROS } from "../lib/bairros.js";
import { novoId } from "../lib/dom.js";
import { db, substituirBanco } from "./mock-db.js";

const CUIDADOR_SIMULADO = {
  id: "u-sim", nome: "Cuidadores simulados", email: "simulado@teste.com", telefone: "11900000000",
  papel: "CUIDADOR", senhaHash: "-", termoVersao: "1.0", termoAceitoEm: new Date(0).toISOString(), simulado: true,
};

const NOMES = ["Sr. Carlos", "Dona Iracema", "Sr. Benedito", "Dona Cida", "Sr. Raimundo", "Dona Neusa", "Sr. Osvaldo",
  "Dona Terezinha", "Sr. Valdir", "Dona Aparecida", "Sr. Geraldo", "Dona Zuleide", "Sr. Joaquim", "Dona Lurdes",
  "Sr. Severino", "Dona Marlene", "Sr. Antenor", "Dona Rosa", "Sr. Edson", "Dona Fátima"];

// Combinações reais de aparelhos de casa (autonomia em minutos).
const KITS = [
  [{ tipo: "VENTILADOR", modelo: "Trilogy Evo", potenciaW: 170, autonomiaMin: 900, suporteVida: true, fonteReserva: "NENHUMA" }],
  [{ tipo: "CONCENTRADOR", modelo: "EverFlo", potenciaW: 320, autonomiaMin: 0, suporteVida: true, fonteReserva: "CILINDRO_OXIGENIO" }],
  [{ tipo: "CONCENTRADOR", modelo: "OX-5 Home", potenciaW: 390, autonomiaMin: 120, suporteVida: true, fonteReserva: "BATERIA_EXTERNA" }],
  [{ tipo: "BOMBA_INFUSAO", modelo: "BI-20", potenciaW: 30, autonomiaMin: 240, suporteVida: true, fonteReserva: "NENHUMA" }],
  [{ tipo: "VENTILADOR", modelo: "Astral 150", potenciaW: 90, autonomiaMin: 480, suporteVida: true, fonteReserva: "NENHUMA" },
    { tipo: "ASPIRADOR", modelo: "AS-300", potenciaW: 90, autonomiaMin: 60, suporteVida: false, fonteReserva: "NENHUMA" }],
  [{ tipo: "DIALISE", modelo: "HD Casa 4", potenciaW: 1500, autonomiaMin: 30, suporteVida: true, fonteReserva: "NENHUMA" }],
  [{ tipo: "CONCENTRADOR", modelo: "EverFlo", potenciaW: 320, autonomiaMin: 0, suporteVida: true, fonteReserva: "NENHUMA" },
    { tipo: "VENTILADOR", modelo: "Trilogy Evo", potenciaW: 170, autonomiaMin: 600, suporteVida: true, fonteReserva: "NENHUMA" }],
];

const PONTOS_EXTRAS = [
  ["Escola Teste Cidade Dutra", "Cidade Dutra", "GERADOR", 4000],
  ["CEU Teste Pedreira", "Pedreira", "GERADOR", 6000],
  ["Condomínio Teste Socorro", "Socorro", "BATERIA", 1500],
  ["Paróquia Teste Cidade Ademar", "Cidade Ademar", "TOMADA", 2000],
  ["Mercado Teste Jabaquara", "Jabaquara", "GERADOR", 5000],
  ["Associação Teste Jardim São Luís", "Jardim São Luís", "GERADOR", 3000],
];

const ACOES = ["GERADOR", "RECARGA", "REMOCAO", "RELIGACAO", "CONTATO"];
const RESULTADOS = ["LUZ_VOLTOU", "ATENDIDO", "ATENDIDO", "REMOVIDO"];

function aleatorio(semente) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const minutosAtras = (min) => new Date(Date.now() - min * 60000).toISOString();

function criarPaciente(rand, indice) {
  const bairros = Object.keys(BAIRROS);
  const bairro = bairros[Math.floor(rand() * bairros.length)];
  const centro = BAIRROS[bairro];
  const id = `sim-p-${novoId()}`;
  const paciente = {
    id, cuidadorId: CUIDADOR_SIMULADO.id, nome: `${NOMES[indice % NOMES.length]} (simulado)`, cep: "04800000",
    numero: String(10 + Math.floor(rand() * 900)), bairro, contatoEmergencia: "11900000000", simulado: true,
    lat: centro.lat + (rand() - 0.5) * 0.02, lng: centro.lng + (rand() - 0.5) * 0.02,
  };
  const kit = KITS[Math.floor(rand() * KITS.length)];
  const equipamentos = kit.map((e) => ({
    id: `sim-e-${novoId()}`, pacienteId: id, fabricante: null, tensaoV: null, correnteA: null, potenciaEstimada: false, ...e,
  }));
  return { paciente, equipamentos };
}

function evento(tipo, minutos, texto, por) {
  return { tipo, em: minutosAtras(minutos), texto, por };
}

function ocorrenciaAberta(rand, paciente) {
  const abertaHa = Math.floor(rand() * 90);
  const eventos = [evento("ABERTURA", abertaHa, "Ocorrência aberta pelo cuidador", "Cuidador simulado")];
  const atendida = rand() < 0.3 && abertaHa > 15;
  const atendimentos = atendida
    ? [{ acao: ACOES[Math.floor(rand() * ACOES.length)], observacao: "Equipe a caminho", em: minutosAtras(abertaHa - 10), por: "Equipe Defesa Civil Sul" }]
    : [];
  if (atendida) eventos.push(evento("ATENDIMENTO", abertaHa - 10, "Atendimento iniciado: equipe a caminho", "Equipe Defesa Civil Sul"));
  return {
    id: `sim-o-${novoId()}`, pacienteId: paciente.id, cuidadorId: CUIDADOR_SIMULADO.id, status: "ABERTA", abertaEm: minutosAtras(abertaHa),
    bateriaInformadaMin: null, bateriaAtualizadaEm: null, encerradaEm: null, resultado: null, encerradaPor: null,
    pontosAcionados: [], atendimentos, eventos, simulado: true,
  };
}

function ocorrenciaEncerrada(rand, paciente) {
  const abertaHa = 60 * (6 + Math.floor(rand() * 160)); // últimos 7 dias
  const espera = 8 + Math.floor(rand() * 150);
  const duracao = espera + 20 + Math.floor(rand() * 240);
  const acao = ACOES[Math.floor(rand() * ACOES.length)];
  const resultado = RESULTADOS[Math.floor(rand() * RESULTADOS.length)];
  return {
    id: `sim-o-${novoId()}`, pacienteId: paciente.id, cuidadorId: CUIDADOR_SIMULADO.id, status: "ENCERRADA",
    abertaEm: minutosAtras(abertaHa), bateriaInformadaMin: null, bateriaAtualizadaEm: null,
    encerradaEm: minutosAtras(abertaHa - duracao), resultado, encerradaPor: "Equipe Defesa Civil Sul", pontosAcionados: [],
    atendimentos: [{ acao, observacao: "", em: minutosAtras(abertaHa - espera), por: "Equipe Defesa Civil Sul" }],
    eventos: [evento("ABERTURA", abertaHa, "Ocorrência aberta pelo cuidador", "Cuidador simulado")],
    simulado: true,
  };
}

function semSimulacao(base) {
  const fora = (lista) => lista.filter((item) => !item.simulado);
  return { ...base, usuarios: fora(base.usuarios), pacientes: fora(base.pacientes), equipamentos: base.equipamentos.filter((e) => !String(e.id).startsWith("sim-")),
    ocorrencias: fora(base.ocorrencias), pontos: fora(base.pontos) };
}

/** Cria `abertas` ocorrências em andamento e `historico` encerradas. Substitui uma simulação anterior. */
export async function simularApagao({ abertas = 30, historico = 40 } = {}) {
  const rand = aleatorio(Date.now() % 100000);
  const base = semSimulacao(await db());
  const pacientes = [];
  const equipamentos = [];
  const ocorrencias = [];
  for (let i = 0; i < abertas + historico; i += 1) {
    const criado = criarPaciente(rand, i);
    pacientes.push(criado.paciente);
    equipamentos.push(...criado.equipamentos);
    ocorrencias.push(i < abertas ? ocorrenciaAberta(rand, criado.paciente) : ocorrenciaEncerrada(rand, criado.paciente));
  }
  const pontos = PONTOS_EXTRAS.map(([nome, bairro, tipoFonte, capacidadeW]) => ({
    id: `sim-pt-${novoId()}`, nome, tipoFonte, capacidadeW, telefone: "1130000000", endereco: `Endereço fictício - ${bairro}`,
    ...BAIRROS[bairro], ativo: true, simulado: true,
  }));
  substituirBanco({
    ...base,
    usuarios: [...base.usuarios, CUIDADOR_SIMULADO],
    pacientes: [...base.pacientes, ...pacientes],
    equipamentos: [...base.equipamentos, ...equipamentos],
    ocorrencias: [...base.ocorrencias, ...ocorrencias],
    pontos: [...base.pontos, ...pontos],
  });
  return { abertas, historico };
}

export async function limparSimulacao() {
  substituirBanco(semSimulacao(await db()));
}

export async function temSimulacao() {
  return (await db()).ocorrencias.some((o) => o.simulado);
}
