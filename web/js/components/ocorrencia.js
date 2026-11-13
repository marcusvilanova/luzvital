// Peças da ocorrência usadas pelo cuidador e pelo gestor: contagem regressiva, linha do tempo, pontos.
import { html, mount } from "../lib/dom.js";
import { dataHora, duracao, hora, km, relogio, telefone, watts } from "../lib/formato.js";
import { MINUTOS_ALERTA, minutosRestantes, RESULTADOS, TIPOS_APARELHO, TIPOS_FONTE_PONTO } from "../lib/regras.js";
import { icone } from "./icones.js";
import { medidor } from "./ui.js";

const INTERVALO_MS = 15000;

export function contagem(ocorrencia) {
  const critico = ocorrencia.aparelhoCritico;
  if (ocorrencia.status === "ENCERRADA") {
    return html`<section class="countdown" aria-label="Ocorrência encerrada">
      <p class="eyebrow">Ocorrência encerrada em ${dataHora(ocorrencia.encerradaEm)}</p>
      <span class="countdown-value" style="font-size:var(--text-h2)">${RESULTADOS[ocorrencia.resultado]}</span>
      <p>Encerrada por ${ocorrencia.encerradaPor}${ocorrencia.tempoAtendimentoMin !== null ? `. Primeiro atendimento em ${duracao(ocorrencia.tempoAtendimentoMin)}` : ""}.</p>
    </section>`;
  }
  const minutos = minutosRestantes(ocorrencia, ocorrencia.equipamentos);
  const estado = minutos <= 0 ? "is-out" : minutos < MINUTOS_ALERTA ? "is-low" : "";
  const origem = ocorrencia.bateriaInformadaMin !== null && ocorrencia.bateriaInformadaMin !== undefined
    ? `bateria informada às ${hora(ocorrencia.bateriaAtualizadaEm)}` : "autonomia cadastrada";
  return html`<section class="countdown ${estado}" aria-label="Contagem regressiva da bateria" data-contagem>
    <p class="eyebrow">Bateria restante · ${critico ? TIPOS_APARELHO[critico.tipo] : "—"}${critico?.modelo ? ` ${critico.modelo}` : ""}</p>
    <span class="countdown-value" role="timer" aria-live="off">${relogio(minutos)}</span>
    ${medidor(minutos, critico?.autonomiaMin ?? 0)}
    <p style="margin-top:var(--space-04);font-size:var(--text-body-sm)">
      ${minutos <= 0 ? "Sem bateria: use a fonte reserva ou vá ao ponto de energia agora." : `${duracao(minutos)} restantes`}
      <span style="color:var(--gray-30)"> · ${origem} · aberta às ${hora(ocorrencia.abertaEm)}</span></p>
  </section>`;
}

/** Atualiza a contagem a cada 15 s sem recarregar a tela. Devolve a função que para o relógio. */
export function iniciarRelogio(obterAlvo, obterOcorrencia) {
  const id = setInterval(() => {
    const alvo = obterAlvo();
    if (alvo) mount(alvo, contagem(obterOcorrencia()));
  }, INTERVALO_MS);
  return () => clearInterval(id);
}

export function linhaDoTempo(eventos) {
  return html`<ol class="timeline">${[...eventos].reverse().map((e) => html`<li>
    <time datetime="${e.em}">${dataHora(e.em)}</time>
    <p>${e.texto}</p><p class="list-meta">${e.por}</p></li>`)}</ol>`;
}

export function listaPontos(pontos, { acionados = [], podeAcionar = false } = {}) {
  if (!pontos.length) {
    return html`<p class="muted">Nenhum ponto de energia por perto (raio de 5 km). Considere a remoção do paciente.</p>`;
  }
  return html`<ul class="list">${pontos.map((p) => {
    const jaAcionado = acionados.includes(p.id);
    const mapa = `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
    return html`<li>
      <div class="list-body">
        <p class="list-title">${p.nome}</p>
        <p class="list-meta">${km(p.distanciaKm)} · ${TIPOS_FONTE_PONTO[p.tipoFonte]} · ${watts(p.capacidadeW)}</p>
        <p class="list-meta">${p.endereco} · <a href="tel:${p.telefone}">${telefone(p.telefone)}</a> · <a href="${mapa}" target="_blank" rel="noopener">mapa</a></p>
      </div>
      ${podeAcionar ? (jaAcionado
        ? html`<span class="tag tag-green">acionado</span>`
        : html`<button class="btn btn-primary btn-sm" type="button" data-acionar="${p.id}">Acionar ${icone("raio")}</button>`) : ""}
    </li>`;
  })}</ul>`;
}
