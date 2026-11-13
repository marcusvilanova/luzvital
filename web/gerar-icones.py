"""Gera os ícones PNG do app (PWA) a partir do traço da logo (batimento cardíaco). Uso: python gerar-icones.py (precisa de Pillow)."""
from pathlib import Path

from PIL import Image, ImageDraw

PULSO = [(2, 18), (6.5, 18), (8, 15.5), (9.5, 18), (11.5, 18), (12.5, 21), (15, 4), (17.5, 27), (19, 18), (21, 18), (23.5, 13.5), (26, 18), (30, 18)]
AZUL, BRANCO = "#0f62fe", "#ffffff"
ESCALA = 4  # desenha maior e reduz, para bordas suaves
PASTA = Path(__file__).parent / "icones"


def desenhar(tamanho: int, margem: float) -> Image.Image:
    grande = tamanho * ESCALA
    img = Image.new("RGB", (grande, grande), AZUL)
    traco = ImageDraw.Draw(img)
    util = grande * (1 - 2 * margem)
    pontos = [(grande * margem + x / 32 * util, grande * margem + y / 32 * util) for x, y in PULSO]
    traco.line(pontos, fill=BRANCO, width=round(2.2 / 32 * util), joint="curve")
    return img.resize((tamanho, tamanho), Image.LANCZOS)


if __name__ == "__main__":
    for tamanho, margem, nome in [(192, 0, "icone-192"), (512, 0, "icone-512"), (512, 0.14, "icone-512-maskable")]:
        desenhar(tamanho, margem).save(PASTA / f"{nome}.png")
        print(f"icones/{nome}.png")
