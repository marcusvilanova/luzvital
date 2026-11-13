"""Gera os ícones PNG do app (PWA) a partir do traço da logo. Uso: python gerar-icones.py (precisa de Pillow)."""
from pathlib import Path

from PIL import Image, ImageDraw

PULSO = [(3, 18), (10, 18), (16, 5), (14, 16), (19.5, 16), (16.5, 28), (21, 18), (29, 18)]
AZUL, BRANCO = "#0f62fe", "#ffffff"
ESCALA = 4  # desenha maior e reduz, para bordas suaves
PASTA = Path(__file__).parent / "icones"


def desenhar(tamanho: int, margem: float) -> Image.Image:
    grande = tamanho * ESCALA
    img = Image.new("RGB", (grande, grande), AZUL)
    traco = ImageDraw.Draw(img)
    util = grande * (1 - 2 * margem)
    pontos = [(grande * margem + x / 32 * util, grande * margem + y / 32 * util) for x, y in PULSO]
    traco.line(pontos, fill=BRANCO, width=round(2.6 / 32 * util), joint="curve")
    return img.resize((tamanho, tamanho), Image.LANCZOS)


if __name__ == "__main__":
    for tamanho, margem, nome in [(192, 0, "icone-192"), (512, 0, "icone-512"), (512, 0.14, "icone-512-maskable")]:
        desenhar(tamanho, margem).save(PASTA / f"{nome}.png")
        print(f"icones/{nome}.png")
