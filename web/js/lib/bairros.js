// Centros aproximados de bairros da Zona Sul de São Paulo (área do piloto).
import { distanciaKm } from "./regras.js";

export const BAIRROS = {
  "Capão Redondo": { lat: -23.664, lng: -46.779 },
  "Jardim Ângela": { lat: -23.71, lng: -46.77 },
  "Grajaú": { lat: -23.76, lng: -46.695 },
  "Parelheiros": { lat: -23.827, lng: -46.727 },
  "Campo Limpo": { lat: -23.646, lng: -46.76 },
  "Santo Amaro": { lat: -23.654, lng: -46.71 },
  "Jardim São Luís": { lat: -23.683, lng: -46.745 },
  "Cidade Ademar": { lat: -23.676, lng: -46.651 },
  "Pedreira": { lat: -23.701, lng: -46.66 },
  "Cidade Dutra": { lat: -23.722, lng: -46.698 },
  "Socorro": { lat: -23.69, lng: -46.708 },
  "Jabaquara": { lat: -23.651, lng: -46.643 },
};

export const CENTRO_SP = { lat: -23.5505, lng: -46.6333 };

/** Coordenadas de um bairro pelo nome, sem diferenciar maiúsculas e acentos digitados iguais. */
export function coordenadasDe(nome) {
  const chave = Object.keys(BAIRROS).find((b) => b.toLowerCase() === String(nome ?? "").trim().toLowerCase());
  return chave ? BAIRROS[chave] : null;
}

/** Bairro conhecido mais próximo de um ponto (para agrupar relatórios). */
export function bairroMaisProximo(ponto) {
  return Object.entries(BAIRROS).reduce(
    (melhor, [nome, centro]) => {
      const d = distanciaKm(ponto, centro);
      return d < melhor.distancia ? { nome, distancia: d } : melhor;
    },
    { nome: "Outros", distancia: Infinity },
  ).nome;
}
