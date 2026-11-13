from app.regras import consolidar, estimar_potencia, extrair_de_texto, normalizar_modelo
from app.schemas import LeituraEtiqueta


def test_extrai_campos_de_etiqueta_completa():
    leitura = extrair_de_texto([
        "FABRICANTE: PHILIPS RESPIRONICS", "MODELO: EverFlo", "ENTRADA: 220 V~ 60 Hz 1,5 A", "POTÊNCIA: 320 W",
    ])
    assert leitura.legivel
    assert leitura.fabricante == "PHILIPS RESPIRONICS"
    assert leitura.modelo == "EverFlo"
    assert leitura.tensao_v == 220
    assert leitura.corrente_a == 1.5
    assert leitura.potencia_w == 320


def test_faixas_usam_menor_tensao_e_maior_corrente():
    leitura = extrair_de_texto(["MODEL: Trilogy Evo", "100-240 V~ 50/60 Hz 1,7-0,6 A"])
    assert leitura.tensao_v == 100
    assert leitura.corrente_a == 1.7
    assert leitura.potencia_w is None


def test_converte_ma_e_kw():
    leitura = extrair_de_texto(["127 V 500 mA", "Potência 1,2 kW"])
    assert leitura.corrente_a == 0.5
    assert leitura.potencia_w == 1200


def test_nao_confunde_va_com_tensao():
    leitura = extrair_de_texto(["150 VA"])
    assert leitura.potencia_w == 150
    assert leitura.tensao_v is None


def test_texto_sem_dados_e_ilegivel():
    leitura = extrair_de_texto(["Lorem ipsum", "N/S: 12345"])
    assert not leitura.legivel
    assert leitura.observacao


def test_potencia_informada_tem_prioridade_sobre_estimativa():
    assert estimar_potencia(LeituraEtiqueta(legivel=True, tensao_v=220, corrente_a=2, potencia_w=320)) == (320, False)


def test_estima_potencia_quando_so_ha_volts_e_amperes():
    assert estimar_potencia(LeituraEtiqueta(legivel=True, tensao_v=100, corrente_a=1.7)) == (170.0, True)


def test_sem_potencia_nem_va_nao_estima():
    assert estimar_potencia(LeituraEtiqueta(legivel=True, tensao_v=220)) == (None, False)


def test_consolidar_lista_campos_faltantes_e_pede_confirmacao():
    resultado = consolidar(LeituraEtiqueta(legivel=True, modelo="X1"), "ocr", 12)
    assert resultado.campos_faltantes == ["fabricante", "potencia_w"]
    assert resultado.precisa_confirmacao


def test_normalizar_modelo_ignora_espacos_hifens_e_acentos():
    assert normalizar_modelo("Trilogy-Évo ") == normalizar_modelo("TRILOGY EVO")
    assert normalizar_modelo(None) == ""
