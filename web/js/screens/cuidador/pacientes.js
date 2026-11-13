import { icone } from "../../components/icones.js";
import { aviso, cabecalho, esqueleto, vazio } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { cep } from "../../lib/formato.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { filaOffline } from "../../services/fila-offline.js";

const TAMANHO_PAGINA = 10;

function cartao(p) {
  const pendente = filaOffline.pendenteDoPaciente(p.id);
  const estado = p.ocorrenciaAbertaId
    ? html`<span class="tag tag-yellow">Ocorrência aberta</span>`
    : pendente ? html`<span class="tag tag-dark">Pedido aguardando sinal</span>`
      : !p.temSuporteVida ? html`<span class="tag tag-outline">Cadastre os aparelhos</span>` : "";
  return html`<a class="tile" href="#/pacientes/${p.id}" style="min-height:10rem;display:flex;flex-direction:column;justify-content:space-between">
    <div class="tile-head">
      <div>
        <p class="tile-title">${p.nome}</p>
        <p class="muted" style="font-size:var(--text-body-sm)">${p.bairro} · CEP ${cep(p.cep)}</p>
      </div>
      ${icone("seta")}
    </div>
    <div class="cluster" style="margin-top:var(--space-06)">
      <span class="tag tag-blue">${p.totalAparelhos} ${p.totalAparelhos === 1 ? "aparelho" : "aparelhos"}</span>${estado}
    </div>
  </a>`;
}

export default {
  atualizarSozinha: true,
  titulo: "Meus pacientes",
  async render({ main, usuario }) {
    const acao = html`<a class="btn btn-primary" href="#/pacientes/novo">Adicionar paciente ${icone("mais")}</a>`;
    mount(main, html`${cabecalho({ sobretitulo: `Olá, ${usuario.nome.split(" ")[0]}`, titulo: "Meus pacientes", acoes: acao })}
      <div data-lista>${esqueleto(2)}</div>`);
    const alvo = $("[data-lista]", main);
    let pagina = 0;
    let itens = [];

    async function carregar() {
      try {
        const resultado = await api.pacientes.listar(pagina, TAMANHO_PAGINA);
        itens = [...itens, ...resultado.itens];
        if (!itens.length) {
          mount(alvo, vazio("Nenhum paciente cadastrado",
            "Cadastre a pessoa que depende de aparelho elétrico. Depois, adicione os aparelhos pela foto da etiqueta.", acao));
          return;
        }
        const temMais = itens.length < resultado.total;
        mount(alvo, html`
          <div class="tile-grid tile-grid-2 tile-grid-3">${itens.map(cartao)}</div>
          ${temMais ? html`<button class="btn btn-tertiary" type="button" data-mais style="margin-top:var(--space-06)">Carregar mais</button>` : ""}
          <p class="muted" style="margin-top:var(--space-05);font-size:var(--text-label)">${itens.length} de ${resultado.total} pacientes</p>`);
        $("[data-mais]", alvo)?.addEventListener("click", () => { pagina += 1; carregar(); });
      } catch (erro) {
        mount(alvo, aviso("error", "Não foi possível carregar seus pacientes.", mensagemDeErro(erro)));
      }
    }
    await carregar();
  },
};
