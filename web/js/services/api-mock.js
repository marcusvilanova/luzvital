// Backend simulado no navegador: mesmas assinaturas do api-http.js e as mesmas regras do backend
// (papéis, dono do paciente, validação, 409, idempotência, 429). Serve para demo e testes manuais.
import { CONFIG } from "../config.js";
import { novoId } from "../lib/dom.js";
import { calcularImpacto } from "../lib/impacto.js";
import { planoPadrao } from "../lib/plano.js";
import {
  ACOES_ATENDIMENTO, aparelhoCritico, minutosRestantes, ordenarFila, pontosProximos,
  RESULTADOS, tempoAtendimentoMin, validar, validarCampos, soDigitos, MINUTOS_ALERTA,
} from "../lib/regras.js";
import { ApiError, SemConexao } from "./erros.js";
import { coordenadasDoBairro, db, hashSenha, salvar } from "./mock-db.js";
import { sessao } from "./sessao.js";

const DURACAO_TOKEN_MS = 8 * 60 * 60 * 1000;
const aberturasRecentes = new Map();

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const agoraIso = () => new Date().toISOString();

async function latencia(ms = 250 + Math.random() * 350) {
  if (!navigator.onLine) throw new SemConexao();
  await espera(ms);
}

function publico({ senhaHash, ...usuario }) {
  return usuario;
}

async function usuarioAtual(papel) {
  const s = sessao.atual();
  if (!s) throw new ApiError(401, "Sessão expirada. Entre de novo.");
  const base = await db();
  const usuario = base.usuarios.find((u) => u.id === s.usuario.id);
  if (!usuario) throw new ApiError(401, "Sessão expirada. Entre de novo.");
  if (papel && usuario.papel !== papel) throw new ApiError(403, "Acesso negado.");
  return usuario;
}

function exigirValidos(erros) {
  if (Object.keys(erros).length) throw new ApiError(400, "Confira os dados informados.", { campos: erros });
}

async function pacienteAutorizado(pacienteId, usuario) {
  const base = await db();
  const paciente = base.pacientes.find((p) => p.id === pacienteId);
  if (!paciente) throw new ApiError(404, "Paciente não encontrado.");
  if (usuario.papel === "CUIDADOR" && paciente.cuidadorId !== usuario.id) throw new ApiError(403, "Acesso negado.");
  return paciente;
}

const equipamentosDe = (base, pacienteId) => base.equipamentos.filter((e) => e.pacienteId === pacienteId);
const ocorrenciaAberta = (base, pacienteId) =>
  base.ocorrencias.find((o) => o.pacienteId === pacienteId && o.status === "ABERTA");

function substituir(lista, id, novo) {
  return lista.map((item) => (item.id === id ? novo : item));
}

function detalheOcorrencia(base, ocorrencia) {
  const paciente = base.pacientes.find((p) => p.id === ocorrencia.pacienteId);
  const cuidador = base.usuarios.find((u) => u.id === ocorrencia.cuidadorId);
  const equipamentos = equipamentosDe(base, ocorrencia.pacienteId);
  const critico = aparelhoCritico(equipamentos);
  return {
    ...ocorrencia,
    paciente: { ...paciente, cuidadorNome: cuidador?.nome, cuidadorTelefone: cuidador?.telefone },
    equipamentos,
    aparelhoCritico: critico,
    minutosRestantes: minutosRestantes(ocorrencia, equipamentos),
    tempoAtendimentoMin: tempoAtendimentoMin(ocorrencia),
  };
}

function registrarEvento(ocorrencia, tipo, texto, usuario) {
  return { ...ocorrencia, eventos: [...ocorrencia.eventos, { tipo, em: agoraIso(), texto, por: usuario.nome }] };
}

