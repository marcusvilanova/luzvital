import { icone } from "../../components/icones.js";
import { toast } from "../../components/toast.js";
import { aviso, avisoLegal, cabecalho, carregando, vazio } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { cep, dataHora, duracao, telefone, watts } from "../../lib/formato.js";
import { aparelhoCritico, FONTES_RESERVA, RESULTADOS, TIPOS_APARELHO } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro, SemConexao } from "../../services/erros.js";
import { filaOffline } from "../../services/fila-offline.js";

function linhaAparelho(e, critico) {
  return html`<li>
    <div class="list-body">
      <p class="list-title">${TIPOS_APARELHO[e.tipo]} ${e.id === critico?.id ? html`<span class="tag tag-dark">mais crítico</span>` : ""}</p>
      <p class="list-meta">${[e.fabricante, e.modelo].filter(Boolean).join(" · ") || "Sem modelo"} · ${watts(e.potenciaW)}${e.potenciaEstimada ? " (estimada)" : ""}</p>
      <p class="list-meta">Bateria: ${duracao(e.autonomiaMin)} · Reserva: ${FONTES_RESERVA[e.fonteReserva]}
        ${e.suporteVida ? html` · <strong>suporte à vida</strong>` : ""}</p>
    </div>
    <a class="btn btn-ghost btn-sm" href="#/aparelhos/${e.id}/editar" aria-label="Editar ${TIPOS_APARELHO[e.tipo]}">${icone("editar")}Editar</a>
  </li>`;
}

function blocoEmergencia(paciente) {
  if (paciente.ocorrenciaAbertaId) {
    return html`<a class="btn-emergency" href="#/ocorrencias/${paciente.ocorrenciaAbertaId}" style="background:var(--gray-100);text-decoration:none">
      Ocorrência aberta<small>Ver contagem regressiva e atendimento</small></a>`;
  }
  if (!paciente.equipamentos.some((e) => e.suporteVida)) {
    return aviso("warning", "Cadastre ao menos um aparelho de suporte à vida", "para poder abrir uma ocorrência.");
  }
  const pendente = filaOffline.pendenteDoPaciente(paciente.id);
  return html`<button class="btn-emergency" type="button" data-sem-luz>Estou sem luz
      <small>${pendente ? "Pedido guardado: será enviado quando o sinal voltar" : "Um toque abre a ocorrência e começa a contagem"}</small>
    </button>`;
}

async function abrirOcorrencia(paciente, botao, navegar) {
  botao.disabled = true; // trava o duplo toque; a Idempotency-Key cobre o reenvio
  const chave = filaOffline.chavePara(paciente.id);
  try {
    const ocorrencia = await api.ocorrencias.abrir(paciente.id, chave);
    filaOffline.remover(paciente.id);
    toast("Ocorrência aberta. A equipe já vê sua contagem.", "success");
    navegar(`/ocorrencias/${ocorrencia.id}`);
  } catch (erro) {
    if (erro instanceof SemConexao) {
      filaOffline.guardar(paciente.id, chave);
      toast("Sem sinal. Seu pedido será enviado assim que a conexão voltar.", "info");
      botao.querySelector("small").textContent = "Pedido guardado: será enviado quando o sinal voltar";
      botao.disabled = false;
      return;
    }
    if (erro instanceof ApiError && erro.status === 409 && erro.ocorrenciaId) {
      navegar(`/ocorrencias/${erro.ocorrenciaId}`);
      return;
    }
    toast(mensagemDeErro(erro), "error");
    botao.disabled = false;
  }
}

function historico(ocorrencias) {
  const encerradas = ocorrencias.filter((o) => o.status === "ENCERRADA");
  if (!encerradas.length) return html`<p class="muted">Nenhuma ocorrência anterior.</p>`;
  return html`<ul class="list">${encerradas.map((o) => html`<li><div class="list-body">
    <p class="list-title">${dataHora(o.abertaEm)}</p>
    <p class="list-meta">${RESULTADOS[o.resultado]}${o.tempoAtendimentoMin !== null ? ` · atendida em ${duracao(o.tempoAtendimentoMin)}` : ""}</p>
  </div></li>`)}</ul>`;
}

export default {
  atualizarSozinha: true,
  titulo: "Paciente",
  async render({ main, params, navegar }) {
    mount(main, carregando());
    let paciente;
    let ocorrencias;
    try {
      [paciente, ocorrencias] = await Promise.all([api.pacientes.obter(params.id), api.ocorrencias.historico(params.id)]);
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível abrir o paciente.", mensagemDeErro(erro)));
      return;
    }
    const critico = aparelhoCritico(paciente.equipamentos);
    document.title = `${paciente.nome} · Luz Vital`;

    mount(main, html`
      ${cabecalho({
        voltar: "#/pacientes", sobretitulo: `${paciente.bairro} · CEP ${cep(paciente.cep)}, nº ${paciente.numero}`, titulo: paciente.nome,
        acoes: html`<a class="btn btn-tertiary btn-sm" href="#/pacientes/${paciente.id}/editar">Editar dados ${icone("editar")}</a>`,
      })}
      <div class="split">
        <div class="stack-lg">
          <section aria-label="Emergência" class="stack">${blocoEmergencia(paciente)}${avisoLegal()}</section>
          <section aria-labelledby="t-aparelhos">
            <div class="page-head" style="margin-bottom:var(--space-04)">
              <h2 id="t-aparelhos">Aparelhos</h2>
              <a class="btn btn-primary btn-sm" href="#/pacientes/${paciente.id}/aparelhos/novo">Adicionar aparelho ${icone("camera")}</a>
            </div>
            ${paciente.equipamentos.length
              ? html`<ul class="list">${paciente.equipamentos.map((e) => linhaAparelho(e, critico))}</ul>`
              : vazio("Nenhum aparelho", "Fotografe a etiqueta do aparelho: a IA lê fabricante, modelo e potência para você.", "")}
          </section>
        </div>
        <aside class="stack">
          <div class="tile-grid">
            <a class="tile" href="#/pacientes/${paciente.id}/plano">
              <div class="tile-head"><div><p class="eyebrow">Gerado por IA · funciona offline</p><p class="tile-title">Plano de contingência</p></div>${icone("seta")}</div>
            </a>
            <a class="tile" href="#/pontos?paciente=${paciente.id}">
              <div class="tile-head"><div><p class="eyebrow">Até 5 km</p><p class="tile-title">Pontos de energia próximos</p></div>${icone("seta")}</div>
            </a>
          </div>
          <div class="tile">
            <p class="eyebrow">Contato de emergência</p>
            <p class="tile-title"><a href="tel:${paciente.contatoEmergencia}">${telefone(paciente.contatoEmergencia)}</a></p>
          </div>
          <section class="tile" aria-labelledby="t-hist">
            <h3 id="t-hist" style="margin-bottom:var(--space-04)">Ocorrências anteriores</h3>
            ${historico(ocorrencias)}
          </section>
        </aside>
      </div>`);

    $("[data-sem-luz]", main)?.addEventListener("click", (e) => abrirOcorrencia(paciente, e.currentTarget, navegar));
  },
};
