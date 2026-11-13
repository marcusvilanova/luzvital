import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bairroMaisProximo, coordenadasDe } from "../js/lib/bairros.js";
import { atendidaATempo, calcularImpacto } from "../js/lib/impacto.js";

const BASE = new Date("2026-11-12T10:00:00Z");
const em = (min) => new Date(BASE.getTime() + min * 60000).toISOString();
const ventilador = (autonomiaMin) => ({ tipo: "VENTILADOR", autonomiaMin, suporteVida: true, fonteReserva: "NENHUMA" });
const concentrador = (fonteReserva) => ({ tipo: "CONCENTRADOR", autonomiaMin: 0, suporteVida: true, fonteReserva });

function ocorrencia({ bairro = "Grajaú", status = "ENCERRADA", equipamentos = [ventilador(120)], atendidaEm = null }) {
  return {
    status, abertaEm: em(0), paciente: { bairro }, equipamentos,
    atendimentos: atendidaEm === null ? [] : [{ em: em(atendidaEm) }],
  };
}

describe("atendidaATempo", () => {
  it("chegou com bateria sobrando", () => {
    assert.equal(atendidaATempo(ocorrencia({ atendidaEm: 40 })), true);
    assert.equal(atendidaATempo(ocorrencia({ atendidaEm: 130 })), false);
  });
  it("aparelho sem bateria conta só com fonte reserva", () => {
    assert.equal(atendidaATempo(ocorrencia({ equipamentos: [concentrador("CILINDRO_OXIGENIO")], atendidaEm: 30 })), true);
    assert.equal(atendidaATempo(ocorrencia({ equipamentos: [concentrador("NENHUMA")], atendidaEm: 30 })), false);
  });
  it("sem atendimento não conta", () => {
    assert.equal(atendidaATempo(ocorrencia({})), false);
  });
});

describe("calcularImpacto", () => {
  const ocorrencias = [
    ocorrencia({ atendidaEm: 10 }),
    ocorrencia({ atendidaEm: 50 }),
    ocorrencia({ bairro: "Pedreira", atendidaEm: 150 }),
    ocorrencia({ bairro: "Pedreira", status: "ABERTA" }),
  ];
  const pontos = [
    { ativo: true, ...coordenadasDe("Grajaú") },
    { ativo: false, ...coordenadasDe("Grajaú") },
    { ativo: true, ...coordenadasDe("Pedreira") },
  ];
  const d = calcularImpacto(ocorrencias, pontos);

  it("totais e média de espera", () => {
    assert.equal(d.total, 4);
    assert.equal(d.abertas, 1);
    assert.equal(d.atendidas, 3);
    assert.equal(d.tempoMedioAtendimentoMin, 70);
  });
  it("percentual atendido antes de a bateria acabar", () => {
    assert.equal(d.percentualATempo, 67);
  });
  it("distribui a espera nas faixas sem perder ocorrências", () => {
    assert.deepEqual(d.distribuicaoEspera.map((f) => f.valor), [1, 0, 1, 0, 1]);
  });
  it("agrupa por bairro com as abertas e conta só pontos ativos", () => {
    assert.deepEqual(d.porBairro.find((b) => b.rotulo === "Pedreira"), { rotulo: "Pedreira", valor: 2, abertas: 1 });
    assert.deepEqual(d.pontosPorBairro, [{ rotulo: "Grajaú", valor: 1 }, { rotulo: "Pedreira", valor: 1 }]);
  });
  it("sem ocorrências devolve nulos em vez de dividir por zero", () => {
    const vazio = calcularImpacto([], []);
    assert.equal(vazio.tempoMedioAtendimentoMin, null);
    assert.equal(vazio.percentualATempo, null);
  });
});

describe("bairros", () => {
  it("acha o bairro pelo nome ignorando maiúsculas e o mais próximo de um ponto", () => {
    assert.deepEqual(coordenadasDe("capão redondo"), coordenadasDe("Capão Redondo"));
    assert.equal(coordenadasDe("Inexistente"), null);
    assert.equal(bairroMaisProximo({ lat: -23.661, lng: -46.78 }), "Capão Redondo");
  });
});
