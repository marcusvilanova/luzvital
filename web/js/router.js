// Roteador por hash com guarda de autenticação e de papel. Cada tela é carregada sob demanda.
import { atualizarOffline, renderizarShell } from "./components/shell.js";
import { aviso } from "./components/ui.js";
import { mount } from "./lib/dom.js";
import { mensagemDeErro } from "./services/erros.js";
import { aoMudarDados } from "./services/eventos.js";
import { sessao } from "./services/sessao.js";

const ROTAS = [
  { padrao: "/login", tela: () => import("./screens/acesso/login.js"), publica: true },
  { padrao: "/cadastro", tela: () => import("./screens/acesso/cadastro.js"), publica: true },
  { padrao: "/pacientes", tela: () => import("./screens/cuidador/pacientes.js"), papel: "CUIDADOR" },
  { padrao: "/pacientes/novo", tela: () => import("./screens/cuidador/paciente-form.js"), papel: "CUIDADOR" },
  { padrao: "/pacientes/:id", tela: () => import("./screens/cuidador/paciente.js"), papel: "CUIDADOR" },
  { padrao: "/pacientes/:id/editar", tela: () => import("./screens/cuidador/paciente-form.js"), papel: "CUIDADOR" },
  { padrao: "/pacientes/:id/aparelhos/novo", tela: () => import("./screens/cuidador/aparelho-form.js"), papel: "CUIDADOR" },
  { padrao: "/pacientes/:id/plano", tela: () => import("./screens/cuidador/plano.js"), papel: "CUIDADOR" },
  { padrao: "/aparelhos/:id/editar", tela: () => import("./screens/cuidador/aparelho-form.js"), papel: "CUIDADOR" },
  { padrao: "/ocorrencias/:id", tela: () => import("./screens/cuidador/ocorrencia.js"), papel: "CUIDADOR" },
  { padrao: "/pontos", tela: () => import("./screens/cuidador/pontos.js"), papel: "CUIDADOR" },
  { padrao: "/gestor/fila", tela: () => import("./screens/gestor/fila.js"), papel: "GESTOR" },
  { padrao: "/gestor/ocorrencias/:id", tela: () => import("./screens/gestor/ocorrencia.js"), papel: "GESTOR" },
  { padrao: "/gestor/impacto", tela: () => import("./screens/gestor/impacto.js"), papel: "GESTOR" },
  { padrao: "/gestor/pontos", tela: () => import("./screens/gestor/pontos.js"), papel: "GESTOR" },
  { padrao: "/gestor/pontos/novo", tela: () => import("./screens/gestor/ponto-form.js"), papel: "GESTOR" },
  { padrao: "/gestor/pontos/:id", tela: () => import("./screens/gestor/ponto-form.js"), papel: "GESTOR" },
  { padrao: "/sobre", tela: () => import("./screens/sobre.js") },
];

const inicioDoPapel = (papel) => (papel === "GESTOR" ? "/gestor/fila" : "/pacientes");

function casar(caminho) {
  const partes = caminho.split("/").filter(Boolean);
  for (const rota of ROTAS) {
    const molde = rota.padrao.split("/").filter(Boolean);
    if (molde.length !== partes.length) continue;
    const params = {};
    const ok = molde.every((m, i) => (m.startsWith(":") ? ((params[m.slice(1)] = decodeURIComponent(partes[i])), true) : m === partes[i]));
    if (ok) return { rota, params };
  }
  return null;
}

export function navegar(caminho) {
  location.hash = `#${caminho}`;
}

let limpezas = [];

function limparTela() {
  limpezas.forEach((fn) => fn());
  limpezas = [];
}

export async function rotear(raiz, acoes) {
  limparTela();
  const [caminho, busca = ""] = (location.hash.slice(1) || "/").split("?");
  const consulta = new URLSearchParams(busca);
  const usuario = sessao.atual()?.usuario;
  const achado = casar(caminho);

  if (!achado) return navegar(usuario ? inicioDoPapel(usuario.papel) : "/login");
  const { rota, params } = achado;
  if (!rota.publica && !usuario) return navegar("/login");
  if (rota.publica && usuario) return navegar(inicioDoPapel(usuario.papel));
  if (rota.papel && usuario && rota.papel !== usuario.papel) {
    return navegar(inicioDoPapel(usuario.papel)); // CUIDADOR nunca abre telas do gestor (e vice-versa)
  }

  const main = rota.publica ? raiz : renderizarShell(raiz, usuario, caminho, acoes);
  // aoDeixar: a tela registra limpezas (ex.: parar a contagem regressiva) ao trocar de rota.
  const contexto = { params, consulta, main, usuario, navegar, aoDeixar: (fn) => limpezas.push(fn) };
  try {
    const { default: tela } = await rota.tela();
    document.title = `${tela.titulo} · Luz Vital`;
    await tela.render(contexto);
    // Telas de lista se redesenham quando outra janela muda os dados (cuidador e gestor lado a lado).
    if (tela.atualizarSozinha) limpezas.push(aoMudarDados(() => rotear(raiz, acoes)));
    (main.querySelector("[data-titulo]") ?? main).focus({ preventScroll: false });
  } catch (erro) {
    mount(main, aviso("error", "Não foi possível abrir esta tela.", mensagemDeErro(erro)));
  }
  atualizarOffline();
}
