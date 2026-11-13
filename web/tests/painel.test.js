import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coordenadasDe } from "../js/lib/bairros.js";
import { aberturasPorHora, atividadeRecente, coberturaPorBairro } from "../js/lib/painel.js";
import { prontidao, saudacao } from "../js/lib/prontidao.js";

const AGORA = new Date("2026-11-13T15:00:00Z");
const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();

describe("atividadeRecente", () => {
  it("junta eventos de várias ocorrências, do mais novo ao mais antigo, com o nome do paciente", () => {
    const ocorrencias = [
      { id: "a", paciente: { nome: "A", bairro: "Grajaú" }, eventos: [{ tipo: "ABERTURA", em: ha(50) }, { tipo: "ATENDIMENTO", em: ha(10) }] },
      { id: "b", paciente: { nome: "B", bairro: "Pedreira" }, eventos: [{ tipo: "ABERTURA", em: ha(20) }] },
    ];
    const lista = atividadeRecente(ocorrencias, 2);
    assert.deepEqual(lista.map((e) => [e.paciente, e.tipo]), [["A", "ATENDIMENTO"], ["B", "ABERTURA"]]);
  });
});

describe("aberturasPorHora", () => {
  it("conta nas 24 posições e ignora o que tem mais de 24 h", () => {
    const horas = aberturasPorHora([{ abertaEm: ha(5) }, { abertaEm: ha(30) }, { abertaEm: ha(70) }, { abertaEm: ha(60 * 30) }], AGORA);
    assert.equal(horas.length, 24);
    assert.equal(horas[23].valor, 2);
    assert.equal(horas[22].valor, 1);
    assert.equal(horas.reduce((s, h) => s + h.valor, 0), 3);
  });
});

describe("coberturaPorBairro", () => {
  it("marca o bairro com casa sem luz e sem ponto ativo e o coloca primeiro", () => {
    const ocorrencias = [
      { status: "ABERTA", paciente: { bairro: "Grajaú" }, minutosRestantes: 30 },
      { status: "ABERTA", paciente: { bairro: "Pedreira" }, minutosRestantes: 300 },
      { status: "ABERTA", paciente: { bairro: "Pedreira" }, minutosRestantes: 10 },
      { status: "ENCERRADA", paciente: { bairro: "Socorro" } },
    ];
    const pontos = [{ ativo: true, ...coordenadasDe("Grajaú") }, { ativo: false, ...coordenadasDe("Pedreira") }];
    const cobertura = coberturaPorBairro(ocorrencias, pontos);
    assert.deepEqual(cobertura[0], { bairro: "Pedreira", abertas: 2, criticas: 1, pontos: 0, semPonto: true });
    assert.deepEqual(cobertura[1], { bairro: "Grajaú", abertas: 1, criticas: 1, pontos: 1, semPonto: false });
    assert.equal(cobertura.some((c) => c.bairro === "Socorro"), false);
  });
});

describe("prontidao", () => {
  const paciente = { id: "p1" };
  it("paciente bem preparado fica com 100%", () => {
    const r = prontidao(paciente, [{ id: "e1", tipo: "CONCENTRADOR", autonomiaMin: 0, suporteVida: true, fonteReserva: "CILINDRO_OXIGENIO" }],
      { planoSalvo: true, pontosProximos: 2 });
    assert.equal(r.percentual, 100);
    assert.equal(r.itens.find((i) => i.id === "ponto").texto, "2 pontos de energia a até 5 km");
  });
  it("aponta o que falta, com o link para resolver", () => {
    const r = prontidao(paciente, [{ id: "e1", tipo: "VENTILADOR", autonomiaMin: 60, suporteVida: true, fonteReserva: "NENHUMA" }],
      { planoSalvo: false, pontosProximos: 0 });
    assert.equal(r.percentual, 25);
    assert.equal(r.itens.find((i) => i.id === "reserva").acao, "#/aparelhos/e1/editar");
  });
  it("sem aparelhos nada está pronto, exceto o que não depende deles", () => {
    const r = prontidao(paciente, [], { planoSalvo: false, pontosProximos: 1 });
    assert.equal(r.feitos, 1);
    assert.equal(r.critico, null);
  });
  it("bateria longa conta como reserva", () => {
    const r = prontidao(paciente, [{ id: "e1", tipo: "VENTILADOR", autonomiaMin: 900, suporteVida: true, fonteReserva: "NENHUMA" }],
      { planoSalvo: true, pontosProximos: 1 });
    assert.equal(r.percentual, 100);
  });
});

describe("saudacao", () => {
  it("muda com a hora do dia", () => {
    assert.equal(saudacao(new Date(2026, 10, 13, 8)), "Bom dia");
    assert.equal(saudacao(new Date(2026, 10, 13, 14)), "Boa tarde");
    assert.equal(saudacao(new Date(2026, 10, 13, 21)), "Boa noite");
  });
});

describe("resumoPendencias", async () => {
  const { resumoPendencias } = await import("../js/lib/prontidao.js");
  const semPlano = (id) => prontidao({ id }, [{ id: "e", tipo: "VENTILADOR", autonomiaMin: 900, suporteVida: true, fonteReserva: "NENHUMA" }], { planoSalvo: false, pontosProximos: 0 });
  it("agrupa a mesma pendência de vários pacientes e ignora ponto de energia", () => {
    assert.equal(resumoPendencias([{ nome: "Seu José", pront: semPlano("a") }, { nome: "Dona Maria", pront: semPlano("b") }]),
      "Falta salvar o plano de contingência de Seu José e Dona Maria.");
  });
  it("sem pendências devolve null", () => {
    const ok = prontidao({ id: "c" }, [{ id: "e", tipo: "VENTILADOR", autonomiaMin: 900, suporteVida: true, fonteReserva: "GERADOR" }], { planoSalvo: true, pontosProximos: 0 });
    assert.equal(resumoPendencias([{ nome: "X", pront: ok }]), null);
  });
});
