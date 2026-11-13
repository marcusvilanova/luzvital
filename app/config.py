"""Configuração lida de variáveis de ambiente (nunca do código)."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

MODELO_PADRAO = "gemini-3.5-flash-lite"
LADO_MAXIMO_PADRAO_PX = 1600
BYTES_MAXIMOS_PADRAO = 8 * 1024 * 1024


@dataclass(frozen=True)
class Config:
    gemini_api_key: str | None
    gemini_model: str
    lado_maximo_px: int
    bytes_maximos_upload: int


def carregar_config() -> Config:
    return Config(
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", MODELO_PADRAO),
        lado_maximo_px=int(os.getenv("LADO_MAXIMO_PX", LADO_MAXIMO_PADRAO_PX)),
        bytes_maximos_upload=int(os.getenv("BYTES_MAXIMOS_UPLOAD", BYTES_MAXIMOS_PADRAO)),
    )
