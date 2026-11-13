// Painel inicial do cuidador. Dois estados:
// - ocorrência aberta: a faixa vira alerta com a contagem regressiva ao vivo;
// - sem ocorrência: prontidão de cada paciente para o próximo apagão, com o que falta e o atalho para resolver.
import { atalho } from "../../components/atalho.js";
import { abrirOcorrencia, TEXTO_PENDENTE } from "../../components/estou-sem-luz.js";
import { anel } from "../../components/graficos.js";
import { icone } from "../../components/icones.js";
import { aviso, esqueleto, medidor } from "../../components/ui.js";
import { $, $$, html, mount } from "../../lib/dom.js";
import { duracao, hora, km, relogio } from "../../lib/formato.js";
import { CONTATOS } from "../../lib/plano.js";
import { prontidao, resumoPendencias, saudacao } from "../../lib/prontidao.js";
import { FONTES_RESERVA, minutosRestantes, TIPOS_APARELHO } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { filaOffline } from "../../services/fila-offline.js";

const ESCALA_BATERIA_MIN = 600; // medidor do cartão: 10 h de bateria = barra cheia
const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

function temPlanoSalvo(pacienteId) {
  try { return localStorage.getItem(`lv.plano.${pacienteId}`) !== null; } catch { return false; }
}

async function carregarDados() {
  const { itens } = await api.pacientes.listar(0, 50);
  return Promise.all(itens.map(async (resumo) => {
    const [paciente, pontos, ocorrencia] = await Promise.all([
      api.pacientes.obter(resumo.id),
      api.pontos.proximosDoPaciente(resumo.id).catch(() => []),
      resumo.ocorrenciaAbertaId ? api.ocorrencias.obter(resumo.ocorrenciaAbertaId) : null,
    ]);
    const pront = prontidao(paciente, paciente.equipamentos, { planoSalvo: temPlanoSalvo(paciente.id), pontosProximos: pontos.length });
    return { paciente, pontos, ocorrencia, pront };
  }));
}

function topoDaFaixa(alerta) {
  return html`<div class="hero-topo">
    <span class="hero-data">${fmtData.format(new Date())} · ${hora(new Date().toISOString())}</span>
    ${alerta ? html`<span class="status-pill alerta">Ocorrência aberta</span>` : html`<span class="status-pill">Sem ocorrência aberta</span>`}
  </div>`;
}

function faixaAlerta(usuario, { paciente, ocorrencia }) {
  const critico = ocorrencia.aparelhoCritico;
  const atendida = ocorrencia.atendimentos.length > 0;
  return html`<section class="hero hero-alerta" aria-labelledby="hero-titulo">
    ${topoDaFaixa(true)}
    <h1 class="hero-saudacao" id="hero-titulo" tabindex="-1" data-titulo>${usuario.nome.split(" ")[0]}, a equipe está acompanhando <strong>${paciente.nome}</strong></h1>
    <div class="hero-corpo">
      <div>
        <div class="hero-numero"><span class="valor mono" data-contagem role="timer">${relogio(minutosRestantes(ocorrencia, ocorrencia.equipamentos))}</span>
          <span class="rotulo">de bateria · ${critico ? TIPOS_APARELHO[critico.tipo] : "aparelho crítico"}</span></div>
        <p class="hero-contexto">${atendida
          ? "A equipe já registrou um atendimento. Mantenha o celular por perto e siga o plano de contingência."
          : "Seu pedido está na fila pela bateria restante. Ligue a fonte reserva e, em risco de vida, ligue 192."}</p>
      </div>
      <div class="hero-acoes">
        <a class="btn btn-primary" href="#/ocorrencias/${ocorrencia.id}">Acompanhar ocorrência ${icone("seta")}</a>
        <a class="btn btn-tertiary" href="#/pacientes/${paciente.id}/plano">Plano de contingência ${icone("documento")}</a>
      </div>
    </div>
  </section>`;
}

function faixaProntidao(usuario, dados) {
  const media = dados.length ? Math.round(dados.reduce((s, d) => s + d.pront.percentual, 0) / dados.length) : 0;
  const pendencias = dados.flatMap((d) => d.pront.itens.filter((i) => !i.ok && i.id !== "ponto"));
  const resumo = resumoPendencias(dados.map((d) => ({ nome: d.paciente.nome, pront: d.pront })));
  const aparelhos = dados.reduce((s, d) => s + d.paciente.equipamentos.length, 0);
  return html`<section class="hero" aria-labelledby="hero-titulo">
    ${topoDaFaixa(false)}
    <h1 class="hero-saudacao" id="hero-titulo" tabindex="-1" data-titulo>${saudacao()}, <strong>${usuario.nome.split(" ")[0]}</strong></h1>
    <div class="hero-corpo">
      <div>
        <div class="hero-numero"><span class="valor">${media}%</span><span class="rotulo">pronto para o próximo apagão</span></div>
        <p class="hero-contexto">${resumo ?? "Tudo em dia. Revise os aparelhos quando trocar a bateria ou comprar um gerador."}</p>
      </div>
      <div class="stack">
        <div class="hero-stats">
          <div><span class="v">${dados.length}</span><span class="r">${dados.length === 1 ? "paciente" : "pacientes"}</span></div>
          <div><span class="v">${aparelhos}</span><span class="r">aparelhos</span></div>
          <div><span class="v ${pendencias.length ? "alerta" : ""}">${pendencias.length}</span><span class="r">pendências</span></div>
        </div>
        <div class="hero-acoes">
          <a class="btn btn-primary" href="#/pacientes">Ver meus pacientes ${icone("seta")}</a>
          <a class="btn btn-tertiary" href="#/pacientes/novo">Adicionar paciente ${icone("mais")}</a>
        </div>
      </div>
    </div>
  </section>`;
}

