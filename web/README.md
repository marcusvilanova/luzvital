# Luz Vital — Front-end web

HTML, CSS e JavaScript puros (módulos ES, sem framework e sem build). Identidade visual inspirada no
IBM Design Language / Carbon: IBM Plex Sans e Mono, grid de 2x, cantos retos, azul interativo,
tema claro (White) e escuro (Gray 100). O vermelho de alerta aparece só no botão **Estou sem luz**.

Grupo **Mind-Dev** · Global Solution 2026/2.

## Rodar

```bash
python servidor-dev.py        # http://localhost:5500 (sem cache, bom para desenvolver)
# ou
npm start                     # usa o pacote serve
```

Abrir direto o `index.html` pelo explorador não funciona: módulos ES exigem servidor HTTP.

Usuários de teste (modo demonstração):

| Papel | E-mail | Senha |
|---|---|---|
| Cuidador | cuidador.ana@teste.com | Luz2026ok |
| Cuidador | cuidador.bruno@teste.com | Luz2026ok |
| Gestor | gestor.defesa@teste.com | Gestor2026ok |

Os dados ficam no `localStorage` do navegador. **Sobre > Restaurar dados de demonstração** volta ao início.

## Roteiro de demonstração (pitch)

1. Abra duas janelas lado a lado: o **gestor** numa, a **cuidadora Ana** na outra (cada aba tem sua própria sessão).
2. Na fila do gestor, toque em **Simular apagão**: 30 casas sem luz aparecem na fila e no mapa, e 40 ocorrências
   encerradas alimentam o painel de **Impacto**.
3. Na janela da Ana, abra *Seu José Teste* e toque em **Estou sem luz**. Em 1 a 2 segundos o gestor recebe o aviso
   "Nova ocorrência" e a linha entra na posição certa da fila (concentrador sem bateria vai para o topo).
4. O gestor abre a ocorrência, aciona o ponto de energia e registra o atendimento; a tela da Ana mostra
   "A equipe registrou um atendimento" e a linha do tempo se atualiza sozinha.
5. Mostre o plano de contingência com **Ouvir plano** e o botão **Aa** (letra grande e alto contraste).

## Telas

| Rota | Papel | O que faz |
|---|---|---|
| `#/login`, `#/cadastro` | público | Entrar; criar conta de cuidador com aceite do termo (LGPD) |
| `#/pacientes` | cuidador | Lista paginada de pacientes com estado (ocorrência aberta, faltam aparelhos) |
| `#/pacientes/novo`, `/:id/editar` | cuidador | Cadastro com dados mínimos |
| `#/pacientes/:id` | cuidador | Botão **Estou sem luz**, aparelhos, histórico, atalhos |
| `#/pacientes/:id/aparelhos/novo` | cuidador | Foto da etiqueta → leitura por IA → confirmação; ou digitação |
| `#/aparelhos/:id/editar` | cuidador | Editar e excluir aparelho |
| `#/pacientes/:id/plano` | cuidador | Plano de contingência; guardado no aparelho e mostrado sem internet |
| `#/ocorrencias/:id` | cuidador | Contagem regressiva, atualizar bateria, encerrar, pontos próximos, acompanhamento |
| `#/pontos` | cuidador | Pontos de energia até 5 km de cada paciente |
| `#/gestor/fila` | gestor | Indicadores, fila por bateria restante, mapa e simulador de apagão |
| `#/gestor/impacto` | gestor | Painel de impacto com gráficos |
| `#/gestor/ocorrencias/:id` | gestor | Registrar atendimento, acionar ponto, atualizar bateria, encerrar |
| `#/gestor/pontos`, `/novo`, `/:id` | gestor | Cadastro, edição e ativação de pontos de energia |
| `#/sobre` | todos | Integrantes, versão/commit, aviso legal |

## Recursos

- **Simulador de apagão em massa** (modo demonstração): cria ocorrências abertas e histórico em 12 bairros da Zona Sul,
  com pacientes marcados como "simulado". *Limpar simulação* remove tudo o que foi criado.
- **Tempo real entre janelas:** no modo demonstração, outra aba que muda os dados avisa as telas abertas na hora
  (evento `storage`); com backend real, as telas fazem busca a cada 30 s.
