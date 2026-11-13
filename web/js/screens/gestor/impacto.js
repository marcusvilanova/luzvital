// Painel de impacto: os indicadores que a documentação promete para medir e ampliar o projeto.
import { anel, barras, colunas } from "../../components/graficos.js";
import { icone } from "../../components/icones.js";
import { aviso, cabecalho, esqueleto, vazio } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { duracao } from "../../lib/formato.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { aoMudarDados } from "../../services/eventos.js";

function resumo(d) {
  const itens = [
    { valor: d.total, rotulo: "Ocorrências registradas" },
    { valor: d.atendidas, rotulo: "Com atendimento" },
    { valor: d.tempoMedioAtendimentoMin === null ? "—" : duracao(d.tempoMedioAtendimentoMin), rotulo: "Tempo médio até o atendimento" },
    { valor: d.percentualATempo === null ? "—" : `${d.percentualATempo}%`, rotulo: "Atendidas antes de a bateria acabar" },
  ];
  return html`<div class="tile-grid stats">${itens.map((i) => html`<div class="tile stat"><span class="stat-value">${i.valor}</span><span class="stat-label">${i.rotulo}</span></div>`)}</div>`;
}

function painel(d) {
  return html`${resumo(d)}
    <div class="impact-grid">
      <div class="stack">
        ${anel(d.percentualATempo, "Atendidas antes de a bateria acabar")}
        <p class="muted" style="font-size:var(--text-label);text-align:center;max-width:36ch;margin-inline:auto">
          Primeiro atendimento com bateria sobrando. Aparelho sem bateria conta quando a casa tinha fonte reserva.</p>
      </div>
      ${colunas(d.distribuicaoEspera, { titulo: "Tempo até o primeiro atendimento", unidade: " ocorrências" })}
      <div class="wide">${barras(d.porBairro, { titulo: "Ocorrências por bairro", secundario: "abertas", legenda: ["total", "abertas agora"] })}</div>
      ${barras(d.porTipoAparelho, { titulo: "Pacientes por aparelho crítico" })}
      ${barras(d.pontosPorBairro, { titulo: "Pontos de energia ativos por bairro" })}
    </div>
    <p class="muted" style="margin-top:var(--space-05);font-size:var(--text-label)">
      Comparar estes números com o total de clientes vitais da distribuidora mostra quanto do público o Luz Vital já alcança.</p>`;
}

export default {
  titulo: "Impacto",
  async render({ main, aoDeixar }) {
    mount(main, html`${cabecalho({
      sobretitulo: "Painel do gestor · ODS 3, 11 e 13",
      titulo: "Impacto do atendimento",
      descricao: "Quanto tempo a equipe leva para chegar, quantas casas são atendidas antes de a bateria acabar e onde estão os vazios de cobertura.",
      acoes: html`<a class="btn btn-tertiary btn-sm" href="#/gestor/fila">Ver fila ${icone("lista")}</a>`,
    })}<div data-painel>${esqueleto(4)}</div>`);

    async function carregar() {
      const alvo = $("[data-painel]", main);
      try {
        const dados = await api.relatorios.impacto();
        mount(alvo, dados.total ? painel(dados)
          : vazio("Ainda não há ocorrências", "Os indicadores aparecem depois das primeiras ocorrências. No modo demonstração, use Simular apagão na fila.", html`<a class="btn btn-primary" href="#/gestor/fila">Ir para a fila</a>`));
      } catch (erro) {
        mount(alvo, aviso("error", "Não foi possível carregar os indicadores.", mensagemDeErro(erro)));
      }
    }
    await carregar();
    aoDeixar(aoMudarDados(carregar));
  },
};
