// Cadastro e edição de aparelho. Fluxo novo: foto da etiqueta -> leitura por IA -> cuidador confirma.
import { abrirModal } from "../../components/modal.js";
import { icone } from "../../components/icones.js";
import { toast } from "../../components/toast.js";
import { aviso, cabecalho, campo, carregando, selecao } from "../../components/ui.js";
import { $, html, lerFormulario, mostrarErros, mount } from "../../lib/dom.js";
import { FONTES_RESERVA, TIPOS_APARELHO, validar, validarCampos } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro } from "../../services/erros.js";

const TIPOS_ACEITOS = "image/jpeg,image/png,image/webp";

function validarAparelho(dados) {
  return validarCampos(dados, {
    tipo: [validar.obrigatorio("o tipo")],
    potenciaW: [validar.potencia],
    autonomiaMin: [validar.autonomia],
    suporteVida: [validar.obrigatorio("se é de suporte à vida")],
  });
}

function blocoFoto() {
  return html`<section class="stack" data-foto aria-labelledby="t-foto">
    <h2 id="t-foto" style="font-size:var(--text-h4);font-weight:600">1. Foto da etiqueta</h2>
    <label class="dropzone" data-zona>
      ${icone("camera")}
      <strong>Tirar foto ou escolher da galeria</strong>
      <span class="muted" style="font-size:var(--text-body-sm)">Etiqueta inteira, de frente, sem flash. JPEG, PNG ou WebP até 8 MB.</span>
      <input class="sr-only" type="file" accept="${TIPOS_ACEITOS}" capture="environment" data-arquivo>
    </label>
    <div data-previa></div>
    <div data-resultado-ia></div>
  </section>`;
}

function formulario(eq) {
  const sv = eq.suporteVida === undefined ? "" : String(eq.suporteVida);
  return html`<form novalidate class="stack" data-form>
    <h2 style="font-size:var(--text-h4);font-weight:600">${eq.id ? "Dados do aparelho" : "2. Confira e complete"}</h2>
    <div data-mensagem></div>
    ${selecao({ nome: "tipo", rotulo: "Tipo de aparelho", opcoes: TIPOS_APARELHO, valor: eq.tipo })}
    <div class="field-grid">
      ${campo({ nome: "fabricante", rotulo: "Fabricante", valor: eq.fabricante, obrigatorio: false })}
      ${campo({ nome: "modelo", rotulo: "Modelo", valor: eq.modelo, obrigatorio: false })}
    </div>
    <div class="field-grid">
      ${campo({ nome: "tensaoV", rotulo: "Tensão (V)", tipo: "number", valor: eq.tensaoV, obrigatorio: false, extra: 'step="any" min="0" inputmode="decimal"' })}
      ${campo({ nome: "correnteA", rotulo: "Corrente (A)", tipo: "number", valor: eq.correnteA, obrigatorio: false, extra: 'step="any" min="0" inputmode="decimal"' })}
    </div>
    <div class="field-grid">
      ${campo({ nome: "potenciaW", rotulo: "Potência (W)", tipo: "number", valor: eq.potenciaW, ajuda: "Define o tamanho do gerador ou da bateria externa", extra: 'step="any" min="0" inputmode="decimal"' })}
      ${campo({ nome: "autonomiaMin", rotulo: "Autonomia da bateria interna (minutos)", tipo: "number", valor: eq.autonomiaMin, ajuda: "0 se o aparelho não tem bateria. A IA não lê isso: veja o manual ou o visor.", extra: 'step="1" min="0" inputmode="numeric"' })}
    </div>
    <input type="hidden" name="potenciaEstimada" value="${eq.potenciaEstimada ? "true" : ""}">
    <fieldset class="field" style="border:0;padding:0;margin-top:var(--space-06)">
      <legend>O paciente depende deste aparelho para viver?</legend>
      <div class="tile-group" style="margin-top:var(--space-03)">
        <label class="tile-option"><input type="radio" name="suporteVida" value="true" ${sv === "true" ? "checked" : ""}><span><strong>Sim</strong><br><small class="muted">suporte à vida</small></span></label>
        <label class="tile-option"><input type="radio" name="suporteVida" value="false" ${sv === "false" ? "checked" : ""}><span><strong>Não</strong><br><small class="muted">apoio, conforto</small></span></label>
      </div>
      <p class="field-error" data-erro-de="suporteVida" aria-live="polite"></p>
    </fieldset>
    ${selecao({ nome: "fonteReserva", rotulo: "Fonte reserva disponível em casa", opcoes: FONTES_RESERVA, valor: eq.fonteReserva ?? "NENHUMA", vazio: "Selecione" })}
    <div class="btn-row" style="margin-top:var(--space-07)">
      ${eq.id ? html`<button class="btn btn-danger" type="button" data-excluir>Excluir ${icone("lixeira")}</button>` : ""}
      <button class="btn btn-primary" type="submit">Salvar aparelho ${icone("seta")}</button>
    </div>
  </form>`;
}

function preencherComLeitura(form, leitura) {
  const campos = { fabricante: leitura.fabricante, modelo: leitura.modelo, tensaoV: leitura.tensaoV, correnteA: leitura.correnteA, potenciaW: leitura.potenciaW };
  for (const [nome, valor] of Object.entries(campos)) {
    const el = form.elements[nome];
    el.value = valor ?? "";
    el.closest(".field").classList.toggle("ai-field", valor !== null && valor !== undefined);
  }
  form.elements.potenciaEstimada.value = leitura.potenciaEstimada ? "true" : "";
}

