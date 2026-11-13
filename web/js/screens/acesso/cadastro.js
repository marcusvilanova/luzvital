import { abrirModal } from "../../components/modal.js";
import { icone } from "../../components/icones.js";
import { toast } from "../../components/toast.js";
import { aviso, campo } from "../../components/ui.js";
import { $, html, lerFormulario, mostrarErros, mount } from "../../lib/dom.js";
import { validar, validarCampos } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro } from "../../services/erros.js";
import { molduraAcesso } from "./layout.js";

const TERMO = html`<div class="stack" style="font-size:var(--text-body-sm)">
  <p><strong>Versão 1.0.</strong> O Luz Vital guarda dados pessoais e de saúde (aparelhos usados pelo paciente)
  só para organizar o socorro em caso de falta de energia.</p>
  <p>Pedimos o mínimo: nome, endereço, contato de emergência e dados dos aparelhos. Os dados são vistos pelo
  cuidador e pela equipe gestora (Defesa Civil, atenção domiciliar ou distribuidora) e não são vendidos.</p>
  <p>Você pode pedir a correção ou a exclusão dos dados a qualquer momento (LGPD, art. 18).</p>
  <p><strong>O Luz Vital não substitui o 192, o 193 nem o canal da distribuidora e não dá orientação clínica.</strong></p>
</div>`;

function validarCadastro(dados) {
  const erros = validarCampos(dados, {
    nome: [validar.nome], email: [validar.email], telefone: [validar.telefone], senha: [validar.senha],
  });
  if (!erros.senha && dados.senha !== dados.confirmacao) erros.confirmacao = "As senhas não conferem";
  return erros;
}

export default {
  titulo: "Criar conta",
  render({ main, navegar }) {
    mount(main, molduraAcesso(html`
      <p class="eyebrow">Cuidador</p>
      <h1 tabindex="-1" data-titulo style="margin:var(--space-03) 0">Criar conta</h1>
      <p class="muted" style="margin-bottom:var(--space-07)">Já tem conta? <a href="#/login">Entrar</a></p>
      <div data-mensagem></div>
      <form novalidate style="margin-top:var(--space-05)">
        ${campo({ nome: "nome", rotulo: "Nome completo", extra: 'autocomplete="name"' })}
        <div class="field-grid" style="margin-top:var(--space-06)">
          ${campo({ nome: "email", rotulo: "E-mail", tipo: "email", extra: 'autocomplete="email" inputmode="email"' })}
          ${campo({ nome: "telefone", rotulo: "Celular com DDD", tipo: "tel", extra: 'autocomplete="tel" inputmode="numeric" placeholder="11987654321"' })}
        </div>
        <div class="field-grid" style="margin-top:var(--space-06)">
          ${campo({ nome: "senha", rotulo: "Senha", tipo: "password", ajuda: "8 caracteres ou mais, com letra e número", extra: 'autocomplete="new-password"' })}
          ${campo({ nome: "confirmacao", rotulo: "Confirme a senha", tipo: "password", extra: 'autocomplete="new-password"' })}
        </div>
        <label class="checkbox" style="margin-top:var(--space-07)">
          <input type="checkbox" name="aceiteTermo">
          <span>Li e aceito o <a href="#" data-termo>termo de uso e privacidade</a>.</span>
        </label>
        <button class="btn btn-primary btn-block" type="submit" disabled style="margin-top:var(--space-07)">Cadastrar ${icone("seta")}</button>
      </form>`));

    const form = $("form", main);
    const botao = $('[type="submit"]', form);
    form.elements.aceiteTermo.addEventListener("change", (e) => { botao.disabled = !e.target.checked; });
    $("[data-termo]", main).addEventListener("click", (e) => {
      e.preventDefault();
      abrirModal({ titulo: "Termo de uso e privacidade", corpo: TERMO, confirmar: "Entendi", cancelar: "Fechar" });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = lerFormulario(form);
      if (!dados.aceiteTermo) return;
      if (!mostrarErros(form, validarCadastro(dados))) return;
      botao.disabled = true;
      try {
        const { confirmacao, ...envio } = dados;
        await api.auth.cadastrar(envio);
        toast("Conta criada. Entre com seu e-mail e senha.", "success");
        navegar("/login");
      } catch (erro) {
        if (erro instanceof ApiError && Object.keys(erro.campos).length) mostrarErros(form, erro.campos);
        mount($("[data-mensagem]", main), aviso("error", mensagemDeErro(erro)));
        botao.disabled = false;
      }
    });
  },
};
