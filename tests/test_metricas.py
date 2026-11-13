from app.schemas import ResultadoLeitura
from avaliacao.metricas import Gabarito, comparar, resumir


def _leitura(**campos) -> ResultadoLeitura:
    base = dict(rota="ocr", legivel=True, fabricante=None, modelo=None, tensao_v=None, corrente_a=None,
                potencia_w=None, potencia_estimada=False, campos_faltantes=[], observacao=None, tempo_ms=10)
    return ResultadoLeitura(**{**base, **campos})


def _gabarito(**campos) -> Gabarito:
    base = dict(arquivo="a.jpg", condicao="normal", legivel=True, fabricante="PHILIPS", modelo="EverFlo",
                potencia_w=320.0)
    return Gabarito(**{**base, **campos})


def test_acerto_exato_com_tolerancia_de_meio_watt():
    assert comparar(_gabarito(), _leitura(potencia_w=320.4, modelo="EVERFLO")).acerto_potencia
    assert not comparar(_gabarito(), _leitura(potencia_w=321)).acerto_potencia


def test_modelo_normalizado_e_ausencia_no_gabarito_nao_conta():
    comparacao = comparar(_gabarito(fabricante=None), _leitura(modelo="Ever-Flo"))
    assert comparacao.acerto_modelo
    assert comparacao.acerto_fabricante is None


def test_potencia_inventada_quando_gabarito_nao_tem():
    gabarito = _gabarito(condicao="nao_etiqueta", legivel=False, fabricante=None, modelo=None, potencia_w=None)
    comparacao = comparar(gabarito, _leitura(potencia_w=50, legivel=True))
    assert comparacao.inventou_potencia
    assert not comparacao.acerto_legibilidade


def test_resumo_por_condicao_e_geral():
    comparacoes = [
        comparar(_gabarito(), _leitura(potencia_w=320, modelo="EverFlo", fabricante="Philips")),
        comparar(_gabarito(condicao="borrada"), _leitura(potencia_w=None)),
    ]
    resumo = resumir(comparacoes)
    assert resumo["geral"]["potencia"] == "50% (1/2)"
    assert resumo["normal"]["modelo"] == "100% (1/1)"
    assert resumo["borrada"]["fotos"] == "1"
