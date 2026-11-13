// Painel inicial do gestor: estado da operação, atalhos, mais urgentes, ritmo de aberturas,
// atividade recente e cobertura por bairro. Atualiza sozinho quando chega um pedido.
import { atalho } from "../../components/atalho.js";
import { anel, barras, barrasPorHora } from "../../components/graficos.js";
import { icone } from "../../components/icones.js";
import { botoesSimulacao, ligarSimulacao } from "../../components/simulacao.js";
import { aviso, esqueleto, medidor, tagMinutos } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { duracao, hora } from "../../lib/formato.js";
import { saudacao } from "../../lib/prontidao.js";
import { MINUTOS_ALERTA, minutosRestantes, ordenarFila, TIPOS_APARELHO } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { aoMudarDados } from "../../services/eventos.js";

const ATUALIZAR_MS = 30000;
const URGENTES = 6;
const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

const agoraTexto = () => `${fmtData.format(new Date())} · ${hora(new Date().toISOString())}`;

function faixaDeAbertura(usuario, fila, ind) {
  const abertas = fila.length;
  const primeiro = fila[0];
  const contexto = abertas
    ? html`${ind.criticas ? `${ind.criticas} com menos de 1 hora de bateria` : "Nenhuma com menos de 1 hora de bateria"}. Primeiro da fila: <strong>${primeiro.paciente.nome}</strong>,
        ${primeiro.paciente.bairro}, ${primeiro.minutosRestantes > 0 ? `com ${duracao(primeiro.minutosRestantes)} de bateria` : "já sem bateria"}.`
    : "Nenhuma casa sem luz agora. A fila e o mapa atualizam sozinhos quando um cuidador pedir ajuda.";
  return html`<section class="hero" aria-labelledby="hero-titulo">
    <div class="hero-topo">
      <span class="hero-data" data-relogio>${agoraTexto()}</span>
      ${abertas ? html`<span class="status-pill alerta">Apagão em curso</span>` : html`<span class="status-pill">Operação normal</span>`}
    </div>
    <h1 class="hero-saudacao" id="hero-titulo" tabindex="-1" data-titulo>${saudacao()}, <strong>${usuario.nome}</strong></h1>
    <div class="hero-corpo">
      <div>
        <div class="hero-numero"><span class="valor">${abertas}</span><span class="rotulo">${abertas === 1 ? "casa sem luz agora" : "casas sem luz agora"}</span></div>
        <p class="hero-contexto">${contexto}</p>
      </div>
      <div class="stack">
        <div class="hero-stats">
          <div><span class="v ${ind.criticas ? "alerta" : ""}">${ind.criticas}</span><span class="r">menos de ${MINUTOS_ALERTA} min</span></div>
          <div><span class="v">${ind.semAtendimento}</span><span class="r">sem atendimento</span></div>
          <div><span class="v">${ind.tempoMedioAtendimentoMin === null ? "—" : duracao(ind.tempoMedioAtendimentoMin)}</span><span class="r">média até atender</span></div>
        </div>
        <div class="hero-acoes">
          <a class="btn btn-primary" href="#/gestor/fila">Abrir fila e mapa ${icone("seta")}</a>
          <a class="btn btn-tertiary" href="#/gestor/impacto">Painel de impacto ${icone("grafico")}</a>
        </div>
      </div>
    </div>
    ${botoesSimulacao() ? html`<div class="hero-acoes" style="justify-content:flex-end">${botoesSimulacao()}</div>` : ""}
  </section>`;
}

function atalhos(fila, impacto, pontosAtivos, semCobertura) {
  return html`<nav class="bento" aria-label="Seções do painel">
    ${atalho({ href: "#/gestor/fila", icone: "lista", titulo: "Fila e mapa", texto: "Ordem de atendimento pela bateria restante e as casas no mapa.", numero: fila.length, unidade: "abertas" })}
    ${atalho({ href: "#/gestor/impacto", icone: "grafico", titulo: "Impacto", texto: "Tempo até o atendimento e casas atendidas antes de a bateria acabar.", numero: impacto.percentualATempo === null ? "—" : `${impacto.percentualATempo}%`, unidade: "a tempo" })}
    ${atalho({ href: "#/gestor/pontos", icone: "local", titulo: "Pontos de energia", texto: "Vizinhos, condomínios e comércios com gerador, bateria ou tomada.", numero: pontosAtivos, unidade: "ativos" })}
    ${atalho({ href: "#/gestor/pontos/novo", icone: "mais", titulo: "Recrutar ponto", texto: "Cadastre um gerador ou bateria no bairro que ainda não tem cobertura.", numero: semCobertura, unidade: semCobertura === 1 ? "bairro sem ponto" : "bairros sem ponto" })}
  </nav>`;
}