function faixaVazia(usuario) {
  return html`<section class="hero" aria-labelledby="hero-titulo">
    ${topoDaFaixa(false)}
    <h1 class="hero-saudacao" id="hero-titulo" tabindex="-1" data-titulo>${saudacao()}, <strong>${usuario.nome.split(" ")[0]}</strong></h1>
    <div class="hero-corpo">
      <p class="hero-contexto" style="font-size:var(--text-body)">Comece cadastrando a pessoa que depende de aparelho elétrico.
        Depois, fotografe a etiqueta do aparelho: a IA lê a potência para você.</p>
      <div class="hero-acoes"><a class="btn btn-primary" href="#/pacientes/novo">Cadastrar paciente ${icone("mais")}</a></div>
    </div>
  </section>`;
}

function atalhos(dados) {
  const salvos = dados.filter((d) => d.pront.itens.find((i) => i.id === "plano").ok).length;
  const maisPerto = dados.flatMap((d) => d.pontos).sort((a, b) => a.distanciaKm - b.distanciaKm)[0];
  const primeiro = dados[0]?.paciente.id;
  return html`<nav class="bento" aria-label="Seções">
    ${atalho({ href: "#/pacientes", icone: "pessoas", titulo: "Meus pacientes", texto: "Dados, aparelhos e histórico de cada pessoa que você cuida.", numero: dados.length, unidade: dados.length === 1 ? "cadastrado" : "cadastrados" })}
    ${atalho({ href: primeiro ? `#/pacientes/${primeiro}/plano` : "#/pacientes/novo", icone: "documento", titulo: "Plano de contingência", texto: "O que fazer em cada faixa de tempo quando a luz cai. Funciona sem internet.", numero: `${salvos}/${dados.length}`, unidade: "salvos no celular" })}
    ${atalho({ href: "#/pontos", icone: "local", titulo: "Pontos de energia", texto: "Vizinhos e comércios com gerador ou bateria perto de casa.", numero: maisPerto ? km(maisPerto.distanciaKm) : "—", unidade: maisPerto ? "o mais próximo" : "nenhum a até 5 km" })}
    ${atalho({ href: "#/sobre", icone: "escudo", titulo: "Ajuda e privacidade", texto: "Como o app funciona, seus dados (LGPD) e o que ele não substitui.", numero: "192", unidade: "em risco de vida" })}
  </nav>`;
}

function cartaoPaciente({ paciente, ocorrencia, pront }) {
  const c = pront.critico;
  const temSuporte = paciente.equipamentos.some((e) => e.suporteVida);
  const pendente = filaOffline.pendenteDoPaciente(paciente.id);
  let acao;
  if (ocorrencia) acao = html`<a class="btn btn-primary" href="#/ocorrencias/${ocorrencia.id}">Ver ocorrência aberta ${icone("seta")}</a>`;
  else if (temSuporte) acao = html`<button class="btn-emergency compacto" type="button" data-sem-luz="${paciente.id}">Estou sem luz<small>${pendente ? TEXTO_PENDENTE : "Abre a ocorrência e começa a contagem"}</small></button>`;
  else acao = html`<a class="btn btn-primary" href="#/pacientes/${paciente.id}/aparelhos/novo">Cadastrar aparelho ${icone("camera")}</a>`;

  return html`<article class="b-tile c-6 paciente-card" aria-labelledby="pac-${paciente.id}">
    <div class="paciente-topo">
      <div>
        <p class="eyebrow">Prontidão · ${pront.feitos} de ${pront.total}</p>
        <h3 id="pac-${paciente.id}"><a href="#/pacientes/${paciente.id}">${paciente.nome}</a></h3>
        <p>${paciente.bairro} · ${paciente.equipamentos.length} ${paciente.equipamentos.length === 1 ? "aparelho" : "aparelhos"}</p>
      </div>
      ${anel(pront.percentual, `Prontidão de ${paciente.nome}`)}
    </div>
    ${c ? html`<div class="critico-box">
        <div class="linha"><span><small>Aparelho mais crítico</small><br><strong>${TIPOS_APARELHO[c.tipo]}${c.modelo ? ` · ${c.modelo}` : ""}</strong></span>
          <span class="tempo">${duracao(c.autonomiaMin)}</span></div>
        ${medidor(c.autonomiaMin, ESCALA_BATERIA_MIN)}
        <small>Bateria interna · reserva em casa: ${FONTES_RESERVA[c.fonteReserva].toLowerCase()}</small>
      </div>` : ""}
    <ul class="checklist">${pront.itens.map((i) => html`<li class="${i.ok ? "" : "pendente"}">
      ${icone(i.ok ? "ok" : "alerta")}<span>${i.texto}</span>${i.ok ? "" : html`<a href="${i.acao}">${i.rotuloAcao}</a>`}
    </li>`)}</ul>
    <div class="stack" style="margin-top:auto">${acao}</div>
  </article>`;
}

function blocoNovoPaciente() {
  return html`<a class="atalho c-6" href="#/pacientes/novo" style="justify-content:center">
    ${icone("mais")}<h3>Cuidar de mais alguém?</h3>
    <p>Cadastre outra pessoa da família que dependa de aparelho elétrico. Leva menos de 2 minutos com a foto da etiqueta.</p>
  </a>`;
}

function blocoEmergencia() {
  const passos = [
    ["Toque em “Estou sem luz”", "A equipe vê quanto tempo de bateria resta e organiza o socorro pela urgência."],
    ["Ligue a fonte reserva", "Cilindro, bateria externa ou gerador. Confira se o aparelho passou para a bateria."],
    ["Avise a distribuidora", "Diga que há equipamento vital na casa. O telefone está na conta de luz."],
  ];
  return html`<div class="bento">
    <section class="b-tile c-8" aria-labelledby="t-passos">
      <div class="b-head"><div><p class="eyebrow">Guarde esta ordem</p><h2 id="t-passos">Se a luz cair agora</h2></div></div>
      <ol class="passos">${passos.map(([t, d], i) => html`<li><span class="n">${String(i + 1).padStart(2, "0")}</span><strong>${t}</strong><p>${d}</p></li>`)}</ol>
    </section>
    <section class="b-tile c-4" aria-labelledby="t-contatos">
      <div class="b-head"><div><p class="eyebrow">O app não substitui</p><h2 id="t-contatos">Telefones de emergência</h2></div></div>
      <ul class="contatos">${CONTATOS.filter((c) => /^\d+$/.test(c.numero)).map((c) => html`<li>
        <a class="num" href="tel:${c.numero}">${c.numero}</a><div><strong>${c.nome}</strong><span>${c.quando}</span></div></li>`)}</ul>
    </section>
  </div>`;
}

function blocoLembretes() {
  return html`<div class="bento"><section class="b-tile" aria-labelledby="t-lembretes">
    <div class="b-head"><div><p class="eyebrow">Direitos de quem depende de energia</p><h2 id="t-lembretes">Não esqueça</h2></div></div>
    <div class="lembrete">
      <div>${icone("documento")}<div><strong>Renove o cadastro de cliente vital todo ano</strong>
        <p>Na distribuidora, o cadastro vale 12 meses e exige laudo médico novo. Com ele, a casa recebe aviso de desligamento programado com 5 dias úteis de antecedência e prioridade na religação.</p></div></div>
      <div>${icone("bateria")}<div><strong>Tarifa Social de Energia</strong>
        <p>Famílias do CadÚnico com renda de até 3 salários mínimos e pessoa em uso contínuo de aparelho têm direito ao benefício. Desde julho de 2025, até 80 kWh por mês são gratuitos.</p></div></div>
    </div>
  </section></div>`;
}

export default {
  atualizarSozinha: true,
  titulo: "Início",
  async render({ main, usuario, navegar, aoDeixar }) {
    mount(main, esqueleto(5));
    let dados;
    try {
      dados = await carregarDados();
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível carregar o painel.", mensagemDeErro(erro)));
      return;
    }
    const emAndamento = dados.find((d) => d.ocorrencia);
    const faixa = !dados.length ? faixaVazia(usuario) : emAndamento ? faixaAlerta(usuario, emAndamento) : faixaProntidao(usuario, dados);
    const cartoes = dados.map(cartaoPaciente);

    mount(main, html`
      ${faixa}
      ${atalhos(dados)}
      ${dados.length ? html`<div class="secao-titulo"><h2>Seus pacientes</h2><p>Prontidão de cada um para um apagão</p></div>
        <div class="bento">${cartoes}${dados.length % 2 ? blocoNovoPaciente() : ""}</div>` : ""}
      <div class="secao-titulo"><h2>Em uma emergência</h2><p>Funciona mesmo sem internet</p></div>
      ${blocoEmergencia()}
      ${blocoLembretes()}`);

    $$("[data-sem-luz]", main).forEach((b) => b.addEventListener("click", () => abrirOcorrencia(b.dataset.semLuz, b, navegar)));

    if (emAndamento) {
      const contar = () => {
        const el = $("[data-contagem]", main);
        if (el) el.textContent = relogio(minutosRestantes(emAndamento.ocorrencia, emAndamento.ocorrencia.equipamentos));
      };
      const id = setInterval(contar, 15000);
      aoDeixar(() => clearInterval(id));
    }
  },
};