async function lerFoto(arquivo, raiz) {
  const previa = $("[data-previa]", raiz);
  const saida = $("[data-resultado-ia]", raiz);
  const form = $("[data-form]", raiz);
  const url = URL.createObjectURL(arquivo);
  mount(previa, html`<div class="photo-preview"><img src="${url}" alt="Foto da etiqueta enviada"><div class="scan" aria-hidden="true"></div></div>`);
  mount(saida, html`<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>Lendo etiqueta...</div>`);
  try {
    const leitura = await api.equipamentos.lerEtiqueta(arquivo);
    $(".scan", previa)?.remove();
    if (!leitura.legivel) {
      mount(saida, html`${aviso("warning", "Não consegui ler a etiqueta.", leitura.observacao ?? "")}
        <div class="btn-row" style="margin-top:1px"><button class="btn btn-tertiary" type="button" data-outra>Tirar outra foto</button>
        <button class="btn btn-secondary" type="button" data-digitar>Digitar dados</button></div>`);
      $("[data-outra]", saida).addEventListener("click", () => $("[data-arquivo]", raiz).click());
      $("[data-digitar]", saida).addEventListener("click", () => form.elements.tipo.focus());
      return;
    }
    preencherComLeitura(form, leitura);
    mount(saida, html`${aviso("success", "Etiqueta lida. Confira os dados abaixo.", "Os campos com faixa azul vieram da IA; corrija se algo estiver diferente da etiqueta.")}
      ${leitura.potenciaEstimada ? html`<p style="margin-top:var(--space-03)"><span class="tag tag-yellow">potência estimada</span>
        <span class="muted" style="font-size:var(--text-label)"> A etiqueta só traz volts e ampères: calculamos V × A.</span></p>` : ""}`);
    form.elements.tipo.focus();
  } catch (erro) {
    $(".scan", previa)?.remove();
    mount(saida, aviso("warning", "Leitura indisponível, digite os dados.", mensagemDeErro(erro)));
    form.elements.tipo.focus();
  }
}

async function excluir(eq, navegar) {
  await abrirModal({
    titulo: "Excluir este aparelho?", perigo: true, confirmar: "Excluir",
    corpo: html`<p>${TIPOS_APARELHO[eq.tipo]} ${eq.modelo ?? ""} sairá da lista e da contagem regressiva.</p>`,
    aoConfirmar: async () => {
      try {
        await api.equipamentos.excluir(eq.id);
        toast("Aparelho excluído.", "success");
        navegar(`/pacientes/${eq.pacienteId}`);
      } catch (erro) {
        toast(mensagemDeErro(erro), "error");
        throw erro;
      }
    },
  });
}

export default {
  titulo: "Aparelho",
  async render({ main, params, navegar }) {
    const editando = location.hash.startsWith("#/aparelhos/");
    mount(main, carregando());
    let eq = {};
    let paciente;
    try {
      if (editando) eq = await api.equipamentos.obter(params.id);
      paciente = await api.pacientes.obter(editando ? eq.pacienteId : params.id);
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível abrir o aparelho.", mensagemDeErro(erro)));
      return;
    }

    mount(main, html`
      ${cabecalho({
        voltar: `#/pacientes/${paciente.id}`, sobretitulo: paciente.nome,
        titulo: editando ? `${TIPOS_APARELHO[eq.tipo]}` : "Adicionar aparelho",
        descricao: editando ? "" : "A IA lê a etiqueta; você confirma e informa a autonomia da bateria.",
      })}
      <div class="split split-even">
        ${editando ? html`<aside class="stack">${aviso("info", "Mudou a bateria ou comprou um gerador?", "Atualize aqui: a contagem regressiva e o plano usam estes dados.")}</aside>` : blocoFoto()}
        ${formulario(eq)}
      </div>`);

    const form = $("[data-form]", main);
    const arquivo = $("[data-arquivo]", main);
    if (arquivo) {
      const zona = $("[data-zona]", main);
      arquivo.addEventListener("change", () => arquivo.files[0] && lerFoto(arquivo.files[0], main));
      zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("is-over"); });
      zona.addEventListener("dragleave", () => zona.classList.remove("is-over"));
      zona.addEventListener("drop", (e) => {
        e.preventDefault();
        zona.classList.remove("is-over");
        if (e.dataTransfer.files[0]) lerFoto(e.dataTransfer.files[0], main);
      });
    }
    $("[data-excluir]", main)?.addEventListener("click", () => excluir(eq, navegar));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = lerFormulario(form);
      if (!mostrarErros(form, validarAparelho(dados))) return;
      const botao = $('[type="submit"]', form);
      botao.disabled = true;
      try {
        if (editando) await api.equipamentos.atualizar(eq.id, dados);
        else await api.equipamentos.criar(paciente.id, dados);
        toast("Aparelho salvo. O plano de contingência foi atualizado.", "success");
        navegar(`/pacientes/${paciente.id}`);
      } catch (erro) {
        if (erro instanceof ApiError) mostrarErros(form, erro.campos);
        mount($("[data-mensagem]", form), aviso("error", mensagemDeErro(erro)));
        botao.disabled = false;
      }
    });
  },
};