function blocoUrgentes(fila) {
  const lista = fila.slice(0, URGENTES);
  return html`<section class="b-tile c-8" aria-labelledby="t-urgentes">
    <div class="b-head">
      <div><p class="eyebrow">Fila por bateria restante</p><h2 id="t-urgentes">Mais urgentes agora</h2></div>
      <a href="#/gestor/fila">Ver fila completa (${fila.length}) ${icone("seta")}</a>
    </div>
    ${lista.length ? html`<ol class="urgentes">${lista.map((o, i) => html`<li class="${o.minutosRestantes < MINUTOS_ALERTA ? "critico" : ""}">
        <span class="pos">${String(i + 1).padStart(2, "0")}</span>
        <span class="quem"><a href="#/gestor/ocorrencias/${o.id}">${o.paciente.nome}</a>
          <span>${o.paciente.bairro} · ${o.aparelhoCritico ? TIPOS_APARELHO[o.aparelhoCritico.tipo] : "—"} · ${o.atendimentos.length ? "em atendimento" : "aguardando"}</span></span>
        ${medidor(o.minutosRestantes, o.aparelhoCritico?.autonomiaMin ?? 0)}
        ${tagMinutos(o.minutosRestantes)}
      </li>`)}</ol>`
      : html`<p class="muted">Nenhuma ocorrência aberta. Quando alguém tocar em "Estou sem luz", ela aparece aqui na posição certa.</p>`}
  </section>`;
}

function blocoATempo(impacto) {
  return html`<section class="b-tile c-4" aria-labelledby="t-atempo">
    <div class="b-head"><div><p class="eyebrow">Meta do projeto</p><h2 id="t-atempo">Atendidas a tempo</h2></div></div>
    ${anel(impacto.percentualATempo, "Atendidas antes de a bateria acabar")}
    <div class="numero-destaque vertical">
      <strong>${impacto.tempoMedioAtendimentoMin === null ? "—" : duracao(impacto.tempoMedioAtendimentoMin)}</strong><span>em média até o primeiro atendimento</span>
    </div>
    <p class="b-rodape">${impacto.atendidas} de ${impacto.total} ocorrências já tiveram atendimento.</p>
  </section>`;
}

function blocoAberturas(horas) {
  const total = horas.reduce((s, h) => s + h.valor, 0);
  const ultima = horas.at(-1)?.valor ?? 0;
  return html`<section class="b-tile c-8" aria-labelledby="t-horas">
    <div class="b-head">
      <div><p class="eyebrow">Últimas 24 horas</p><h2 id="t-horas">Pedidos de socorro por hora</h2></div>
      <div class="numero-destaque"><strong>${total}</strong><span>pedidos · ${ultima} na última hora</span></div>
    </div>
    ${barrasPorHora(horas)}
    <p class="b-rodape">Um pico de pedidos indica apagão em massa: acione a distribuidora e a Defesa Civil.</p>
  </section>`;
}

function blocoAtividade(atividade) {
  return html`<section class="b-tile c-4" aria-labelledby="t-atividade">
    <div class="b-head"><div><p class="eyebrow">Em tempo real</p><h2 id="t-atividade">Atividade recente</h2></div></div>
    ${atividade.length ? html`<ul class="feed">${atividade.map((e) => html`<li class="${e.tipo}">
        <a href="#/gestor/ocorrencias/${e.ocorrenciaId}"><span class="quem">${e.paciente}</span><span class="oque">${e.texto}</span></a>
        <time datetime="${e.em}">${hora(e.em)}</time>
      </li>`)}</ul>` : html`<p class="muted">Sem atividade ainda.</p>`}
  </section>`;
}

