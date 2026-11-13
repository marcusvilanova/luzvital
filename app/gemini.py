"""Cliente fino do Gemini que devolve saída estruturada (JSON validado por Pydantic)."""

import time
from collections.abc import Callable
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

# Cota estourada (429) e sobrecarga do serviço (500/503) costumam passar em segundos: vale tentar de novo.
CODIGOS_TRANSITORIOS = {429, 500, 503}
ESPERAS_S = (2.0, 5.0)


class IAIndisponivel(RuntimeError):
    """Chave ausente, erro de rede, cota excedida ou resposta fora do schema."""


def _transitorio(erro: Exception) -> bool:
    return getattr(erro, "code", None) in CODIGOS_TRANSITORIOS


class GeradorGemini:
    def __init__(self, api_key: str | None, modelo: str, dormir: Callable[[float], None] = time.sleep):
        if not api_key:
            raise IAIndisponivel("GEMINI_API_KEY não configurada")
        self._cliente = genai.Client(api_key=api_key)
        self._dormir = dormir
        self.modelo = modelo

    def _chamar(self, conteudos: list, config: types.GenerateContentConfig):
        """Chama o modelo com até duas novas tentativas em erro transitório."""
        for tentativa in range(len(ESPERAS_S) + 1):
            try:
                return self._cliente.models.generate_content(model=self.modelo, contents=conteudos, config=config)
            except Exception as erro:  # o SDK lança vários tipos (rede, cota, 4xx/5xx)
                if _transitorio(erro) and tentativa < len(ESPERAS_S):
                    self._dormir(ESPERAS_S[tentativa])
                    continue
                raise IAIndisponivel(f"Falha ao chamar o Gemini: {type(erro).__name__}") from erro
        raise IAIndisponivel("Falha ao chamar o Gemini")  # inalcançável; mantém o tipo de retorno explícito

    def gerar(self, conteudos: list, schema: type[T], temperatura: float = 0.0) -> T:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperatura,
        )
        resposta = self._chamar(conteudos, config)
        if isinstance(resposta.parsed, schema):
            return resposta.parsed
        try:
            return schema.model_validate_json(resposta.text or "")
        except ValidationError as erro:
            raise IAIndisponivel("Resposta do Gemini fora do formato esperado") from erro


def imagem_para_parte(jpeg: bytes) -> types.Part:
    return types.Part.from_bytes(data=jpeg, mime_type="image/jpeg")
