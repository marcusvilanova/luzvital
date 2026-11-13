import { abrirModal } from "../../components/modal.js";
import { icone } from "../../components/icones.js";
import { toast } from "../../components/toast.js";
import { aviso, cabecalho, esqueleto, vazio } from "../../components/ui.js";
import { $, $$, html, mount } from "../../lib/dom.js";
import { telefone, watts } from "../../lib/formato.js";
import { TIPOS_FONTE_PONTO } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";

function tabela(pontos) {
  return html`<div class="table-wrap"><table class="data-table">
    <thead><tr><th scope="col">Ponto</th><th scope="col">Fonte</th><th scope="col" class="num">Capacidade</th>
      <th scope="col">Telefone</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${pontos.map((p) => html`<tr>
      <td><a href="#/gestor/pontos/${p.id}">${p.nome}</a><br><span class="list-meta">${p.endereco}</span></td>
      <td>${TIPOS_FONTE_PONTO[p.tipoFonte]}</td>
      <td class="num">${watts(p.capacidadeW)}</td>
      <td>${telefone(p.telefone)}</td>
      <td>${p.ativo ? html`<span class="tag tag-green">ativo</span>` : html`<span class="tag">inativo</span>`}</td>
      <td><button class="btn btn-ghost btn-sm" type="button" data-status="${p.id}" data-ativo="${p.ativo}">${p.ativo ? "Desativar" : "Ativar"}</button></td>
    </tr>`)}</tbody></table></div>`;
}

export default {
  titulo: "Pontos de energia",
  async render({ main }) {
    mount(main, html`${cabecalho({
      sobretitulo: "Rede de apoio",
      titulo: "Pontos de energia",
      descricao: "Vizinhos, condomínios e comércios com gerador, bateria ou tomada. Só os ativos aparecem nas buscas.",
      acoes: html`<a class="btn btn-primary" href="#/gestor/pontos/novo">Cadastrar ponto ${icone("mais")}</a>`,
    })}<div data-lista>${esqueleto(3)}</div>`);

    async function carregar() {
      const alvo = $("[data-lista]", main);
      try {
        const { itens, total } = await api.pontos.listar(0, 50);
        if (!itens.length) {
          mount(alvo, vazio("Nenhum ponto cadastrado", "Cadastre quem pode oferecer energia no bairro.", html`<a class="btn btn-primary" href="#/gestor/pontos/novo">Cadastrar ponto</a>`));
          return;
        }
        mount(alvo, html`${tabela(itens)}<p class="muted" style="margin-top:var(--space-04);font-size:var(--text-label)">${total} pontos · ${itens.filter((p) => p.ativo).length} ativos</p>`);
        $$("[data-status]", alvo).forEach((b) => b.addEventListener("click", () => alternar(b.dataset.status, b.dataset.ativo === "true")));
      } catch (erro) {
        mount(alvo, aviso("error", "Não foi possível carregar os pontos.", mensagemDeErro(erro)));
      }
    }

    async function alternar(id, ativo) {
      const confirmou = await abrirModal({
        titulo: ativo ? "Desativar este ponto?" : "Ativar este ponto?",
        confirmar: ativo ? "Desativar" : "Ativar", perigo: ativo,
        corpo: html`<p>${ativo ? "Ele deixa de aparecer nas buscas de proximidade e continua no histórico." : "Ele volta a aparecer nas buscas de proximidade."}</p>`,
        aoConfirmar: async () => {
          try {
            await api.pontos.alterarStatus(id, !ativo);
          } catch (erro) {
            toast(mensagemDeErro(erro), "error");
            throw erro;
          }
        },
      });
      if (confirmou) {
        toast(ativo ? "Ponto desativado." : "Ponto ativado.", "success");
        carregar();
      }
    }

    await carregar();
  },
};
