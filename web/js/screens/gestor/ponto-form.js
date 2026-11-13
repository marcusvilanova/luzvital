import { icone } from "../../components/icones.js";
import { toast } from "../../components/toast.js";
import { aviso, cabecalho, campo, carregando, selecao } from "../../components/ui.js";
import { $, html, lerFormulario, mostrarErros, mount } from "../../lib/dom.js";
import { TIPOS_FONTE_PONTO, validar, validarCampos } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro } from "../../services/erros.js";

function validarPonto(dados) {
  return validarCampos(dados, {
    nome: [validar.nome],
    tipoFonte: [validar.obrigatorio("o tipo de fonte")],
    capacidadeW: [validar.capacidade],
    telefone: [validar.telefone],
    lat: [validar.latitude],
    lng: [validar.longitude],
  });
}

function usarLocalizacao(form, botao) {
  if (!navigator.geolocation) return toast("Este navegador não informa a localização.", "error");
  botao.disabled = true;
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      form.elements.lat.value = coords.latitude.toFixed(5);
      form.elements.lng.value = coords.longitude.toFixed(5);
      botao.disabled = false;
    },
    () => { toast("Não foi possível obter a localização.", "error"); botao.disabled = false; },
    { timeout: 10000 },
  );
}

export default {
  titulo: "Ponto de energia",
  async render({ main, params, navegar }) {
    const editando = Boolean(params.id);
    mount(main, carregando());
    let ponto = {};
    try {
      if (editando) ponto = await api.pontos.obter(params.id);
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível abrir o ponto.", mensagemDeErro(erro)));
      return;
    }

    mount(main, html`
      ${cabecalho({ voltar: "#/gestor/pontos", sobretitulo: editando ? "Editar ponto" : "Novo ponto", titulo: editando ? ponto.nome : "Cadastrar ponto de energia" })}
      <div class="split">
        <form novalidate class="tile" style="padding:var(--space-07) var(--space-06)">
          <div data-mensagem></div>
          ${campo({ nome: "nome", rotulo: "Nome do ponto", valor: ponto.nome, ajuda: "Ex.: Condomínio Primavera, Mercado Bom Preço" })}
          <div class="field-grid" style="margin-top:var(--space-06)">
            ${selecao({ nome: "tipoFonte", rotulo: "Tipo de fonte", opcoes: TIPOS_FONTE_PONTO, valor: ponto.tipoFonte })}
            ${campo({ nome: "capacidadeW", rotulo: "Capacidade (W)", tipo: "number", valor: ponto.capacidadeW, ajuda: "Um concentrador usa cerca de 320 W", extra: 'min="0" step="1" inputmode="numeric"' })}
          </div>
          ${campo({ nome: "endereco", rotulo: "Endereço", valor: ponto.endereco, obrigatorio: false })}
          ${campo({ nome: "telefone", rotulo: "Telefone do responsável", tipo: "tel", valor: ponto.telefone, extra: 'inputmode="numeric"' })}
          <div class="field-grid" style="margin-top:var(--space-06)">
            ${campo({ nome: "lat", rotulo: "Latitude", tipo: "number", valor: ponto.lat, extra: 'step="any" inputmode="decimal" placeholder="-23.66400"' })}
            ${campo({ nome: "lng", rotulo: "Longitude", tipo: "number", valor: ponto.lng, extra: 'step="any" inputmode="decimal" placeholder="-46.77900"' })}
          </div>
          <button class="btn btn-ghost btn-sm" type="button" data-local style="margin-top:var(--space-03)">${icone("local")}Usar minha localização</button>
          <div class="btn-row" style="margin-top:var(--space-08)">
            <a class="btn btn-secondary" href="#/gestor/pontos">Cancelar</a>
            <button class="btn btn-primary" type="submit">Salvar ponto ${icone("seta")}</button>
          </div>
        </form>
        <aside class="stack">
          ${aviso("info", "Capacidade importa.", "A busca mostra a capacidade para a equipe saber se o ponto aguenta o aparelho do paciente.")}
          ${editando ? aviso(ponto.ativo ? "success" : "warning", ponto.ativo ? "Ponto ativo." : "Ponto inativo.", "Altere o status na lista de pontos.") : ""}
        </aside>
      </div>`);

    const form = $("form", main);
    $("[data-local]", main).addEventListener("click", (e) => usarLocalizacao(form, e.currentTarget));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = lerFormulario(form);
      if (!mostrarErros(form, validarPonto(dados))) return;
      const botao = $('[type="submit"]', form);
      botao.disabled = true;
      try {
        if (editando) await api.pontos.atualizar(params.id, dados);
        else await api.pontos.criar(dados);
        toast("Ponto salvo.", "success");
        navegar("/gestor/pontos");
      } catch (erro) {
        if (erro instanceof ApiError) mostrarErros(form, erro.campos);
        mount($("[data-mensagem]", form), aviso("error", mensagemDeErro(erro)));
        botao.disabled = false;
      }
    });
  },
};
