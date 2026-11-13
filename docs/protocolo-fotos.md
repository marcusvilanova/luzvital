# Protocolo de coleta das fotos de etiqueta

Objetivo: 30 a 50 fotos reais de placas de dados de aparelhos elétricos, com o valor correto anotado,
para comparar as rotas OCR e multimodal.

## Divisão sugerida (5 integrantes × 8 fotos = 40)

Cada integrante fotografa **4 aparelhos** de casa e faz **2 fotos de cada** (uma boa e uma com falha).
Qualquer aparelho com etiqueta serve: fonte de notebook, carregador, micro-ondas, ventilador,
geladeira, secador, roteador, nebulizador, purificador. Se alguém tiver acesso a equipamento
médico (nebulizador, concentrador, aspirador), melhor ainda.

| Condição | Quantas (total) | Como fazer |
|---|---|---|
| `normal` | 15 | Etiqueta inteira, foco, luz boa, de frente |
| `borrada` | 6 | Tremer a mão ou fotografar fora de foco |
| `reflexo` | 6 | Flash ou lanterna batendo na etiqueta plástica |
| `parcial` | 6 | Cortar parte da etiqueta no enquadramento |
| `so_va` | 5 | Etiquetas que trazem só V e A, sem W (fontes e carregadores costumam ser assim) |
| `nao_etiqueta` | 2 | Foto de outra coisa (parede, capa do aparelho) |

## Regras

1. Enquadrar **só a etiqueta**. Nada de rosto, documento, endereço, tela de celular.
2. Nome do arquivo: `foto_01.jpg`, `foto_02.jpg`… em `dados/fotos/`.
3. Anotar em `dados/gabarito.csv` **o que está impresso na etiqueta**, lendo o aparelho, não a foto:
   - `fabricante` e `modelo` como aparecem.
   - `potencia_w`: o número em W ou VA. Se só houver V e A, calcular menor tensão × maior corrente
     (ex.: 100-240 V, 1,5 A → 150) e usar a condição `so_va`.
   - `legivel`: `true` para etiquetas; `false` só para `nao_etiqueta`.
   - Para `nao_etiqueta`, deixar fabricante, modelo e potência vazios.
4. Uma segunda pessoa confere 10 linhas do gabarito sorteadas.

## Depois de coletar

```bash
python -m avaliacao.avaliar --gabarito dados/gabarito.csv --pasta dados/fotos --titulo "Fotos reais"
```

Copiar a tabela de `avaliacao/resultados/relatorio.md` para a seção 5 do README e escrever a análise.
