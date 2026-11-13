"""API do serviço de IA do Luz Vital, chamada pela API Java (Spring Boot)."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile

from app.config import Config, carregar_config
from app.gemini import GeradorGemini, IAIndisponivel
from app.imagem import ImagemInvalida, preparar_imagem
from app.leitura import RapidOcr, ler_multimodal, ler_ocr
from app.plano import gerar_plano
from app.schemas import PedidoPlano, PlanoContingencia, ResultadoLeitura, Rota

TIPOS_ACEITOS = {"image/jpeg", "image/png", "image/webp"}


@lru_cache
def obter_config() -> Config:
    return carregar_config()


@lru_cache
def _gerador_singleton(api_key: str | None, modelo: str) -> GeradorGemini:
    return GeradorGemini(api_key, modelo)


def obter_gerador(cfg: Annotated[Config, Depends(obter_config)]) -> GeradorGemini | None:
    """None quando não há chave: a leitura multimodal responde 503 e o plano usa o modelo padrão."""
    try:
        return _gerador_singleton(cfg.gemini_api_key, cfg.gemini_model)
    except IAIndisponivel:
        return None


@lru_cache
def obter_ocr() -> RapidOcr:
    return RapidOcr()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Luz Vital — Serviço de IA",
        version="1.0.0",
        description="Leitura da etiqueta do aparelho por foto e plano de contingência gerado por IA.",
    )

    @app.get("/health")
    def health(cfg: Annotated[Config, Depends(obter_config)]) -> dict:
        return {"status": "ok", "ia_configurada": cfg.gemini_api_key is not None, "modelo": cfg.gemini_model}

    @app.post("/etiquetas/leitura", response_model=ResultadoLeitura,
              responses={413: {}, 415: {}, 422: {}, 503: {}})
    def ler_etiqueta(
        foto: Annotated[UploadFile, File(description="Foto da etiqueta (JPEG, PNG ou WebP)")],
        cfg: Annotated[Config, Depends(obter_config)],
        gerador: Annotated[GeradorGemini | None, Depends(obter_gerador)],
        ocr: Annotated[RapidOcr, Depends(obter_ocr)],
        rota: Annotated[Rota, Query()] = "multimodal",
    ) -> ResultadoLeitura:
        if foto.content_type not in TIPOS_ACEITOS:
            raise HTTPException(415, "Envie uma foto JPEG, PNG ou WebP")
        conteudo = foto.file.read(cfg.bytes_maximos_upload + 1)
        if len(conteudo) > cfg.bytes_maximos_upload:
            raise HTTPException(413, "Foto maior que o limite permitido")
        try:
            jpeg = preparar_imagem(conteudo, cfg.lado_maximo_px)
        except ImagemInvalida as erro:
            raise HTTPException(422, str(erro)) from erro

        if rota == "ocr":
            return ler_ocr(ocr, jpeg)
        if gerador is None:
            raise HTTPException(503, "IA indisponível. Tente rota=ocr ou digite os dados do aparelho")
        try:
            return ler_multimodal(gerador, jpeg)
        except IAIndisponivel as erro:
            raise HTTPException(503, f"{erro}. Tente rota=ocr ou digite os dados do aparelho") from erro

    @app.post("/planos", response_model=PlanoContingencia)
    def criar_plano(
        pedido: PedidoPlano,
        gerador: Annotated[GeradorGemini | None, Depends(obter_gerador)],
    ) -> PlanoContingencia:
        return gerar_plano(pedido, gerador)

    return app


app = create_app()
