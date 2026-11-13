// Implementação real: cada função chama o endpoint documentado em docs/CONTRATO-API.md.
// Mesmas assinaturas e formatos de retorno do api-mock.js.
import { CONFIG } from "../config.js";
import { requisicao } from "./http.js";

const java = (caminho, opcoes) => requisicao(CONFIG.API_JAVA, caminho, opcoes);
const dotnet = (caminho, opcoes) => requisicao(CONFIG.API_DOTNET, caminho, opcoes);

export const apiHttp = {
  auth: {
    login: (email, senha) => java("/auth/login", { metodo: "POST", corpo: { email, senha } }),
    cadastrar: (dados) => java("/auth/cadastro", { metodo: "POST", corpo: dados }),
  },
  pacientes: {
    listar: (pagina = 0, tamanho = 10) => java(`/pacientes?page=${pagina}&size=${tamanho}`),
    obter: (id) => java(`/pacientes/${id}`),
    criar: (dados) => java("/pacientes", { metodo: "POST", corpo: dados }),
    atualizar: (id, dados) => java(`/pacientes/${id}`, { metodo: "PUT", corpo: dados }),
  },
  equipamentos: {
    obter: (id) => java(`/equipamentos/${id}`),
    criar: (pacienteId, dados) => java("/equipamentos", { metodo: "POST", corpo: { ...dados, pacienteId } }),
    atualizar: (id, dados) => java(`/equipamentos/${id}`, { metodo: "PUT", corpo: dados }),
    excluir: (id) => java(`/equipamentos/${id}`, { metodo: "DELETE" }),
    lerEtiqueta: (arquivo) => {
      const formulario = new FormData();
      formulario.append("foto", arquivo);
      return java("/equipamentos/leitura-etiqueta", { metodo: "POST", formulario });
    },
  },
  planos: {
    obter: (pacienteId) => java(`/pacientes/${pacienteId}/plano`),
  },
  ocorrencias: {
    abrir: (pacienteId, chave) =>
      dotnet("/ocorrencias", { metodo: "POST", corpo: { pacienteId }, chaveIdempotencia: chave }),
    obter: (id) => dotnet(`/ocorrencias/${id}`),
    ativaDoPaciente: (pacienteId) => java(`/pacientes/${pacienteId}/ocorrencia-ativa`),
    historico: (pacienteId) => java(`/pacientes/${pacienteId}/ocorrencias`),
    atualizarBateria: (id, minutos) =>
      dotnet(`/ocorrencias/${id}/bateria`, { metodo: "PATCH", corpo: { minutosRestantes: minutos } }),
    encerrar: (id, resultado) =>
      dotnet(`/ocorrencias/${id}/encerramento`, { metodo: "POST", corpo: { resultado } }),
    fila: () => java("/ocorrencias/fila"),
    acionarPonto: (id, pontoId) => java(`/ocorrencias/${id}/acionamentos`, { metodo: "POST", corpo: { pontoId } }),
    registrarAtendimento: (id, dados) => java(`/ocorrencias/${id}/atendimentos`, { metodo: "POST", corpo: dados }),
    indicadores: () => java("/ocorrencias/indicadores"),
  },
  relatorios: {
    impacto: () => java("/relatorios/impacto"),
    painel: () => java("/relatorios/painel"),
  },
  pontos: {
    listar: (pagina = 0, tamanho = 20) => java(`/pontos-energia?page=${pagina}&size=${tamanho}`),
    obter: (id) => java(`/pontos-energia/${id}`),
    proximosDaOcorrencia: (ocorrenciaId) => java(`/ocorrencias/${ocorrenciaId}/pontos-proximos`),
    proximosDoPaciente: (pacienteId) => java(`/pacientes/${pacienteId}/pontos-proximos`),
    criar: (dados) => java("/pontos-energia", { metodo: "POST", corpo: dados }),
    atualizar: (id, dados) => java(`/pontos-energia/${id}`, { metodo: "PUT", corpo: dados }),
    alterarStatus: (id, ativo) => java(`/pontos-energia/${id}/status`, { metodo: "PATCH", corpo: { ativo } }),
  },
};
