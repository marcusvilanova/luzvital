import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esc, html } from "../js/lib/dom.js";
import { duracao, relogio } from "../js/lib/formato.js";
import { planoPadrao } from "../js/lib/plano.js";
import {
  aparelhoCritico, distanciaKm, minutosRestantes, ordenarFila, pontosProximos, tempoAtendimentoMin, validar, validarCampos,
} from "../js/lib/regras.js";

const AGORA = new Date("2026-11-12T12:00:00Z");
const minAntes = (m) => new Date(AGORA - m * 60000).toISOString();
const concentrador = { id: "c", tipo: "CONCENTRADOR", autonomiaMin: 0, suporteVida: true };
const ventilador = { id: "v", tipo: "VENTILADOR", autonomiaMin: 900, suporteVida: true };
const cadeira = { id: "r", tipo: "CADEIRA_RODAS", autonomiaMin: 30, suporteVida: false };

describe("aparelhoCritico", () => {
  it("escolhe o de suporte à vida com menor autonomia, ignorando os demais", () => {
    assert.equal(aparelhoCritico([ventilador, cadeira]).id, "v");
    assert.equal(aparelhoCritico([ventilador, concentrador]).id, "c");
  });
  it("sem suporte à vida usa o de menor autonomia; lista vazia devolve null", () => {
    assert.equal(aparelhoCritico([cadeira]).id, "r");
    assert.equal(aparelhoCritico([]), null);
  });
});

describe("minutosRestantes", () => {
  it("desconta o tempo desde a abertura da autonomia do aparelho crítico", () => {
    assert.equal(minutosRestantes({ abertaEm: minAntes(50) }, [ventilador], AGORA), 850);
  });
  it("usa a bateria informada descontando o tempo desde a informação", () => {
    const o = { abertaEm: minAntes(100), bateriaInformadaMin: 70, bateriaAtualizadaEm: minAntes(5) };
    assert.equal(minutosRestantes(o, [ventilador], AGORA), 65);
  });
  it("nunca fica negativo", () => {
    assert.equal(minutosRestantes({ abertaEm: minAntes(10) }, [concentrador], AGORA), 0);
  });
});

describe("ordenarFila", () => {
  it("ordena por minutos, desempata ventilador antes de concentrador e depois por abertura", () => {
    const fila = ordenarFila([
      { id: "a", minutosRestantes: 600, tipoCritico: "VENTILADOR", abertaEm: minAntes(1) },
      { id: "d", minutosRestantes: 120, tipoCritico: "CONCENTRADOR", abertaEm: minAntes(30) },
      { id: "e", minutosRestantes: 120, tipoCritico: "VENTILADOR", abertaEm: minAntes(2) },
      { id: "b", minutosRestantes: 30, tipoCritico: "OUTRO", abertaEm: minAntes(3) },
    ]);
    assert.deepEqual(fila.map((o) => o.id), ["b", "e", "d", "a"]);
  });
  it("não altera a lista original", () => {
    const original = [{ minutosRestantes: 2 }, { minutosRestantes: 1 }];
    ordenarFila(original);
    assert.equal(original[0].minutosRestantes, 2);
  });
});

describe("pontosProximos", () => {
  const casa = { lat: -23.664, lng: -46.779 };
  const pontos = [
    { id: "longe", lat: -23.75, lng: -46.69, ativo: true },
    { id: "perto", lat: -23.668, lng: -46.776, ativo: true },
    { id: "inativo", lat: -23.665, lng: -46.78, ativo: false },
    { id: "medio", lat: -23.648, lng: -46.763, ativo: true },
  ];
  it("só ativos, dentro de 5 km, do mais perto ao mais longe", () => {
    assert.deepEqual(pontosProximos(casa, pontos).map((p) => p.id), ["perto", "medio"]);
  });
  it("calcula distância em km", () => {
    assert.ok(Math.abs(distanciaKm(casa, { lat: -23.674, lng: -46.779 }) - 1.11) < 0.02);
  });
});

describe("tempoAtendimentoMin", () => {
  it("minutos entre abertura e primeiro atendimento; null sem atendimento", () => {
    assert.equal(tempoAtendimentoMin({ abertaEm: minAntes(40), atendimentos: [{ em: AGORA.toISOString() }] }), 40);
    assert.equal(tempoAtendimentoMin({ abertaEm: minAntes(40), atendimentos: [] }), null);
  });
});

describe("validações (mensagens dos critérios de aceite)", () => {
  it("senha precisa de 8 caracteres com letra e número", () => {
    assert.ok(validar.senha("abc123"));
    assert.ok(validar.senha("somenteletras"));
    assert.equal(validar.senha("Luz2026ok"), null);
  });
  it("e-mail, telefone e CEP", () => {
    assert.equal(validar.email("ana@"), "E-mail inválido");
    assert.equal(validar.telefone("1199"), "Telefone inválido");
    assert.equal(validar.telefone("(11) 98765-4321"), null);
    assert.equal(validar.cep("0586"), "CEP inválido");
  });
  it("potência, autonomia, capacidade e coordenadas", () => {
    assert.equal(validar.potencia("0"), "Potência deve ser maior que zero");
    assert.equal(validar.autonomia("-10"), "Autonomia não pode ser negativa");
    assert.equal(validar.autonomia("0"), null);
    assert.equal(validar.capacidade("0"), "Capacidade deve ser maior que zero");
    assert.equal(validar.latitude("95"), "Localização inválida");
    assert.equal(validar.longitude("-200"), "Localização inválida");
  });
  it("validarCampos devolve só o primeiro erro de cada campo", () => {
    assert.deepEqual(validarCampos({ nome: "", email: "a@b.co" }, { nome: [validar.nome], email: [validar.email] }), { nome: "Informe o nome" });
  });
});

describe("formato", () => {
  it("duração e relógio", () => {
    assert.equal(duracao(0), "sem bateria");
    assert.equal(duracao(30), "30 min");
    assert.equal(duracao(95), "1h 35min");
    assert.equal(duracao(120), "2h");
    assert.equal(relogio(320), "05:20");
    assert.equal(relogio(-5), "00:00");
  });
});

describe("dom.html", () => {
  it("escapa valores interpolados (XSS) e preserva templates aninhados", () => {
    const nome = '<img src=x onerror="alert(1)">';
    const saida = html`<p>${nome}</p>${html`<b>ok</b>`}`;
    const texto = Object.values(saida)[0] ?? saida[Object.getOwnPropertySymbols(saida)[0]];
    assert.ok(texto.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
    assert.ok(texto.includes("<b>ok</b>"));
    assert.equal(esc("'"), "&#39;");
  });
});

describe("planoPadrao", () => {
  it("usa o aparelho crítico e começa por 'Imediatamente' quando não há bateria", () => {
    const plano = planoPadrao([concentrador, ventilador]);
    assert.equal(plano.minutosCriticos, 0);
    assert.equal(plano.etapas[0].faixa, "Imediatamente");
    assert.ok(plano.contatos.some((c) => c.numero === "192"));
  });
});
