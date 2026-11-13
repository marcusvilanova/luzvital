// Detalhe da ocorrência para o gestor: dados do paciente, aparelhos, pontos próximos e registro do atendimento.
import { modalBateria, modalEncerrar } from "../../components/acoes-ocorrencia.js";
import { icone } from "../../components/icones.js";
import { contagem, iniciarRelogio, linhaDoTempo, listaPontos } from "../../components/ocorrencia.js";
import { toast } from "../../components/toast.js";
import { aviso, cabecalho, carregando, selecao } from "../../components/ui.js";
import { $, $$, html, lerFormulario, mostrarErros, mount } from "../../lib/dom.js";
import { cep, duracao, telefone, watts } from "../../lib/formato.js";
import { ACOES_ATENDIMENTO, FONTES_RESERVA, TIPOS_APARELHO } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro } from "../../services/erros.js";
import { aoMudarDados } from "../../services/eventos.js";

function fichaPaciente(o) {
  const p = o.paciente;
  return html`<section class="tile">
    <h3 style="margin-bottom:var(--space-04)">Paciente e contatos</h3>
    <dl class="facts">
      <dt>Endereço</dt><dd>nº ${p.numero}, ${p.bairro} · CEP ${cep(p.cep)}</dd>
      <dt>Cuidador</dt><dd>${p.cuidadorNome ?? "—"} ${p.cuidadorTelefone ? html`· <a href="tel:${p.cuidadorTelefone}">${telefone(p.cuidadorTelefone)}</a>` : ""}</dd>
      <dt>Emergência</dt><dd><a href="tel:${p.contatoEmergencia}">${telefone(p.contatoEmergencia)}</a></dd>
    </dl>
  </section>`;
}

function tabelaAparelhos(equipamentos) {
  return html`<div class="table-wrap"><table class="data-table">
    <thead><tr><th scope="col">Aparelho</th><th scope="col" class="num">Potência</th><th scope="col" class="num">Autonomia</th><th scope="col">Reserva</th></tr></thead>
    <tbody>${equipamentos.map((e) => html`<tr>
      <td>${TIPOS_APARELHO[e.tipo]}${e.modelo ? ` · ${e.modelo}` : ""} ${e.suporteVida ? html`<span class="tag tag-dark">vida</span>` : ""}</td>
      <td class="num">${watts(e.potenciaW)}</td><td class="num">${duracao(e.autonomiaMin)}</td><td>${FONTES_RESERVA[e.fonteReserva]}</td>
    </tr>`)}</tbody></table></div>`;
}

function formAtendimento() {
  return html`<form class="tile" novalidate data-atendimento>
    <h3 style="margin-bottom:var(--space-04)">Registrar atendimento</h3>
    ${selecao({ nome: "acao", rotulo: "Ação tomada", opcoes: ACOES_ATENDIMENTO, vazio: "Escolha a ação" })}
    <div class="field" style="margin-top:var(--space-05)">
      <label for="f-observacao">Observação (opcional)</label>
      <textarea class="input" id="f-observacao" name="observacao" rows="3" maxlength="280" placeholder="Ex.: Equipe 3 a caminho com gerador"></textarea>
    </div>
    <button class="btn btn-primary btn-block" type="submit" style="margin-top:var(--space-05)">Registrar ${icone("ok")}</button>
  </form>`;
}

export default {
  titulo: "Ocorrência",
  async render({ main, params, aoDeixar }) {
    mount(main, carregando());
    let ocorrencia;
    let pontos = [];
    try {
      ocorrencia = await api.ocorrencias.obter(params.id);
      if (ocorrencia.status === "ABERTA") pontos = await api.pontos.proximosDaOcorrencia(params.id);
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível abrir a ocorrência.", mensagemDeErro(erro)));
      return;
    }

    function desenhar() {
      const aberta = ocorrencia.status === "ABERTA";
      mount(main, html`
        ${cabecalho({
          voltar: "#/gestor/fila", sobretitulo: `Ocorrência ${aberta ? "aberta" : "encerrada"} · ${ocorrencia.paciente.bairro}`,
          titulo: ocorrencia.paciente.nome,
          acoes: aberta ? html`<button class="btn btn-tertiary btn-sm" type="button" data-bateria>Atualizar bateria ${icone("bateria")}</button>
            <button class="btn btn-secondary btn-sm" type="button" data-encerrar>Encerrar ${icone("ok")}</button>` : "",
        })}
        <div class="split">
          <div class="stack-lg">
            <div data-relogio>${contagem(ocorrencia)}</div>
            <section aria-labelledby="t-ap"><h2 id="t-ap" style="margin-bottom:var(--space-04)">Aparelhos</h2>${tabelaAparelhos(ocorrencia.equipamentos)}</section>
            ${aberta ? html`<section aria-labelledby="t-pt"><h2 id="t-pt" style="margin-bottom:var(--space-04)">Pontos de energia próximos</h2>
              <div data-pontos>${listaPontos(pontos, { acionados: ocorrencia.pontosAcionados, podeAcionar: true })}</div></section>` : ""}
          </div>
          <aside class="stack">
            ${aberta ? formAtendimento() : ""}
            ${fichaPaciente(ocorrencia)}
            <section class="tile"><h3 style="margin-bottom:var(--space-05)">Linha do tempo</h3>${linhaDoTempo(ocorrencia.eventos)}</section>
          </aside>
        </div>`);
      ligarAcoes();
    }

    const atualizar = (nova) => { ocorrencia = nova; desenhar(); };

    function ligarAcoes() {
      $("[data-bateria]", main)?.addEventListener("click", () => modalBateria(ocorrencia, atualizar));
      $("[data-encerrar]", main)?.addEventListener("click", () => modalEncerrar(ocorrencia, atualizar));
      $$("[data-acionar]", main).forEach((b) => b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          atualizar(await api.ocorrencias.acionarPonto(ocorrencia.id, b.dataset.acionar));
          toast("Ponto acionado e registrado na ocorrência.", "success");
        } catch (erro) {
          toast(mensagemDeErro(erro), "error");
          b.disabled = false;
        }
      }));
      const form = $("[data-atendimento]", main);
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const dados = lerFormulario(form);
        if (!mostrarErros(form, dados.acao ? {} : { acao: "Escolha a ação" })) return;
        try {
          atualizar(await api.ocorrencias.registrarAtendimento(ocorrencia.id, dados));
          toast("Atendimento registrado.", "success");
        } catch (erro) {
          if (erro instanceof ApiError) mostrarErros(form, erro.campos);
          toast(mensagemDeErro(erro), "error");
        }
      });
    }

    desenhar();
    aoDeixar(iniciarRelogio(() => $("[data-relogio]", main), () => ocorrencia));
    // O cuidador atualizou a bateria ou encerrou em outra janela: redesenha só se algo mudou.
    aoDeixar(aoMudarDados(async () => {
      try {
        const nova = await api.ocorrencias.obter(params.id);
        if (nova.eventos.length !== ocorrencia.eventos.length || nova.status !== ocorrencia.status) {
          atualizar(nova);
          toast("O cuidador atualizou esta ocorrência.", "info");
        }
      } catch { /* mantém a tela atual */ }
    }));
  },
};
