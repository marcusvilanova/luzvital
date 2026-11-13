import { icone } from "../../components/icones.js";
import { toast } from "../../components/toast.js";
import { aviso, cabecalho, campo, carregando } from "../../components/ui.js";
import { $, html, lerFormulario, mostrarErros, mount } from "../../lib/dom.js";
import { validar, validarCampos } from "../../lib/regras.js";
import { api } from "../../services/api.js";
import { ApiError, mensagemDeErro } from "../../services/erros.js";

function validarPaciente(dados) {
  return validarCampos(dados, {
    nome: [validar.nome],
    cep: [validar.cep],
    numero: [validar.obrigatorio("o número")],
    bairro: [validar.obrigatorio("o bairro")],
    contatoEmergencia: [validar.telefone],
  });
}

export default {
  titulo: "Paciente",
  async render({ main, params, navegar }) {
    const editando = Boolean(params.id);
    mount(main, carregando());
    let paciente = {};
    try {
      if (editando) paciente = await api.pacientes.obter(params.id);
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível abrir o paciente.", mensagemDeErro(erro)));
      return;
    }

    mount(main, html`
      ${cabecalho({
        voltar: editando ? `#/pacientes/${params.id}` : "#/pacientes",
        sobretitulo: editando ? "Editar paciente" : "Novo paciente",
        titulo: editando ? paciente.nome : "Quem depende do aparelho?",
        descricao: "Pedimos só o necessário para a equipe chegar até a casa. Use dados fictícios em testes.",
      })}
      <div class="split">
        <form novalidate class="tile" style="padding:var(--space-07) var(--space-06)">
          <div data-mensagem></div>
          ${campo({ nome: "nome", rotulo: "Nome do paciente", valor: paciente.nome })}
          <div class="field-grid" style="margin-top:var(--space-06)">
            ${campo({ nome: "cep", rotulo: "CEP", valor: paciente.cep, extra: 'inputmode="numeric" autocomplete="postal-code" placeholder="00000000"' })}
            ${campo({ nome: "numero", rotulo: "Número", valor: paciente.numero, extra: 'inputmode="numeric"' })}
          </div>
          ${campo({ nome: "bairro", rotulo: "Bairro", valor: paciente.bairro, ajuda: "Usado para achar pontos de energia próximos" })}
          ${campo({ nome: "contatoEmergencia", rotulo: "Telefone de emergência (outro familiar)", tipo: "tel", valor: paciente.contatoEmergencia, extra: 'inputmode="numeric" placeholder="11912345678"' })}
          <div class="btn-row" style="margin-top:var(--space-08)">
            <a class="btn btn-secondary" href="${editando ? `#/pacientes/${params.id}` : "#/pacientes"}">Cancelar</a>
            <button class="btn btn-primary" type="submit">Salvar ${icone("seta")}</button>
          </div>
        </form>
        <aside class="stack">
          ${aviso("info", "Por que pedimos isso?", "O endereço mostra à equipe onde ir e quais pontos de energia estão perto. O telefone de emergência é de outra pessoa da família.")}
          ${aviso("dark", "Dado sensível.", "Saúde e endereço são dados sensíveis pela LGPD. Só você e a equipe gestora veem.")}
        </aside>
      </div>`);

    const form = $("form", main);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dados = lerFormulario(form);
      if (!mostrarErros(form, validarPaciente(dados))) return;
      const botao = $('[type="submit"]', form);
      botao.disabled = true;
      try {
        const salvo = editando ? await api.pacientes.atualizar(params.id, dados) : await api.pacientes.criar(dados);
        toast("Paciente salvo.", "success");
        navegar(`/pacientes/${salvo.id}`);
      } catch (erro) {
        if (erro instanceof ApiError) mostrarErros(form, erro.campos);
        mount($("[data-mensagem]", form), aviso("error", mensagemDeErro(erro)));
        botao.disabled = false;
      }
    });
  },
};