function blocoCobertura(cobertura) {
  const linhas = cobertura.slice(0, 8);
  const vazios = cobertura.filter((c) => c.semPonto).length;
  return html`<section class="b-tile c-7" aria-labelledby="t-cobertura">
    <div class="b-head">
      <div><p class="eyebrow">Onde faltam pontos de energia</p><h2 id="t-cobertura">Cobertura por bairro</h2></div>
      <a href="#/gestor/pontos/novo">Cadastrar ponto ${icone("mais")}</a>
    </div>
    ${vazios ? aviso("warning", `${vazios} ${vazios === 1 ? "bairro tem" : "bairros têm"} casas sem luz e nenhum ponto de energia ativo.`) : ""}
    <div class="table-wrap"><table class="data-table cobertura">
      <thead><tr><th scope="col">Bairro</th><th scope="col" class="num">Sem luz</th><th scope="col" class="num">&lt; 60 min</th><th scope="col" class="num">Pontos</th><th scope="col">Cobertura</th></tr></thead>
      <tbody>${linhas.map((c) => html`<tr class="${c.semPonto ? "vazio" : ""}">
        <td>${c.bairro}</td><td class="num">${c.abertas}</td><td class="num">${c.criticas}</td><td class="num">${c.pontos}</td>
        <td>${c.semPonto ? html`<span class="tag tag-yellow">sem ponto</span>` : c.abertas ? html`<span class="tag tag-green">coberto</span>` : html`<span class="tag tag-outline">reserva</span>`}</td>
      </tr>`)}</tbody>
    </table></div>
  </section>`;
}

function blocoAparelhos(impacto) {
  return html`<section class="b-tile c-5" aria-labelledby="t-aparelhos">
    <div class="b-head"><div><p class="eyebrow">Perfil dos atendidos</p><h2 id="t-aparelhos">Aparelho mais crítico</h2></div></div>
    ${barras(impacto.porTipoAparelho.slice(0, 6))}
    <p class="b-rodape">Concentrador sem bateria para no instante em que a luz cai: priorize fonte reserva nessas casas.</p>
  </section>`;
}

export default {
  titulo: "Início",
  async render({ main, usuario, aoDeixar }) {
    mount(main, html`<div data-painel>${esqueleto(5)}</div>`);
    const alvo = $("[data-painel]", main);

    async function carregar() {
      try {
        const [filaApi, ind, impacto, painel, pontos] = await Promise.all([
          api.ocorrencias.fila(), api.ocorrencias.indicadores(), api.relatorios.impacto(), api.relatorios.painel(), api.pontos.listar(0, 100),
        ]);
        const fila = ordenarFila(filaApi.map((o) => ({ ...o, minutosRestantes: minutosRestantes(o, o.equipamentos) })));
        const pontosAtivos = pontos.itens.filter((p) => p.ativo).length;
        const semCobertura = painel.cobertura.filter((c) => c.semPonto).length;
        mount(alvo, html`
          ${faixaDeAbertura(usuario, fila, ind)}
          ${atalhos(fila, impacto, pontosAtivos, semCobertura)}
          <div class="secao-titulo"><h2>Operação agora</h2><p data-atualizado>Atualizado às ${hora(new Date().toISOString())}</p></div>
          <div class="bento">${blocoUrgentes(fila)}${blocoATempo(impacto)}${blocoAberturas(painel.aberturas24h)}${blocoAtividade(painel.atividade)}</div>
          <div class="secao-titulo"><h2>Cobertura e perfil</h2><p>Base para decidir onde recrutar novos pontos de energia</p></div>
          <div class="bento">${blocoCobertura(painel.cobertura)}${blocoAparelhos(impacto)}</div>`);
        ligarSimulacao(alvo, carregar);
        // A animação de entrada só roda na primeira carga, não a cada atualização automática.
        setTimeout(() => { alvo.dataset.carregado = "1"; }, 600);
      } catch (erro) {
        mount(alvo, aviso("error", "Não foi possível carregar o painel.", mensagemDeErro(erro)));
      }
    }

    await carregar();
    const busca = setInterval(carregar, ATUALIZAR_MS);
    const relogio = setInterval(() => { const el = $("[data-relogio]", main); if (el) el.textContent = agoraTexto(); }, 15000);
    aoDeixar(() => { clearInterval(busca); clearInterval(relogio); });
    aoDeixar(aoMudarDados(carregar));
  },
};
