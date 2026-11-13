import { icone } from "../../components/icones.js";
import { aviso, campo } from "../../components/ui.js";
import { $, html, lerFormulario, mostrarErros, mount } from "../../lib/dom.js";
import { validar, validarCampos } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";
import { sessao } from "../../services/sessao.js";
import { molduraAcesso } from "./layout.js";

export default {
  titulo: "Entrar",
  render({ main, navegar }) {
    const expirou = sessao.expirou();
    mount(main, molduraAcesso(html`
      <h1 tabindex="-1" data-titulo style="margin-bottom:var(--space-03)">Entrar</h1>
      <p class="muted" style="margin-bottom:var(--space-07)">Não tem conta? <a href="#/cadastro">Criar conta de cuidador</a></p>
      <div data-mensagem>${expirou ? aviso("warning", "Sessão expirada.", "Entre de novo para continuar.") : ""}</div>
      <form novalidate style="margin-top:var(--space-06)">
        ${campo({ nome: "email", rotulo: "E-mail", tipo: "email", extra: 'autocomplete="username" inputmode="email"' })}
        ${campo({ nome: "senha", rotulo: "Senha", tipo: "password", extra: 'autocomplete="current-password"' })}
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:var(--space-07)">Entrar ${icone("seta")}</button>
      </form>
      <details style="margin-top:var(--space-09)" class="muted">
        <summary style="cursor:pointer;font-size:var(--text-label)">Usuários de teste (modo demonstração)</summary>
        <dl class="facts" style="margin-top:var(--space-04)">
          <dt>Cuidador</dt><dd class="mono">cuidador.ana@teste.com · Luz2026ok</dd>
          <dt>Cuidador</dt><dd class="mono">cuidador.bruno@teste.com · Luz2026ok</dd>
          <dt>Gestor</dt><dd class="mono">gestor.defesa@teste.com · Gestor2026ok</dd>
        </dl>
      </details>`));

    const form = $("form", main);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = lerFormulario(form);
      const erros = validarCampos(dados, { email: [validar.email], senha: [validar.obrigatorio("a senha")] });
      if (!mostrarErros(form, erros)) return;
      const botao = $('[type="submit"]', form);
      botao.disabled = true;
      try {
        const resultado = await api.auth.login(dados.email, dados.senha);
        sessao.salvar(resultado);
        navegar(resultado.usuario.papel === "GESTOR" ? "/gestor/fila" : "/pacientes");
      } catch (erro) {
        mount($("[data-mensagem]", main), aviso("error", mensagemDeErro(erro)));
        botao.disabled = false;
      }
    });
  },
};
