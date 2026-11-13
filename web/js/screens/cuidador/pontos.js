import { listaPontos } from "../../components/ocorrencia.js";
import { aviso, cabecalho, carregando, vazio } from "../../components/ui.js";
import { $, html, mount } from "../../lib/dom.js";
import { api } from "../../services/api.js";
import { mensagemDeErro } from "../../services/erros.js";

export default {
  titulo: "Pontos de energia",
  async render({ main, consulta }) {
    mount(main, carregando());
    let pacientes;
    try {
      pacientes = (await api.pacientes.listar(0, 50)).itens;
    } catch (erro) {
      mount(main, aviso("error", "Não foi possível carregar.", mensagemDeErro(erro)));
      return;
    }
    if (!pacientes.length) {
      mount(main, html`${cabecalho({ titulo: "Pontos de energia" })}
        ${vazio("Cadastre um paciente primeiro", "Mostramos os pontos de energia perto do endereço do paciente.", html`<a class="btn btn-primary" href="#/pacientes/novo">Adicionar paciente</a>`)}`);
      return;
    }
    const selecionado = pacientes.find((p) => p.id === consulta.get("paciente")) ?? pacientes[0];

    mount(main, html`
      ${cabecalho({
        sobretitulo: "Vizinhos, condomínios e comércios com gerador ou bateria",
        titulo: "Pontos de energia",
        descricao: "Pontos ativos num raio de 5 km do endereço do paciente, do mais perto para o mais longe.",
      })}
      ${pacientes.length > 1 ? html`<nav class="tabs" aria-label="Paciente">${pacientes.map((p) =>
        html`<a href="#/pontos?paciente=${p.id}" ${p.id === selecionado.id ? 'aria-current="page"' : ""}>${p.nome}</a>`)}</nav>` : ""}
      <div class="split">
        <section data-lista aria-live="polite">${carregando("Buscando pontos próximos...")}</section>
        <aside class="stack">
          ${aviso("info", "Vai até um ponto?", "Ligue antes para confirmar que há energia e leve os cabos e o carregador do aparelho.")}
          <p class="muted" style="font-size:var(--text-body-sm)">Os pontos são cadastrados pela equipe gestora. Quer oferecer energia na sua rua? Fale com a Defesa Civil.</p>
        </aside>
      </div>`);

    try {
      const pontos = await api.pontos.proximosDoPaciente(selecionado.id);
      mount($("[data-lista]", main), html`<p class="eyebrow" style="margin-bottom:var(--space-03)">Perto de ${selecionado.bairro}</p>${listaPontos(pontos)}`);
    } catch (erro) {
      mount($("[data-lista]", main), aviso("error", "Não foi possível buscar os pontos.", mensagemDeErro(erro)));
    }
  },
};
