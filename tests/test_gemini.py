from types import SimpleNamespace

import pytest

from app import gemini
from app.gemini import GeradorGemini, IAIndisponivel
from app.schemas import LeituraEtiqueta


class ModelosFalsos:
    def __init__(self, resposta=None, erro=None):
        self.resposta, self.erro = resposta, erro

    def generate_content(self, model, contents, config):
        if self.erro:
            raise self.erro
        return self.resposta


def _gerador(monkeypatch, resposta=None, erro=None) -> GeradorGemini:
    monkeypatch.setattr(gemini.genai, "Client",
                        lambda api_key: SimpleNamespace(models=ModelosFalsos(resposta, erro)))
    return GeradorGemini("chave", "modelo")


def test_sem_chave_lanca_ia_indisponivel():
    with pytest.raises(IAIndisponivel):
        GeradorGemini(None, "modelo")


def test_usa_resposta_ja_parseada(monkeypatch):
    leitura = LeituraEtiqueta(legivel=True, modelo="X")
    gerador = _gerador(monkeypatch, SimpleNamespace(parsed=leitura, text=None))
    assert gerador.gerar(["p"], LeituraEtiqueta) == leitura


def test_valida_texto_json_quando_parsed_vazio(monkeypatch):
    gerador = _gerador(monkeypatch, SimpleNamespace(parsed=None, text='{"legivel": false}'))
    assert gerador.gerar(["p"], LeituraEtiqueta).legivel is False


def test_json_fora_do_schema_vira_ia_indisponivel(monkeypatch):
    gerador = _gerador(monkeypatch, SimpleNamespace(parsed=None, text='{"modelo": 1}'))
    with pytest.raises(IAIndisponivel):
        gerador.gerar(["p"], LeituraEtiqueta)


def test_erro_de_rede_vira_ia_indisponivel(monkeypatch):
    gerador = _gerador(monkeypatch, erro=ConnectionError("sem rede"))
    with pytest.raises(IAIndisponivel, match="ConnectionError"):
        gerador.gerar(["p"], LeituraEtiqueta)


class ErroComCodigo(Exception):
    def __init__(self, code):
        super().__init__(f"erro {code}")
        self.code = code


class ModelosQueFalhamAntes:
    """Falha com os erros dados e depois responde."""

    def __init__(self, erros, resposta):
        self.erros, self.resposta, self.chamadas = list(erros), resposta, 0

    def generate_content(self, model, contents, config):
        self.chamadas += 1
        if self.erros:
            raise self.erros.pop(0)
        return self.resposta


def _gerador_com(monkeypatch, modelos) -> tuple[GeradorGemini, list]:
    esperas = []
    monkeypatch.setattr(gemini.genai, "Client", lambda api_key: SimpleNamespace(models=modelos))
    return GeradorGemini("chave", "modelo", dormir=esperas.append), esperas


def test_tenta_de_novo_em_429_e_503(monkeypatch):
    leitura = LeituraEtiqueta(legivel=True)
    modelos = ModelosQueFalhamAntes([ErroComCodigo(429), ErroComCodigo(503)], SimpleNamespace(parsed=leitura, text=None))
    gerador, esperas = _gerador_com(monkeypatch, modelos)
    assert gerador.gerar(["p"], LeituraEtiqueta) == leitura
    assert modelos.chamadas == 3
    assert esperas == [2.0, 5.0]


def test_desiste_depois_de_tres_tentativas(monkeypatch):
    modelos = ModelosQueFalhamAntes([ErroComCodigo(503)] * 3, None)
    gerador, _ = _gerador_com(monkeypatch, modelos)
    with pytest.raises(IAIndisponivel):
        gerador.gerar(["p"], LeituraEtiqueta)
    assert modelos.chamadas == 3


def test_nao_repete_erro_permanente(monkeypatch):
    modelos = ModelosQueFalhamAntes([ErroComCodigo(400)], None)
    gerador, esperas = _gerador_com(monkeypatch, modelos)
    with pytest.raises(IAIndisponivel):
        gerador.gerar(["p"], LeituraEtiqueta)
    assert modelos.chamadas == 1 and esperas == []
