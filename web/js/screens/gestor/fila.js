// Fila do gestor: ocorrências abertas ordenadas pelos minutos de bateria restantes, com mapa ao lado.
// Atualiza sozinha: na hora quando outra janela muda os dados (demo), e a cada 30 s com backend real.
import { icone } from "../../components/icones.js";
import { criarMapa } from "../../components/mapa.js";
import { botoesSimulacao, ligarSimulacao } from "../../components/simulacao.js";
import { toast } from "../../components/toast.js";
import { aviso, cabecalho, esqueleto, tagMinutos, vazio } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { duracao, hora } from "../../lib/formato.js";
import { MINUTOS_ALERTA, minutosRestantes, ordenarFila, TIPOS_APARELHO } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { aoMudarDados } from "../../services/eventos.js";

const ATUALIZAR_MS = 30000;

function indicadores(dados) {
  const itens = [
    { valor: dados.abertas, rotulo: "Ocorrências abertas" },
    { valor: dados.criticas, rotulo: `Com menos de ${MINUTOS_ALERTA} min` },
    { valor: dados.semAtendimento, rotulo: "Sem atendimento ainda" },
    { valor: dados.tempoMedioAtendimentoMin === null ? "—" : duracao(dados.tempoMedioAtendimentoMin), rotulo: "Tempo médio até atender" },
  ];
  return html`<div class="tile-grid stats">
    ${itens.map((i) => html`<div class="tile stat"><span class="stat-value">${i.valor}</span><span class="stat-label">${i.rotulo}</span></div>`)}
  </div>`;
}

function tabela(itens, novos) {
  return html`<div class="table-wrap"><table class="data-table">
    <caption class="sr-only">Fila de ocorrências abertas, da menor para a maior bateria restante</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Paciente</th><th scope="col">Bairro</th>
      <th scope="col">Aparelho crítico</th><th scope="col" class="num">Bateria</th><th scope="col">Aberta</th><th scope="col">Atendimento</th></tr></thead>
    <tbody>${itens.map((o, i) => html`<tr class="${o.minutosRestantes < MINUTOS_ALERTA ? "row-critical" : ""} ${novos.has(o.id) ? "row-new" : ""}">
      <td class="mono">${String(i + 1).padStart(2, "0")}</td>
      <td><a href="#/gestor/ocorrencias/${o.id}">${o.paciente.nome}</a></td>
      <td>${o.paciente.bairro}</td>
      <td>${o.aparelhoCritico ? TIPOS_APARELHO[o.aparelhoCritico.tipo] : "—"}</td>
      <td class="num">${tagMinutos(o.minutosRestantes)}</td>
      <td class="mono">${hora(o.abertaEm)}</td>
      <td>${o.atendimentos.length ? html`<span class="tag tag-green">em andamento</span>` : html`<span class="tag tag-outline">aguardando</span>`}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function acoesCabecalho() {
  return html`${botoesSimulacao()}<button class="btn btn-tertiary btn-sm" type="button" data-atualizar>Atualizar ${icone("atualizar")}</button>`;
}

export default {
  titulo: "Fila de ocorrências",
  async render({ main, aoDeixar }) {
    mount(main, html`${cabecalho({
      sobretitulo: "Painel do gestor",
      titulo: "Fila por bateria restante",
      descricao: "Quem tem menos tempo aparece primeiro. Empate: ventilador antes de concentrador.",
      acoes: acoesCabecalho(),
    })}
    <div data-indicadores></div>
    <div class="fila-layout">
      <section aria-label="Fila"><div data-fila>${esqueleto(4)}</div>
        <p class="muted" style="margin-top:var(--space-05);font-size:var(--text-label)" data-hora aria-live="polite"></p></section>
      <section aria-label="Mapa das ocorrências e pontos de energia">
        <div class="map" data-mapa></div>
        <p class="map-legend"><span><i class="lg-critico"></i>menos de ${MINUTOS_ALERTA} min</span><span><i class="lg-ok"></i>bateria para mais tempo</span><span><i class="lg-ponto"></i>ponto de energia (raio de 5 km)</span></p>
      </section>
    </div>`);

    let mapa = null;
    let vistos = null;
    try {
      mapa = await criarMapa($("[data-mapa]", main));
      aoDeixar(() => mapa.destruir());
    } catch (erro) {
      mount($("[data-mapa]", main), aviso("warning", "Mapa indisponível.", mensagemDeErro(erro)));
    }

    async function carregar() {
      try {
        const [fila, dados, pontos] = await Promise.all([api.ocorrencias.fila(), api.ocorrencias.indicadores(), api.pontos.listar(0, 100)]);
        // Recalcula no cliente para a ordem acompanhar o relógio entre uma busca e outra.
        const itens = ordenarFila(fila.map((o) => ({ ...o, minutosRestantes: minutosRestantes(o, o.equipamentos) })));
        const novos = new Set(vistos ? itens.filter((o) => !vistos.has(o.id)).map((o) => o.id) : []);
        if (vistos && novos.size === 1) {
          const o = itens.find((x) => novos.has(x.id));
          toast(`Nova ocorrência: ${o.paciente.nome}, ${o.paciente.bairro} · ${duracao(o.minutosRestantes)}`, "info");
        }
        vistos = new Set(itens.map((o) => o.id));
        mount($("[data-indicadores]", main), indicadores(dados));
        mount($("[data-fila]", main), itens.length ? tabela(itens, novos)
          : vazio("Nenhuma ocorrência aberta", "Quando um cuidador tocar em Estou sem luz, a ocorrência aparece aqui.", ""));
        mapa?.atualizar(itens, pontos.itens);
        $("[data-hora]", main).textContent = `Atualizado às ${hora(new Date().toISOString())}. Atualiza sozinho quando chega um pedido.`;
      } catch (erro) {
        mount($("[data-fila]", main), aviso("error", "Não foi possível carregar a fila.", mensagemDeErro(erro)));
      }
    }

    $("[data-atualizar]", main).addEventListener("click", carregar);
    ligarSimulacao(main, carregar);
    await carregar();
    const id = setInterval(carregar, ATUALIZAR_MS);
    aoDeixar(() => clearInterval(id));
    aoDeixar(aoMudarDados(carregar));
  },
};
