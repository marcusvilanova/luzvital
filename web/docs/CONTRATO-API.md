# Contrato de API do front-end Luz Vital

O front chama só `js/services/api.js`. Com `MODO: "api"` em `js/config.js`, cada função vira uma
requisição HTTP (`js/services/api-http.js`). O modo `"mock"` (`api-mock.js`) já aplica as mesmas
regras e devolve os mesmos formatos: use-o como especificação executável.

Todas as rotas, exceto login e cadastro, recebem `Authorization: Bearer <JWT>`.
Campos em **camelCase**. Datas em ISO 8601 (`2026-11-12T17:14:00Z`).

## Erros (formato único)

```json
{ "status": 400, "mensagem": "Confira os dados informados.", "campos": { "potenciaW": "Potência deve ser maior que zero" } }
```

O front também aceita `message`, `detail`/`title` (ProblemDetails do .NET) e `errors` com arrays.
`429` deve trazer o cabeçalho `Retry-After`. Em `409` de ocorrência duplicada, devolva `ocorrenciaId`.

## API Java (Spring Boot) — `CONFIG.API_JAVA`

| Método | Rota | Papel | Corpo / retorno |
|---|---|---|---|
| POST | `/auth/login` | público | `{email, senha}` → `{token, usuario:{id,nome,email,telefone,papel}, expiraEm}` |
| POST | `/auth/cadastro` | público | `{nome,email,telefone,senha,aceiteTermo}` → usuário (201). E-mail repetido: 409 |
| GET | `/pacientes?page=0&size=10` | CUIDADOR (só os seus) | `{itens:[Paciente + totalAparelhos, temSuporteVida, ocorrenciaAbertaId], total, pagina, tamanho}` |
| GET | `/pacientes/{id}` | dono ou GESTOR | Paciente + `equipamentos[]` + `ocorrenciaAbertaId` |
| POST / PUT | `/pacientes`, `/pacientes/{id}` | CUIDADOR | `{nome,cep,numero,bairro,contatoEmergencia}` → Paciente (com `lat`,`lng` geocodificados) |
| GET | `/pacientes/{id}/plano` | dono | Plano (abaixo). Sem aparelhos: 409 |
| GET | `/pacientes/{id}/ocorrencias` | dono ou GESTOR | Ocorrência[] (mais recente primeiro) |
| GET | `/pacientes/{id}/pontos-proximos` | dono | PontoEnergia[] com `distanciaKm`, só ativos até 5 km |
| GET / POST / PUT / DELETE | `/equipamentos`, `/equipamentos/{id}` | CUIDADOR dono | Equipamento. DELETE com ocorrência aberta: 409 |
| POST | `/equipamentos/leitura-etiqueta` | autenticado | multipart `foto` → Leitura. Repassa ao serviço de IA (`luz-vital-ia`) |
| GET | `/ocorrencias/fila` | GESTOR | Ocorrência[] abertas, ordenadas (menor bateria primeiro) |
| GET | `/relatorios/impacto` | GESTOR | `{total, abertas, encerradas, atendidas, tempoMedioAtendimentoMin, percentualATempo, distribuicaoEspera[], porBairro[{rotulo,valor,abertas}], porTipoAparelho[], pontosPorBairro[]}`. Cálculo de referência: `js/lib/impacto.js` |
| GET | `/relatorios/painel` | GESTOR | `{atividade: [{tipo, em, texto, por, ocorrenciaId, paciente, bairro}], aberturas24h: [{hora, valor}] (24 itens), cobertura: [{bairro, abertas, criticas, pontos, semPonto}]}`. Referência: `js/lib/painel.js` |
| GET | `/ocorrencias/indicadores` | GESTOR | `{abertas, criticas, semAtendimento, tempoMedioAtendimentoMin, pontosAtivos}` |
| POST | `/ocorrencias/{id}/acionamentos` | GESTOR | `{pontoId}` → Ocorrência. Já acionado: 409 |
| POST | `/ocorrencias/{id}/atendimentos` | GESTOR | `{acao, observacao}` → Ocorrência (201) |
| GET | `/ocorrencias/{id}/pontos-proximos` | GESTOR | PontoEnergia[] com `distanciaKm` |
| GET / POST / PUT | `/pontos-energia`, `/pontos-energia/{id}` | GESTOR (GET: autenticado) | PontoEnergia |
| PATCH | `/pontos-energia/{id}/status` | GESTOR | `{ativo}` → PontoEnergia |

## API .NET — `CONFIG.API_DOTNET`

| Método | Rota | Papel | Corpo / retorno |
|---|---|---|---|
| POST | `/ocorrencias` | CUIDADOR dono | Cabeçalho `Idempotency-Key`. `{pacienteId}` → Ocorrência (201). Repetição: mesma ocorrência. Outra aberta: 409 + `ocorrenciaId`. Sem aparelho de suporte à vida: 400. Excesso: 429 |
| GET | `/ocorrencias/{id}` | dono ou GESTOR | Ocorrência |
| PATCH | `/ocorrencias/{id}/bateria` | dono ou GESTOR | `{minutosRestantes}` (0 até a autonomia) → Ocorrência. Encerrada: 409 |
| POST | `/ocorrencias/{id}/encerramento` | dono ou GESTOR | `{resultado: LUZ_VOLTOU \| ATENDIDO \| REMOVIDO}` → Ocorrência. Já encerrada: 409 |

## Formatos

```js
Paciente      { id, cuidadorId, nome, cep, numero, bairro, contatoEmergencia, lat, lng }
Equipamento   { id, pacienteId, tipo, fabricante, modelo, tensaoV, correnteA, potenciaW, potenciaEstimada,
                autonomiaMin, suporteVida, fonteReserva }
  tipo:         VENTILADOR | CONCENTRADOR | BOMBA_INFUSAO | ASPIRADOR | DIALISE | CADEIRA_RODAS | OUTRO
  fonteReserva: NENHUMA | CILINDRO_OXIGENIO | BATERIA_EXTERNA | GERADOR | OUTRA
PontoEnergia  { id, nome, tipoFonte: GERADOR|BATERIA|TOMADA, capacidadeW, telefone, endereco, lat, lng, ativo }
Ocorrencia    { id, pacienteId, cuidadorId, status: ABERTA|ENCERRADA, abertaEm, bateriaInformadaMin, bateriaAtualizadaEm,
                encerradaEm, resultado, encerradaPor, pontosAcionados: [pontoId],
                atendimentos: [{ acao, observacao, em, por }], eventos: [{ tipo, em, texto, por }],
                paciente: Paciente + { cuidadorNome, cuidadorTelefone }, equipamentos: Equipamento[],
                aparelhoCritico: Equipamento, minutosRestantes, tempoAtendimentoMin }
  acao:         GERADOR | RECARGA | REMOCAO | RELIGACAO | CONTATO
Leitura       { legivel, fabricante, modelo, tensaoV, correnteA, potenciaW, potenciaEstimada, observacao, precisaConfirmacao }
Plano         { resumo, etapas: [{ faixa, acoes[] }], quandoPedirAjuda[], sinaisAlerta[], minutosCriticos, aparelhoCritico,
                contatos: [{ nome, numero, quando }], aviso, origem: ia|modelo_padrao, geradoEm }
```

O serviço de IA (`luz-vital-ia`) responde em snake_case (`tensao_v`, `quando_pedir_ajuda`): a API Java
converte para camelCase ao repassar.

## CORS

As duas APIs precisam liberar a origem do front (ex.: `http://localhost:5500`) com os cabeçalhos
`Authorization`, `Content-Type` e `Idempotency-Key`, e expor `Retry-After`.
