// Regras de negócio puras (sem DOM): as mesmas que o backend aplica. Testadas em tests/regras.test.mjs.

export const TIPOS_APARELHO = {
  VENTILADOR: "Ventilador mecânico",
  CONCENTRADOR: "Concentrador de oxigênio",
  BOMBA_INFUSAO: "Bomba de infusão",
  ASPIRADOR: "Aspirador de secreção",
  DIALISE: "Diálise domiciliar",
  CADEIRA_RODAS: "Cadeira de rodas elétrica",
  OUTRO: "Outro aparelho",
};

export const FONTES_RESERVA = {
  NENHUMA: "Nenhuma",
  CILINDRO_OXIGENIO: "Cilindro de oxigênio",
  BATERIA_EXTERNA: "Bateria externa",
  GERADOR: "Gerador",
  OUTRA: "Outra",
};

export const TIPOS_FONTE_PONTO = { GERADOR: "Gerador", BATERIA: "Estação de bateria", TOMADA: "Tomada na rede" };

export const RESULTADOS = { LUZ_VOLTOU: "Luz voltou", ATENDIDO: "Atendido", REMOVIDO: "Paciente removido" };

export const ACOES_ATENDIMENTO = {
  GERADOR: "Gerador enviado",
  RECARGA: "Recarga de bateria",
  REMOCAO: "Remoção do paciente",
  RELIGACAO: "Religação prioritária",
  CONTATO: "Contato com a família",
};

// Desempate da fila: ventilador antes de concentrador, depois os demais (hipótese a validar com saúde).
const ORDEM_DESEMPATE = { VENTILADOR: 0, CONCENTRADOR: 1 };

export const RAIO_PONTOS_KM = 5;
export const MINUTOS_ALERTA = 60;

const minutosEntre = (inicio, fim) => Math.max(0, Math.floor((new Date(fim) - new Date(inicio)) / 60000));

/** Aparelho de suporte à vida com menor autonomia (ou o de menor autonomia, se nenhum for de suporte). */
export function aparelhoCritico(equipamentos) {
  if (!equipamentos?.length) return null;
  const candidatos = equipamentos.filter((e) => e.suporteVida);
  const base = candidatos.length ? candidatos : equipamentos;
  return base.reduce((menor, e) => (e.autonomiaMin < menor.autonomiaMin ? e : menor));
}

/**
 * Minutos de bateria restantes numa ocorrência.
 * Usa a bateria informada pelo cuidador (descontado o tempo desde a informação) ou, sem ela,
 * a autonomia do aparelho crítico descontado o tempo desde a abertura.
 */
export function minutosRestantes(ocorrencia, equipamentos, agora = new Date()) {
  if (ocorrencia.bateriaInformadaMin !== null && ocorrencia.bateriaInformadaMin !== undefined) {
    return Math.max(0, ocorrencia.bateriaInformadaMin - minutosEntre(ocorrencia.bateriaAtualizadaEm, agora));
  }
  const critico = aparelhoCritico(equipamentos);
  if (!critico) return 0;
  return Math.max(0, critico.autonomiaMin - minutosEntre(ocorrencia.abertaEm, agora));
}

/** Fila do gestor: menos minutos primeiro; empate pelo tipo do aparelho; depois quem abriu antes. */
export function ordenarFila(itens) {
  const rank = (tipo) => ORDEM_DESEMPATE[tipo] ?? 2;
  return [...itens].sort(
    (a, b) =>
      a.minutosRestantes - b.minutosRestantes ||
      rank(a.tipoCritico) - rank(b.tipoCritico) ||
      new Date(a.abertaEm) - new Date(b.abertaEm),
  );
}

export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function pontosProximos(origem, pontos, raioKm = RAIO_PONTOS_KM) {
  return pontos
    .filter((p) => p.ativo)
    .map((p) => ({ ...p, distanciaKm: distanciaKm(origem, p) }))
    .filter((p) => p.distanciaKm <= raioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export function tempoAtendimentoMin(ocorrencia) {
  const primeiro = ocorrencia.atendimentos?.[0];
  return primeiro ? minutosEntre(ocorrencia.abertaEm, primeiro.em) : null;
}

// ---------- Validações (mesmas mensagens dos critérios de aceite) ----------

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

export const validar = {
  nome: (v) => (!v ? "Informe o nome" : v.length < 2 || v.length > 80 ? "Use de 2 a 80 caracteres" : null),
  email: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v ?? "") ? "E-mail inválido" : null),
  senha: (v) =>
    !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v ?? "") ? "A senha precisa de 8 caracteres, com letra e número" : null,
  telefone: (v) => (![10, 11].includes(soDigitos(v).length) ? "Telefone inválido" : null),
  cep: (v) => (soDigitos(v).length !== 8 ? "CEP inválido" : null),
  obrigatorio: (rotulo) => (v) => (v === "" || v === null || v === undefined ? `Informe ${rotulo}` : null),
  potencia: (v) => (!(Number(v) > 0) ? "Potência deve ser maior que zero" : null),
  autonomia: (v) =>
    v === "" || !Number.isInteger(Number(v)) ? "Informe a autonomia em minutos"
      : Number(v) < 0 ? "Autonomia não pode ser negativa" : null,
  capacidade: (v) => (!(Number(v) > 0) ? "Capacidade deve ser maior que zero" : null),
  latitude: (v) => (v === "" || !(Math.abs(Number(v)) <= 90) ? "Localização inválida" : null),
  longitude: (v) => (v === "" || !(Math.abs(Number(v)) <= 180) ? "Localização inválida" : null),
};

/** Aplica um mapa {campo: [validadores]} e devolve {campo: mensagem} só com os erros. */
export function validarCampos(dados, regras) {
  const erros = {};
  for (const [campo, validadores] of Object.entries(regras)) {
    for (const v of validadores) {
      const erro = v(dados[campo]);
      if (erro) { erros[campo] = erro; break; }
    }
  }
  return erros;
}

export { soDigitos };
