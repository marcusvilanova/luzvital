import { atualizarOffline } from "./components/shell.js";
import { toast } from "./components/toast.js";
import { navegar, rotear } from "./router.js";
import { filaOffline } from "./services/fila-offline.js";
import { registrarServiceWorker } from "./services/instalacao.js";
import { sessao } from "./services/sessao.js";

const raiz = document.getElementById("app");
const CHAVE_TEMA = "lv.tema";

function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.theme = tema;
}

function trocarTema() {
  const escuroAgora = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const novo = escuroAgora ? "light" : "dark";
  localStorage.setItem(CHAVE_TEMA, novo);
  aplicarTema(novo);
}

function sair() {
  sessao.limpar();
  toast("Você saiu da sua conta.");
  navegar("/login");
}

const CHAVE_LETRA = "lv.letra";

function trocarLetra() {
  const grande = document.documentElement.dataset.letra !== "grande";
  if (grande) document.documentElement.dataset.letra = "grande";
  else delete document.documentElement.dataset.letra;
  try { localStorage.setItem(CHAVE_LETRA, grande ? "grande" : ""); } catch { /* preferência só desta sessão */ }
}

const acoes = { aoSair: sair, aoTrocarTema: trocarTema, aoTrocarLetra: trocarLetra };

async function reenviarPendentes() {
  atualizarOffline();
  if (!navigator.onLine || !sessao.atual()) return;
  const abertas = await filaOffline.reenviar();
  if (abertas.length) {
    toast("Sinal de volta: seu pedido de socorro foi enviado.", "success");
    navegar(`/ocorrencias/${abertas[0].id}`);
  }
}

aplicarTema(localStorage.getItem(CHAVE_TEMA));
if (localStorage.getItem("lv.letra") === "grande") document.documentElement.dataset.letra = "grande";
window.addEventListener("hashchange", () => rotear(raiz, acoes));
window.addEventListener("online", reenviarPendentes);
window.addEventListener("offline", () => atualizarOffline());
sessao.aoMudar((s) => { if (!s) navegar("/login"); });

rotear(raiz, acoes);
reenviarPendentes();
registrarServiceWorker();