- **Mapa do gestor** (Leaflet 1.9.4 + OpenStreetMap, com SRI): ocorrências coloridas pela bateria e pontos de energia
  com raio de 5 km. A biblioteca só é baixada quando o mapa abre; no tema escuro os blocos do mapa são invertidos.
- **Painel de impacto:** tempo médio até o atendimento, % atendidas antes de a bateria acabar, distribuição da espera,
  ocorrências e pontos por bairro, pacientes por aparelho crítico. Gráficos em HTML/SVG, sem biblioteca.
- **PWA:** instalável (manifesto e ícones) e com service worker. Arquivos do app: rede primeiro e cache quando cai o
  sinal; APIs nunca são guardadas. Depois de criar ou renomear arquivos, rode `npm run sw` para atualizar a lista.
- **Acessibilidade:** botão **Aa** (letra 19 px e alto contraste), **Ouvir plano** (voz em pt-BR), alerta com
  vibração e bipe quando a bateria fica abaixo de 60 minutos, foco no título a cada troca de tela.

## Regras já implementadas no front

- **Prioridade:** menor bateria restante do aparelho de suporte à vida, descontado o tempo; empate:
  ventilador antes de concentrador (`js/lib/regras.js`).
- **Idempotência:** o pedido "Estou sem luz" usa uma `Idempotency-Key` estável por paciente; toque duplo
  e reenvio não duplicam.
- **Sem sinal:** o pedido fica em fila no aparelho (`js/services/fila-offline.js`) e é reenviado com a
  mesma chave quando a conexão volta. O plano de contingência fica salvo para leitura offline.
- **Papéis:** o roteador bloqueia telas do outro papel; o mock devolve 401/403 como o backend.
- **Validações** com as mesmas mensagens dos critérios de aceite do Azure Boards.
- **Segurança:** todo texto vindo da API é escapado (`html```` em `js/lib/dom.js`); nenhum `innerHTML` com dado cru.

## Publicar na Vercel

1. Na Vercel, **Add New > Project** e importe o repositório `luzvital`.
2. Em **Root Directory**, escolha **`web`** (importante: na raiz está o serviço de IA em Python, que não vai para a Vercel).
3. **Framework Preset:** *Other*. Os comandos já vêm do `web/vercel.json` (site estático, sem build). Clique em **Deploy**.

O `vercel.json` aplica a política de segurança (CSP liberando só Google Fonts, Leaflet no unpkg e os blocos do
OpenStreetMap), `nosniff`, `Referrer-Policy`, `Permissions-Policy` e bloqueio de iframe. O `index.html`, o
`manifest` e o `sw.js` saem com `no-cache`, para cada deploy chegar na hora aos usuários do app instalado.
O `.vercelignore` deixa de fora testes, documentação e scripts Python.

`python servidor-dev.py` usa os mesmos cabeçalhos do `vercel.json`, então o que funciona localmente funciona publicado.
Na Vercel o site abre em **modo demonstração**; para usar as APIs, siga a seção abaixo e libere a URL da Vercel no CORS
das APIs (que precisam estar em HTTPS).

## Ligar ao backend

1. Em `js/config.js`, troque `MODO` para `"api"` e ajuste `API_JAVA` e `API_DOTNET`.
2. Implemente as rotas de [docs/CONTRATO-API.md](docs/CONTRATO-API.md) (o `api-mock.js` é a referência executável).
3. Libere CORS nas duas APIs para a origem do front.

## Estrutura

```
index.html
css/        tokens.css (cores, tipo, espaço) · base.css · layout.css (shell) · components.css
js/
  app.js            inicialização, tema, reenvio offline
  router.js         rotas por hash com guarda de papel
  config.js         modo mock/api e URLs
  lib/              regras de negócio puras, formatação, template seguro, plano padrão
  services/         api.js (escolhe mock ou http), api-http.js, api-mock.js, mock-db.js, sessão, fila offline
  components/       shell, ícones, modal, toast, peças da ocorrência
  screens/          acesso/, cuidador/, gestor/, sobre.js
tests/      regras.test.js (node --test)
```

## Testes

```bash
npm test     # 26 testes: prioridade, minutos restantes, proximidade, validações, escape de HTML, indicadores de impacto
```
