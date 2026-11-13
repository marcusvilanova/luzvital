"""As duas rotas de leitura da etiqueta comparadas no projeto.

- multimodal: a foto vai direto ao Gemini, que devolve JSON no schema LeituraEtiqueta.
- ocr: RapidOCR (modelo local de detecção + reconhecimento de texto) e regras de regex.
"""

import io
import time
from typing import Protocol

import numpy as np
from PIL import Image

from app.gemini import imagem_para_parte
from app.regras import consolidar, extrair_de_texto
from app.schemas import LeituraEtiqueta, ResultadoLeitura

PROMPT_ETIQUETA = """Você lê a etiqueta de identificação (placa de dados) de um aparelho elétrico,
geralmente um equipamento médico de uso doméstico. Extraia apenas o que está escrito na imagem.

Regras:
- Não invente. Campo ausente, cortado ou ilegível = null.
- tensao_v: se houver faixa (ex.: 100-240 V), devolva o menor valor.
- corrente_a: se houver faixa (ex.: 1,7-0,6 A), devolva o maior valor. Converta mA para A.
- potencia_w: preencha só se a etiqueta trouxer W ou VA escrito. Nunca calcule.
- legivel=false se a imagem não for uma etiqueta, ou se borrão/reflexo impedir ler o modelo
  e também os dados elétricos. Explique o motivo em observacao.
- Não devolva número de série, código de barras, nome de pessoa ou endereço.
"""


class Gerador(Protocol):
    def gerar(self, conteudos: list, schema: type, temperatura: float = 0.0): ...


class LeitorOcr(Protocol):
    def __call__(self, jpeg: bytes) -> list[str]: ...


def _ms_desde(inicio: float) -> int:
    return int((time.perf_counter() - inicio) * 1000)


def ler_multimodal(gerador: Gerador, jpeg: bytes) -> ResultadoLeitura:
    inicio = time.perf_counter()
    leitura = gerador.gerar([imagem_para_parte(jpeg), PROMPT_ETIQUETA], LeituraEtiqueta)
    return consolidar(leitura, "multimodal", _ms_desde(inicio))


def ler_ocr(ocr: LeitorOcr, jpeg: bytes) -> ResultadoLeitura:
    inicio = time.perf_counter()
    leitura = extrair_de_texto(ocr(jpeg))
    return consolidar(leitura, "ocr", _ms_desde(inicio))


class RapidOcr:
    """Carrega o modelo ONNX só na primeira leitura (alguns segundos) e reaproveita depois."""

    def __init__(self) -> None:
        self._motor = None

    def __call__(self, jpeg: bytes) -> list[str]:
        if self._motor is None:
            from rapidocr_onnxruntime import RapidOCR

            self._motor = RapidOCR()
        matriz = np.array(Image.open(io.BytesIO(jpeg)).convert("RGB"))
        resultado, _ = self._motor(matriz)
        return [texto for _caixa, texto, _confianca in (resultado or [])]