async function atualizarOcorrencia(base, antiga, nova, usuario) {
  if (antiga.status !== nova.status) {
    base.auditoria = [...base.auditoria, {
      ocorrenciaId: antiga.id, em: agoraIso(), operacao: "UPDATE",
      statusAntigo: antiga.status, statusNovo: nova.status, por: usuario.nome,
    }];
  }
  base.ocorrencias = substituir(base.ocorrencias, antiga.id, nova);
  salvar();
  return detalheOcorrencia(base, nova);
}

function validarEquipamento(dados) {
  return validarCampos(dados, {
    tipo: [validar.obrigatorio("o tipo")],
    potenciaW: [validar.potencia],
    autonomiaMin: [validar.autonomia],
  });
}

function normalizarEquipamento(dados) {
  return {
    tipo: dados.tipo,
    fabricante: dados.fabricante || null,
    modelo: dados.modelo || null,
    tensaoV: dados.tensaoV ? Number(dados.tensaoV) : null,
    correnteA: dados.correnteA ? Number(dados.correnteA) : null,
    potenciaW: Number(dados.potenciaW),
    potenciaEstimada: Boolean(dados.potenciaEstimada),
    autonomiaMin: Number(dados.autonomiaMin),
    suporteVida: dados.suporteVida === true || dados.suporteVida === "true",
    fonteReserva: dados.fonteReserva || "NENHUMA",
  };
}

function validarPonto(dados) {
  return validarCampos(dados, {
    nome: [validar.nome],
    tipoFonte: [validar.obrigatorio("o tipo de fonte")],
    capacidadeW: [validar.capacidade],
    lat: [validar.latitude],
    lng: [validar.longitude],
    telefone: [validar.telefone],
  });
}

function limitarAberturas(usuarioId) {
  const umMinutoAtras = Date.now() - 60000;
  const recentes = (aberturasRecentes.get(usuarioId) ?? []).filter((t) => t > umMinutoAtras);
  if (recentes.length >= CONFIG.LIMITE_ABERTURAS_POR_MINUTO) {
    throw new ApiError(429, "Muitas tentativas. Aguarde alguns segundos.", { retryAfter: 30 });
  }
  aberturasRecentes.set(usuarioId, [...recentes, Date.now()]);
}

/** Leitura simulada da etiqueta: o nome do arquivo escolhe o cenário (borrada, só V e A, normal). */
function leituraSimulada(nomeArquivo) {
  const nome = nomeArquivo.toLowerCase();
  if (/borr|reflex|ilegiv|blur/.test(nome)) {
    return { legivel: false, observacao: "Foto borrada ou com reflexo: não foi possível ler a etiqueta." };
  }
  if (/so_va|trilogy|va\./.test(nome)) {
    return { legivel: true, fabricante: "PHILIPS", modelo: "Trilogy Evo", tensaoV: 100, correnteA: 1.7, potenciaW: 170, potenciaEstimada: true };
  }
  return { legivel: true, fabricante: "PHILIPS RESPIRONICS", modelo: "EverFlo", tensaoV: 220, correnteA: 1.5, potenciaW: 320, potenciaEstimada: false };
}

