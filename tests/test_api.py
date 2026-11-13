"""Testes da API com o Gemini e o OCR substituídos por dublês (não gastam cota nem precisam de chave)."""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Config
from app.gemini import IAIndisponivel
from app.main import app, obter_config, obter_gerador, obter_ocr
from app.schemas import EtapaPlano, LeituraEtiqueta, PlanoGerado

CONFIG_TESTE = Config(gemini_api_key="teste", gemini_model="modelo-teste", lado_maximo_px=800,
                      bytes_maximos_upload=200_000)

PEDIDO_PLANO = {
    "aparelhos": [
        {"tipo": "Concentrador de oxigênio", "potencia_w": 320, "autonomia_min": 0, "suporte_vida": True,
         "fonte_reserva": "cilindro_oxigenio"},
        {"tipo": "Ventilador", "autonomia_min": 900, "suporte_vida": True},
    ]
}


class GeradorFalso:
    def __init__(self, resposta=None, erro: Exception | None = None):
        self.resposta = resposta
        self.erro = erro
        self.chamadas = 0

    def gerar(self, conteudos, schema, temperatura=0.0):
        self.chamadas += 1
        if self.erro:
            raise self.erro
        return self.resposta


def _foto(formato: str = "JPEG") -> bytes:
    saida = io.BytesIO()
    Image.new("RGB", (40, 20), "white").save(saida, format=formato)
    return saida.getvalue()


@pytest.fixture
def cliente():
    app.dependency_overrides[obter_config] = lambda: CONFIG_TESTE
    yield TestClient(app)
    app.dependency_overrides.clear()


def _usar_gerador(gerador):
    app.dependency_overrides[obter_gerador] = lambda: gerador


def test_health(cliente):
    resposta = cliente.get("/health")
    assert resposta.status_code == 200
    assert resposta.json()["ia_configurada"] is True


def test_leitura_multimodal_estima_potencia_quando_so_ha_va(cliente):
    _usar_gerador(GeradorFalso(LeituraEtiqueta(legivel=True, fabricante="PHILIPS", modelo="Trilogy Evo",
                                               tensao_v=100, corrente_a=1.7)))
    resposta = cliente.post("/etiquetas/leitura", files={"foto": ("e.jpg", _foto(), "image/jpeg")})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["potencia_w"] == 170.0
    assert corpo["potencia_estimada"] is True
    assert corpo["precisa_confirmacao"] is True


def test_leitura_ocr_usa_regras(cliente):
    app.dependency_overrides[obter_ocr] = lambda: (lambda jpeg: ["MODELO: AS-300", "220 V 0,5 A", "90 W"])
    _usar_gerador(None)
    resposta = cliente.post("/etiquetas/leitura?rota=ocr", files={"foto": ("e.png", _foto("PNG"), "image/png")})
    assert resposta.status_code == 200
    assert resposta.json()["potencia_w"] == 90


def test_tipo_de_arquivo_nao_aceito_devolve_415(cliente):
    resposta = cliente.post("/etiquetas/leitura", files={"foto": ("e.txt", b"abc", "text/plain")})
    assert resposta.status_code == 415


def test_arquivo_corrompido_devolve_422(cliente):
    _usar_gerador(GeradorFalso())
    resposta = cliente.post("/etiquetas/leitura", files={"foto": ("e.jpg", b"nao-e-imagem", "image/jpeg")})
    assert resposta.status_code == 422


def test_foto_grande_demais_devolve_413(cliente):
    resposta = cliente.post("/etiquetas/leitura", files={"foto": ("e.jpg", b"0" * 300_000, "image/jpeg")})
    assert resposta.status_code == 413


def test_sem_chave_a_leitura_multimodal_devolve_503(cliente):
    _usar_gerador(None)
    resposta = cliente.post("/etiquetas/leitura", files={"foto": ("e.jpg", _foto(), "image/jpeg")})
    assert resposta.status_code == 503
    assert "rota=ocr" in resposta.json()["detail"]


def test_falha_do_gemini_devolve_503(cliente):
    _usar_gerador(GeradorFalso(erro=IAIndisponivel("cota excedida")))
    resposta = cliente.post("/etiquetas/leitura", files={"foto": ("e.jpg", _foto(), "image/jpeg")})
    assert resposta.status_code == 503


def test_plano_usa_menor_autonomia_de_suporte_a_vida_e_texto_da_ia(cliente):
    gerado = PlanoGerado(resumo="r", etapas=[EtapaPlano(faixa="Imediatamente", acoes=["Abra o cilindro."])],
                         quando_pedir_ajuda=["a"], sinais_alerta=["b"])
    _usar_gerador(GeradorFalso(gerado))
    corpo = cliente.post("/planos", json=PEDIDO_PLANO).json()
    assert corpo["minutos_criticos"] == 0
    assert corpo["aparelho_critico"] == "Concentrador de oxigênio"
    assert corpo["origem"] == "ia"
    assert any(c["numero"] == "192" for c in corpo["contatos"])


def test_plano_remove_orientacao_clinica(cliente):
    gerado = PlanoGerado(resumo="r", etapas=[EtapaPlano(faixa="0 a 30 min", acoes=[
        "Reduza o fluxo para 2 L/min.", "Ligue para a distribuidora."])], quando_pedir_ajuda=[], sinais_alerta=[])
    _usar_gerador(GeradorFalso(gerado))
    corpo = cliente.post("/planos", json=PEDIDO_PLANO).json()
    assert corpo["acoes_removidas"] == 1
    assert corpo["etapas"][0]["acoes"] == ["Ligue para a distribuidora."]


def test_plano_cai_para_modelo_padrao_sem_ia(cliente):
    _usar_gerador(None)
    corpo = cliente.post("/planos", json=PEDIDO_PLANO).json()
    assert corpo["origem"] == "modelo_padrao"
    assert corpo["etapas"]


def test_plano_cai_para_modelo_padrao_quando_ia_falha(cliente):
    _usar_gerador(GeradorFalso(erro=IAIndisponivel("timeout")))
    assert cliente.post("/planos", json=PEDIDO_PLANO).json()["origem"] == "modelo_padrao"


@pytest.mark.parametrize("aparelho", [
    {"tipo": "Ventilador", "autonomia_min": -1, "suporte_vida": True},
    {"tipo": "Ventilador", "autonomia_min": 60, "suporte_vida": True, "potencia_w": 0},
    {"tipo": "V", "autonomia_min": 60, "suporte_vida": True},
])
def test_plano_valida_entrada(cliente, aparelho):
    _usar_gerador(None)
    assert cliente.post("/planos", json={"aparelhos": [aparelho]}).status_code == 422


def test_plano_exige_ao_menos_um_aparelho(cliente):
    _usar_gerador(None)
    assert cliente.post("/planos", json={"aparelhos": []}).status_code == 422
