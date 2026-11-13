// Shell da aplicação: cabeçalho escuro, navegação por papel e barra inferior no celular.
import { html, mount } from "../lib/dom.js";
import { icone } from "./icones.js";
import { logo } from "./logo.js";

const NAV = {
  CUIDADOR: [
    { href: "#/pacientes", rotulo: "Meus pacientes", icone: "pessoas", grupo: "/pacientes" },
    { href: "#/pontos", rotulo: "Pontos de energia", icone: "local", grupo: "/pontos" },
    { href: "#/sobre", rotulo: "Sobre", icone: "sobre", grupo: "/sobre" },
  ],
  GESTOR: [
    { href: "#/gestor/fila", rotulo: "Fila", icone: "lista", grupo: "/gestor/fila" },
    { href: "#/gestor/impacto", rotulo: "Impacto", icone: "grafico", grupo: "/gestor/impacto" },
    { href: "#/gestor/pontos", rotulo: "Pontos de energia", icone: "local", grupo: "/gestor/pontos" },
    { href: "#/sobre", rotulo: "Sobre", icone: "sobre", grupo: "/sobre" },
  ],
};

const ITEM_OCORRENCIA = { "/ocorrencias": "/pacientes", "/gestor/ocorrencias": "/gestor/fila" };

function ativo(item, caminho) {
  const grupo = Object.entries(ITEM_OCORRENCIA).find(([prefixo]) => caminho.startsWith(prefixo))?.[1];
  return caminho.startsWith(item.grupo) || grupo === item.grupo;
}

export function renderizarShell(raiz, usuario, caminho, { aoSair, aoTrocarTema, aoTrocarLetra }) {
  const itens = NAV[usuario.papel] ?? [];
  const inicio = usuario.papel === "GESTOR" ? "#/gestor/fila" : "#/pacientes";
  mount(raiz, html`
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header class="shell-header">
      <a class="shell-brand" href="${inicio}" aria-label="Luz Vital, início">${logo()}</a>
      <nav class="shell-nav" aria-label="Navegação principal">
        ${itens.map((i) => html`<a href="${i.href}" ${ativo(i, caminho) ? 'aria-current="page"' : ""}>${i.rotulo}</a>`)}
      </nav>
      <span class="shell-spacer"></span>
      <span class="shell-user">${usuario.nome} · ${usuario.papel === "GESTOR" ? "Gestor" : "Cuidador"}</span>
      <button class="shell-action" type="button" data-botao-letra aria-pressed="${document.documentElement.dataset.letra === "grande"}" aria-label="Letra grande e alto contraste">${icone("letra")}</button>
      <button class="shell-action" type="button" data-tema aria-label="Alternar tema claro ou escuro">${icone("lua")}</button>
      <button class="shell-action" type="button" data-sair>${icone("sair")}<span class="sr-only">Sair</span></button>
    </header>
    <div class="offline-bar" data-offline hidden>Sem conexão. Pedidos de socorro ficam guardados e serão enviados quando o sinal voltar.</div>
    <main class="app-main" id="conteudo" tabindex="-1"></main>
    <nav class="bottom-nav" aria-label="Navegação">
      ${itens.map((i) => html`<a href="${i.href}" ${ativo(i, caminho) ? 'aria-current="page"' : ""}>${icone(i.icone)}${i.rotulo}</a>`)}
    </nav>`);
  raiz.querySelector("[data-sair]").addEventListener("click", aoSair);
  raiz.querySelector("[data-tema]").addEventListener("click", aoTrocarTema);
  raiz.querySelector("[data-botao-letra]").addEventListener("click", (e) => {
    aoTrocarLetra();
    e.currentTarget.setAttribute("aria-pressed", String(document.documentElement.dataset.letra === "grande"));
  });
  atualizarOffline(raiz);
  return raiz.querySelector("main");
}

export function atualizarOffline(raiz = document) {
  const barra = raiz.querySelector("[data-offline]");
  if (barra) barra.hidden = navigator.onLine;
}
