# Etiquetas sintéticas — multimodal (gemini-3.5-flash-lite) x OCR

Acerto por rota e por condição da foto (gerado por `avaliacao/avaliar.py`).

## Rota multimodal

| condição | fotos | potencia | modelo | fabricante | legibilidade | potencia_inventada | tempo_medio_ms |
|---|---|---|---|---|---|---|---|
| geral | 31 | 93% (28/30) | 87% (26/30) | 80% (24/30) | 100% (31/31) | 0 | 3652 |
| borrada | 7 | 100% (7/7) | 100% (7/7) | 100% (7/7) | 100% (7/7) | 0 | 3063 |
| reflexo | 8 | 100% (8/8) | 100% (8/8) | 100% (8/8) | 100% (8/8) | 0 | 3506 |
| parcial | 8 | 75% (6/8) | 50% (4/8) | 25% (2/8) | 100% (8/8) | 0 | 3965 |
| so_va | 2 | 100% (2/2) | 100% (2/2) | 100% (2/2) | 100% (2/2) | 0 | 2418 |
| normal | 5 | 100% (5/5) | 100% (5/5) | 100% (5/5) | 100% (5/5) | 0 | 4004 |
| nao_etiqueta | 1 | — | — | — | 100% (1/1) | 0 | 7147 |

Fotos com erro de potência ou modelo: sint_02_parcial.jpg, sint_03_parcial.jpg, sint_05_parcial.jpg, sint_06_parcial.jpg, sint_07_parcial.jpg

## Rota ocr

| condição | fotos | potencia | modelo | fabricante | legibilidade | potencia_inventada | tempo_medio_ms |
|---|---|---|---|---|---|---|---|
| geral | 33 | 75% (24/32) | 69% (22/32) | 59% (19/32) | 94% (31/33) | 0 | 2988 |
| normal | 6 | 100% (6/6) | 100% (6/6) | 100% (6/6) | 100% (6/6) | 0 | 4145 |
| borrada | 8 | 50% (4/8) | 62% (5/8) | 50% (4/8) | 75% (6/8) | 0 | 3405 |
| reflexo | 8 | 75% (6/8) | 75% (6/8) | 88% (7/8) | 100% (8/8) | 0 | 3046 |
| parcial | 8 | 75% (6/8) | 38% (3/8) | 0% (0/8) | 100% (8/8) | 0 | 1927 |
| so_va | 2 | 100% (2/2) | 100% (2/2) | 100% (2/2) | 100% (2/2) | 0 | 2754 |
| nao_etiqueta | 1 | — | — | — | 100% (1/1) | 0 | 1187 |

Fotos com erro de potência ou modelo: sint_01_reflexo.jpg, sint_02_borrada.jpg, sint_02_parcial.jpg, sint_03_borrada.jpg, sint_03_reflexo.jpg, sint_03_parcial.jpg, sint_04_borrada.jpg, sint_04_reflexo.jpg, sint_05_borrada.jpg, sint_05_parcial.jpg, sint_06_borrada.jpg, sint_06_parcial.jpg, sint_07_reflexo.jpg, sint_07_parcial.jpg, sint_08_parcial.jpg
