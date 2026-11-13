"""Pré-processamento da foto: valida, corrige rotação, reduz e remove metadados (EXIF/GPS)."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

QUALIDADE_JPEG = 90


class ImagemInvalida(ValueError):
    pass


def preparar_imagem(conteudo: bytes, lado_maximo_px: int) -> bytes:
    """Devolve um JPEG novo, sem EXIF, com o maior lado limitado a `lado_maximo_px`."""
    try:
        with Image.open(io.BytesIO(conteudo)) as original:
            imagem = ImageOps.exif_transpose(original).convert("RGB")
    except (UnidentifiedImageError, OSError) as erro:
        raise ImagemInvalida("Arquivo não é uma imagem válida") from erro

    imagem.thumbnail((lado_maximo_px, lado_maximo_px))
    saida = io.BytesIO()
    # Salvar sem o parâmetro exif descarta localização e dados do celular.
    imagem.save(saida, format="JPEG", quality=QUALIDADE_JPEG)
    return saida.getvalue()