export const apiMock = {
  auth: {
    async login(email, senha) {
      await latencia();
      const base = await db();
      const usuario = base.usuarios.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
      if (!usuario || usuario.senhaHash !== (await hashSenha(senha))) {
        throw new ApiError(401, "E-mail ou senha inválidos.");
      }
      const expiraEm = new Date(Date.now() + DURACAO_TOKEN_MS).toISOString();
      const token = `mock.${btoa(JSON.stringify({ sub: usuario.id, papel: usuario.papel, exp: expiraEm }))}`;
      return { token, usuario: publico(usuario), expiraEm };
    },
    async cadastrar(dados) {
      await latencia();
      exigirValidos(validarCampos(dados, {
        nome: [validar.nome], email: [validar.email], telefone: [validar.telefone], senha: [validar.senha],
      }));
      if (!dados.aceiteTermo) throw new ApiError(400, "Aceite o termo de uso e privacidade.");
      const base = await db();
      if (base.usuarios.some((u) => u.email.toLowerCase() === dados.email.toLowerCase())) {
        throw new ApiError(409, "E-mail já cadastrado.", { campos: { email: "E-mail já cadastrado" } });
      }
      const usuario = {
        id: novoId(), nome: dados.nome, email: dados.email, telefone: soDigitos(dados.telefone), papel: "CUIDADOR",
        senhaHash: await hashSenha(dados.senha), termoVersao: "1.0", termoAceitoEm: agoraIso(),
      };
      base.usuarios = [...base.usuarios, usuario];
      salvar();
      return publico(usuario);
    },
  },

  pacientes: {
    async listar(pagina = 0, tamanho = 10) {
      await latencia();
      const usuario = await usuarioAtual();
      const base = await db();
      const meus = base.pacientes
        .filter((p) => usuario.papel === "GESTOR" || p.cuidadorId === usuario.id)
        .map((p) => {
          const equipamentos = equipamentosDe(base, p.id);
          return {
            ...p,
            totalAparelhos: equipamentos.length,
            temSuporteVida: equipamentos.some((e) => e.suporteVida),
            ocorrenciaAbertaId: ocorrenciaAberta(base, p.id)?.id ?? null,
          };
        });
      return { itens: meus.slice(pagina * tamanho, (pagina + 1) * tamanho), total: meus.length, pagina, tamanho };
    },
    async obter(id) {
      await latencia();
      const usuario = await usuarioAtual();
      const paciente = await pacienteAutorizado(id, usuario);
      const base = await db();
      return { ...paciente, equipamentos: equipamentosDe(base, id), ocorrenciaAbertaId: ocorrenciaAberta(base, id)?.id ?? null };
    },
    async criar(dados) {
      await latencia();
      const usuario = await usuarioAtual("CUIDADOR");
      exigirValidos(validarPaciente(dados));
      const base = await db();
      const paciente = { id: novoId(), cuidadorId: usuario.id, ...limparPaciente(dados), ...coordenadasDoBairro(dados.bairro, dados.cep) };
      base.pacientes = [...base.pacientes, paciente];
      salvar();
      return paciente;
    },
    async atualizar(id, dados) {
      await latencia();
      const usuario = await usuarioAtual("CUIDADOR");
      const atual = await pacienteAutorizado(id, usuario);
      exigirValidos(validarPaciente(dados));
      const base = await db();
      const novo = { ...atual, ...limparPaciente(dados), ...coordenadasDoBairro(dados.bairro, dados.cep) };
      base.pacientes = substituir(base.pacientes, id, novo);
      salvar();
      return novo;
    },
  },

  equipamentos: {
    async obter(id) {
      await latencia();
      const usuario = await usuarioAtual();
      const base = await db();
      const equipamento = base.equipamentos.find((e) => e.id === id);
      if (!equipamento) throw new ApiError(404, "Aparelho não encontrado.");
      await pacienteAutorizado(equipamento.pacienteId, usuario);
      return equipamento;
    },
    async criar(pacienteId, dados) {
      await latencia();
      const usuario = await usuarioAtual("CUIDADOR");
      await pacienteAutorizado(pacienteId, usuario);
      exigirValidos(validarEquipamento(dados));
      const base = await db();
      const equipamento = { id: novoId(), pacienteId, ...normalizarEquipamento(dados) };
      base.equipamentos = [...base.equipamentos, equipamento];
      salvar();
      return equipamento;
    },
    async atualizar(id, dados) {
      await latencia();
      const usuario = await usuarioAtual("CUIDADOR");
      const atual = await this.obter(id);
      await pacienteAutorizado(atual.pacienteId, usuario);
      exigirValidos(validarEquipamento(dados));
      const base = await db();
      const novo = { ...atual, ...normalizarEquipamento(dados) };
      base.equipamentos = substituir(base.equipamentos, id, novo);
      salvar();
      return novo;
    },
    async excluir(id) {
      await latencia();
      const usuario = await usuarioAtual("CUIDADOR");
      const atual = await this.obter(id);
      await pacienteAutorizado(atual.pacienteId, usuario);
      const base = await db();
      if (ocorrenciaAberta(base, atual.pacienteId)) {
        throw new ApiError(409, "Encerre a ocorrência antes de excluir.");
      }
      base.equipamentos = base.equipamentos.filter((e) => e.id !== id);
      salvar();
      return null;
    },
    async lerEtiqueta(arquivo) {
      await usuarioAtual();
      if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new ApiError(415, "Envie uma foto da etiqueta.");
      if (arquivo.size > 8 * 1024 * 1024) throw new ApiError(413, "Foto maior que 8 MB.");
      await latencia(1400 + Math.random() * 600);
      const leitura = leituraSimulada(arquivo.name);
      return { rota: "multimodal", precisaConfirmacao: true, ...leitura };
    },
  },

  planos: {
    async obter(pacienteId) {
      await latencia(700);
      const usuario = await usuarioAtual();
      await pacienteAutorizado(pacienteId, usuario);
      const base = await db();
      const equipamentos = equipamentosDe(base, pacienteId);
      if (!equipamentos.length) throw new ApiError(409, "Cadastre um aparelho para gerar o plano.");
      return { ...planoPadrao(equipamentos), geradoEm: agoraIso() };
    },
  },

  ocorrencias: {
    async abrir(pacienteId, chave) {
      await latencia();
      const usuario = await usuarioAtual("CUIDADOR");
      const base = await db();
      const repetida = base.idempotencia[chave];
      if (repetida) return detalheOcorrencia(base, base.ocorrencias.find((o) => o.id === repetida));
      limitarAberturas(usuario.id);
      await pacienteAutorizado(pacienteId, usuario);
      if (!equipamentosDe(base, pacienteId).some((e) => e.suporteVida)) {
        throw new ApiError(400, "Cadastre ao menos um aparelho de suporte à vida.");
      }
      const existente = ocorrenciaAberta(base, pacienteId);
      if (existente) {
        throw Object.assign(new ApiError(409, "Este paciente já tem uma ocorrência aberta."), { ocorrenciaId: existente.id });
      }
      const ocorrencia = {
        id: novoId(), pacienteId, cuidadorId: usuario.id, status: "ABERTA", abertaEm: agoraIso(),
        bateriaInformadaMin: null, bateriaAtualizadaEm: null, encerradaEm: null, resultado: null, encerradaPor: null,
        pontosAcionados: [], atendimentos: [],
        eventos: [{ tipo: "ABERTURA", em: agoraIso(), texto: "Ocorrência aberta pelo cuidador", por: usuario.nome }],
      };
      base.ocorrencias = [...base.ocorrencias, ocorrencia];
      base.idempotencia = { ...base.idempotencia, [chave]: ocorrencia.id };
      salvar();
      return detalheOcorrencia(base, ocorrencia);
    },
    async obter(id) {
      await latencia();
      const usuario = await usuarioAtual();
      const base = await db();
      const ocorrencia = base.ocorrencias.find((o) => o.id === id);
      if (!ocorrencia) throw new ApiError(404, "Ocorrência não encontrada.");
      await pacienteAutorizado(ocorrencia.pacienteId, usuario);
      return detalheOcorrencia(base, ocorrencia);
    },
    async historico(pacienteId) {
      await latencia();
      const usuario = await usuarioAtual();
      await pacienteAutorizado(pacienteId, usuario);
      const base = await db();
      return base.ocorrencias
        .filter((o) => o.pacienteId === pacienteId)
        .sort((a, b) => new Date(b.abertaEm) - new Date(a.abertaEm))
        .map((o) => detalheOcorrencia(base, o));
    },
    async atualizarBateria(id, minutos) {
      await latencia();
      const usuario = await usuarioAtual();
      const atual = await this.obter(id);
      if (atual.status !== "ABERTA") throw new ApiError(409, "Ocorrência já encerrada.");
      const limite = atual.aparelhoCritico?.autonomiaMin ?? 0;
      const valor = Number(minutos);
      if (!Number.isInteger(valor) || valor < 0 || (limite > 0 && valor > limite)) {
        throw new ApiError(400, `Informe um valor entre 0 e ${limite}.`, { campos: { minutos: `Informe um valor entre 0 e ${limite}` } });
      }
      const base = await db();
      const antiga = base.ocorrencias.find((o) => o.id === id);
      const nova = registrarEvento({ ...antiga, bateriaInformadaMin: valor, bateriaAtualizadaEm: agoraIso() },
        "BATERIA", `Bateria informada: ${valor} min`, usuario);
      return atualizarOcorrencia(base, antiga, nova, usuario);
    },
    async encerrar(id, resultado) {
      await latencia();
      const usuario = await usuarioAtual();
      const atual = await this.obter(id);
      if (atual.status !== "ABERTA") throw new ApiError(409, "Ocorrência já encerrada.");
      if (!RESULTADOS[resultado]) throw new ApiError(400, "Escolha o resultado.", { campos: { resultado: "Escolha o resultado" } });
      const base = await db();
      const antiga = base.ocorrencias.find((o) => o.id === id);
      const nova = registrarEvento(
        { ...antiga, status: "ENCERRADA", encerradaEm: agoraIso(), resultado, encerradaPor: usuario.nome },
        "ENCERRAMENTO", `Encerrada: ${RESULTADOS[resultado]}`, usuario);
      return atualizarOcorrencia(base, antiga, nova, usuario);
    },
    async fila() {
      await latencia();
      await usuarioAtual("GESTOR");
      const base = await db();
      const itens = base.ocorrencias.filter((o) => o.status === "ABERTA").map((o) => {
        const d = detalheOcorrencia(base, o);
        return { ...d, tipoCritico: d.aparelhoCritico?.tipo };
      });
      return ordenarFila(itens);
    },
    async indicadores() {
      await latencia();
      await usuarioAtual("GESTOR");
      const base = await db();
      const detalhes = base.ocorrencias.map((o) => detalheOcorrencia(base, o));
      const abertas = detalhes.filter((d) => d.status === "ABERTA");
      const tempos = detalhes.map((d) => d.tempoAtendimentoMin).filter((t) => t !== null);
      return {
        abertas: abertas.length,
        criticas: abertas.filter((d) => d.minutosRestantes < MINUTOS_ALERTA).length,
        semAtendimento: abertas.filter((d) => !d.atendimentos.length).length,
        tempoMedioAtendimentoMin: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
        pontosAtivos: base.pontos.filter((p) => p.ativo).length,
      };
    },
    async acionarPonto(id, pontoId) {
      await latencia();
      const usuario = await usuarioAtual("GESTOR");
      const base = await db();
      const antiga = base.ocorrencias.find((o) => o.id === id);
      const ponto = base.pontos.find((p) => p.id === pontoId);
      if (!antiga || !ponto) throw new ApiError(404, "Não encontrado.");
      if (antiga.status !== "ABERTA") throw new ApiError(409, "Ocorrência já encerrada.");
      if (antiga.pontosAcionados.includes(pontoId)) throw new ApiError(409, "Ponto já acionado.");
      const nova = registrarEvento({ ...antiga, pontosAcionados: [...antiga.pontosAcionados, pontoId] },
        "PONTO", `Ponto ${ponto.nome} acionado`, usuario);
      return atualizarOcorrencia(base, antiga, nova, usuario);
    },
    async registrarAtendimento(id, { acao, observacao }) {
      await latencia();
      const usuario = await usuarioAtual("GESTOR");
      if (!ACOES_ATENDIMENTO[acao]) throw new ApiError(400, "Escolha a ação.", { campos: { acao: "Escolha a ação" } });
      const base = await db();
      const antiga = base.ocorrencias.find((o) => o.id === id);
      if (!antiga) throw new ApiError(404, "Ocorrência não encontrada.");
      if (antiga.status !== "ABERTA") throw new ApiError(409, "Ocorrência já encerrada.");
      const atendimento = { acao, observacao: observacao || "", em: agoraIso(), por: usuario.nome };
      const texto = `${ACOES_ATENDIMENTO[acao]}${observacao ? `: ${observacao}` : ""}`;
      const nova = registrarEvento({ ...antiga, atendimentos: [...antiga.atendimentos, atendimento] }, "ATENDIMENTO", texto, usuario);
      return atualizarOcorrencia(base, antiga, nova, usuario);
    },
  },

  relatorios: {
    async impacto() {
      await latencia();
      await usuarioAtual("GESTOR");
      const base = await db();
      return calcularImpacto(base.ocorrencias.map((o) => detalheOcorrencia(base, o)), base.pontos);
    },
  },

  pontos: {
    async listar(pagina = 0, tamanho = 20) {
      await latencia();
      await usuarioAtual();
      const base = await db();
      const todos = [...base.pontos].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
      return { itens: todos.slice(pagina * tamanho, (pagina + 1) * tamanho), total: todos.length, pagina, tamanho };
    },
    async obter(id) {
      await latencia();
      await usuarioAtual("GESTOR");
      const ponto = (await db()).pontos.find((p) => p.id === id);
      if (!ponto) throw new ApiError(404, "Ponto não encontrado.");
      return ponto;
    },
    async proximosDaOcorrencia(ocorrenciaId) {
      const ocorrencia = await apiMock.ocorrencias.obter(ocorrenciaId);
      return pontosProximos(ocorrencia.paciente, (await db()).pontos);
    },
    async proximosDoPaciente(pacienteId) {
      await latencia();
      const usuario = await usuarioAtual();
      const paciente = await pacienteAutorizado(pacienteId, usuario);
      return pontosProximos(paciente, (await db()).pontos);
    },
    async criar(dados) {
      await latencia();
      await usuarioAtual("GESTOR");
      exigirValidos(validarPonto(dados));
      const base = await db();
      const ponto = { id: novoId(), ...limparPonto(dados), ativo: true };
      base.pontos = [...base.pontos, ponto];
      salvar();
      return ponto;
    },
    async atualizar(id, dados) {
      const atual = await this.obter(id);
      exigirValidos(validarPonto(dados));
      const base = await db();
      const novo = { ...atual, ...limparPonto(dados) };
      base.pontos = substituir(base.pontos, id, novo);
      salvar();
      return novo;
    },
    async alterarStatus(id, ativo) {
      const atual = await this.obter(id);
      const base = await db();
      const novo = { ...atual, ativo };
      base.pontos = substituir(base.pontos, id, novo);
      salvar();
      return novo;
    },
  },
};

function validarPaciente(dados) {
  return validarCampos(dados, {
    nome: [validar.nome],
    cep: [validar.cep],
    numero: [validar.obrigatorio("o número")],
    bairro: [validar.obrigatorio("o bairro")],
    contatoEmergencia: [validar.telefone],
  });
}

function limparPaciente(dados) {
  return {
    nome: dados.nome, cep: soDigitos(dados.cep), numero: dados.numero, bairro: dados.bairro,
    contatoEmergencia: soDigitos(dados.contatoEmergencia),
  };
}

function limparPonto(dados) {
  return {
    nome: dados.nome, tipoFonte: dados.tipoFonte, capacidadeW: Number(dados.capacidadeW),
    telefone: soDigitos(dados.telefone), endereco: dados.endereco || "", lat: Number(dados.lat), lng: Number(dados.lng),
  };
}
