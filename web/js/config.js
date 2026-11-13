// Para ligar ao backend real: troque MODO para "api" e ajuste as URLs.
// No modo "mock", tudo roda no navegador com dados de teste (localStorage), sem servidor.
export const CONFIG = Object.freeze({
  MODO: "mock",
  API_JAVA: "http://localhost:8080",   // Spring Boot: auth, pacientes, equipamentos, pontos, fila, IA
  API_DOTNET: "http://localhost:5080", // .NET: abrir, atualizar bateria e encerrar ocorrência
  VERSAO: "1.0.0",
  COMMIT: "dev",                       // substituir pelo hash do commit no build
  LIMITE_ABERTURAS_POR_MINUTO: 5,
});
