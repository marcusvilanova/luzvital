"""Gera etiquetas sintéticas com gabarito, para testar o pipeline antes das fotos reais.

Não substitui as 30 a 50 fotos tiradas pelo grupo: serve para conferir o código e
mostrar o efeito de cada condição de falha (borrão, reflexo, corte, só V e A).

Uso: python -m avaliacao.gerar_sinteticas
"""

import csv
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

PASTA = Path("dados/sinteticas")
LARGURA, ALTURA = 900, 520
SEMENTE = 42

# fabricante, modelo, tensão (texto), corrente (texto), potência (texto ou None), potência esperada
APARELHOS = [
    ("PHILIPS RESPIRONICS", "EverFlo", "220 V~ 60 Hz", "1,5 A", "320 W", 320.0),
    ("PHILIPS", "Trilogy Evo", "100-240 V~ 50/60 Hz", "1,7-0,6 A", None, 170.0),
    ("OXIVIDA", "OX-5 Home", "127 V~ 60 Hz", "3,1 A", "390 W", 390.0),
    ("ASPIRAMED", "AS-300", "220 V~ 60 Hz", "0,5 A", "90 W", 90.0),
    ("INFUSA", "BI-20", "100-240 V~", "0,3-0,15 A", None, 30.0),
    ("NEBULAR", "NB Clean 2", "127 V~ 60 Hz", "1,2 A", "150 VA", 150.0),
    ("DIALIX", "HD Casa 4", "220 V~ 60 Hz", "6,8 A", "1500 W", 1500.0),
    ("MOVIDA", "CR-Power", "220 V~", "2 A", "440 W", 440.0),
]

CONDICOES = ["normal", "borrada", "reflexo", "parcial"]


def _fonte(tamanho: int) -> ImageFont.ImageFont:
    for nome in ("arialbd.ttf", "DejaVuSans-Bold.ttf", "Arial Bold.ttf"):
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default(size=tamanho)


def desenhar_etiqueta(fabricante: str, modelo: str, tensao: str, corrente: str, potencia: str | None) -> Image.Image:
    imagem = Image.new("RGB", (LARGURA, ALTURA), (236, 236, 230))
    desenho = ImageDraw.Draw(imagem)
    desenho.rectangle((20, 20, LARGURA - 20, ALTURA - 20), outline=(30, 30, 30), width=4)
    linhas = [
        (f"FABRICANTE: {fabricante}", 40),
        (f"MODELO: {modelo}", 44),
        (f"ENTRADA: {tensao}  {corrente}", 38),
    ]
    if potencia:
        linhas.append((f"POTÊNCIA: {potencia}", 38))
    linhas.append(("N/S: XX-0000000  IPX1", 26))
    y = 50
    for texto, tamanho in linhas:
        desenho.text((50, y), texto, fill=(20, 20, 20), font=_fonte(tamanho))
        y += tamanho + 40
    return imagem


def aplicar_condicao(imagem: Image.Image, condicao: str, aleatorio: random.Random) -> Image.Image:
    if condicao == "borrada":
        return imagem.filter(ImageFilter.GaussianBlur(radius=aleatorio.uniform(4, 6)))
    if condicao == "reflexo":
        camada = Image.new("L", imagem.size, 0)
        cx, cy = aleatorio.randint(250, 650), aleatorio.randint(150, 350)
        ImageDraw.Draw(camada).ellipse((cx - 260, cy - 110, cx + 260, cy + 110), fill=245)
        return Image.composite(Image.new("RGB", imagem.size, (255, 255, 255)), imagem,
                               camada.filter(ImageFilter.GaussianBlur(25)))
    if condicao == "parcial":
        return imagem.crop((0, 0, LARGURA // 2, ALTURA))
    return imagem.rotate(aleatorio.uniform(-4, 4), expand=True, fillcolor=(90, 90, 90))


def main() -> None:
    aleatorio = random.Random(SEMENTE)
    PASTA.mkdir(parents=True, exist_ok=True)
    linhas = []
    for indice, (fabricante, modelo, tensao, corrente, potencia, esperado) in enumerate(APARELHOS, start=1):
        base = desenhar_etiqueta(fabricante, modelo, tensao, corrente, potencia)
        for condicao in CONDICOES:
            nome_condicao = "so_va" if potencia is None and condicao == "normal" else condicao
            arquivo = f"sint_{indice:02d}_{nome_condicao}.jpg"
            aplicar_condicao(base, condicao, aleatorio).save(PASTA / arquivo, quality=88)
            # O gabarito é o que está impresso na etiqueta, mesmo quando a foto atrapalha a leitura:
            # assim a métrica mostra quanto cada condição derruba o acerto.
            linhas.append([arquivo, nome_condicao, "true", fabricante, modelo, esperado])
    linhas.append(_nao_etiqueta(aleatorio))
    with (PASTA / "gabarito.csv").open("w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["arquivo", "condicao", "legivel", "fabricante", "modelo", "potencia_w"])
        escritor.writerows(linhas)
    print(f"{len(linhas)} imagens em {PASTA}")


def _nao_etiqueta(aleatorio: random.Random) -> list[str]:
    imagem = Image.new("RGB", (LARGURA, ALTURA), (120, 160, 200))
    desenho = ImageDraw.Draw(imagem)
    for _ in range(12):
        x, y = aleatorio.randint(0, LARGURA), aleatorio.randint(0, ALTURA)
        desenho.ellipse((x, y, x + 80, y + 80), fill=(aleatorio.randint(0, 255), 120, 90))
    imagem.save(PASTA / "sint_99_nao_etiqueta.jpg", quality=88)
    return ["sint_99_nao_etiqueta.jpg", "nao_etiqueta", "false", "", "", ""]


if __name__ == "__main__":
    main()
