// Tela "Estou sem luz" depois de aberta: contagem regressiva, ações do cuidador e atendimento em tempo real.
import { modalBateria, modalEncerrar } from "../../components/acoes-ocorrencia.js";
import { verificarBateriaBaixa } from "../../components/alerta.js";
import { icone } from "../../components/icones.js";
import { contagem, iniciarRelogio, linhaDoTempo, listaPontos } from "../../components/ocorrencia.js";
import { toast } from "../../components/toast.js";
import { aviso, avisoLegal, cabecalho, carregando } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { aoMudarDados } from "../../services/eventos.js";

const ATUALIZAR_MS = 30000;
const ALERTA_MS = 15000;

export default {
  titulo: "Ocorrência",
  async render({ main, params, aoDeixar }) {
    mount(main, carregando());
    let ocorrencia;
    let pontos = [];
    try {
      ocorrencia = await api.ocorrencias.obter(params.id);
      pontos = ocorrencia.status === "ABERTA" ? await api.pontos.proximosDoPaciente(ocorrencia.pacienteId) : [];
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível abrir a ocorrência.", mensagemDeErro(erro)));
      return;
    }

    function desenhar() {
      const aberta = ocorrencia.status === "ABERTA";
      const atendida = ocorrencia.atendimentos.length > 0;
      mount(main, html`
        ${cabecalho({ voltar: `#/pacientes/${ocorrencia.pacienteId}`, sobretitulo: aberta ? "Ocorrência aberta" : "Ocorrência encerrada", titulo: ocorrencia.paciente.nome })}
        <div class="split">
          <div class="stack-lg">
            <div data-relogio>${contagem(ocorrencia)}</div>
            ${aberta ? html`<div class="btn-row">
              <button class="btn btn-primary" type="button" data-bateria>Atualizar bateria ${icone("bateria")}</button>
              <button class="btn btn-secondary" type="button" data-encerrar>Encerrar ocorrência ${icone("ok")}</button>
            </div>` : ""}
            ${avisoLegal()}
            ${aberta ? html`<section aria-labelledby="t-pontos">
              <h2 id="t-pontos" style="margin-bottom:var(--space-04)">Pontos de energia perto de você</h2>
              ${listaPontos(pontos)}
            </section>` : ""}
          </div>
          <aside class="stack">
            ${aberta ? (atendida
              ? aviso("success", "A equipe já está atendendo.", "Acompanhe abaixo.")
              : aviso("info", "A equipe recebeu seu pedido.", "Você está na fila pela bateria restante, não pela ordem de chegada."))
              : ""}
            <section class="tile">
              <h3 style="margin-bottom:var(--space-05)">Acompanhamento</h3>
              ${linhaDoTempo(ocorrencia.eventos)}
            </section>
            <a class="btn btn-tertiary btn-block" href="#/pacientes/${ocorrencia.pacienteId}/plano">Abrir plano de contingência ${icone("documento")}</a>
          </aside>
        </div>`);

      const atualizar = (nova) => { ocorrencia = nova; desenhar(); };
      $("[data-bateria]", main)?.addEventListener("click", () => modalBateria(ocorrencia, atualizar));
      $("[data-encerrar]", main)?.addEventListener("click", () => modalEncerrar(ocorrencia, atualizar));
    }

    desenhar();
    aoDeixar(iniciarRelogio(() => $("[data-relogio]", main), () => ocorrencia));
    verificarBateriaBaixa(ocorrencia);
    const alerta = setInterval(() => verificarBateriaBaixa(ocorrencia), ALERTA_MS);
    aoDeixar(() => clearInterval(alerta));

    // Busca novos eventos (atendimento, ponto acionado): na hora quando outra janela muda (demo) ou a cada 30 s.
    async function buscarNovidades() {
      try {
        const nova = await api.ocorrencias.obter(params.id);
        if (nova.eventos.length !== ocorrencia.eventos.length || nova.status !== ocorrencia.status) {
          const chegouAtendimento = nova.atendimentos.length > ocorrencia.atendimentos.length;
          ocorrencia = nova;
          desenhar();
          if (chegouAtendimento) toast("A equipe registrou um atendimento na sua ocorrência.", "success");
        }
      } catch { /* sem sinal: mantém a contagem local */ }
    }
    const busca = setInterval(buscarNovidades, ATUALIZAR_MS);
    aoDeixar(() => clearInterval(busca));
    aoDeixar(aoMudarDados(buscarNovidades));
  },
};
