"""Regras determinísticas: extração por regex (rota OCR), estimativa de potência e consolidação."""

import re
import unicodedata

from app.schemas import LeituraEtiqueta, ResultadoLeitura, Rota

FABRICANTES_CONHECIDOS = (
    "PHILIPS", "RESPIRONICS", "RESMED", "FISHER & PAYKEL", "MEDTRONIC", "BAXTER", "B. BRAUN",
    "FRESENIUS", "INVACARE", "DEVILBISS", "YUWELL", "VYAIRE", "MINDRAY", "LUMIAR", "NEVONI",
    "MONDIAL", "BRITANIA", "PHILCO", "ARNO", "ELECTROLUX", "MULTILASER", "INTELBRAS", "SAMSUNG", "LG",
)

_NUM = r"(\d+(?:[.,]\d+)?)"
_RE_POTENCIA = re.compile(_NUM + r"\s*(k?W|VA)\b", re.IGNORECASE)
_RE_POTENCIA_ROTULADA = re.compile(
    r"(?:POT[EÊ]NCIA|POWER|CONSUMO|INPUT POWER)\s*[:=]?\s*" + _NUM + r"\s*(k?W|VA)\b", re.IGNORECASE
)
_RE_TENSAO = re.compile(r"(\d{2,3})(?:\s*[-–/~]\s*(\d{2,3}))?\s*V(?![A-Za-z])", re.IGNORECASE)
_RE_CORRENTE = re.compile(
    r"(?<![\w.,])" + _NUM + r"(?:\s*[-–/]\s*" + _NUM + r")?\s*(mA|A)(?![A-Za-z])", re.IGNORECASE
)
_RE_MODELO = re.compile(
    r"(?:MODELO|MODEL|MOD\.|REF\.?|TIPO|TYPE)\s*[:.]?\s*([A-Z0-9][A-Z0-9 \-/.]{1,30})", re.IGNORECASE
)
_RE_FABRICANTE = re.compile(r"(?:FABRICANTE|FABRICADO POR|MANUFACTURER|MARCA)\s*[:.]?\s*([^\n]{2,40})", re.IGNORECASE)


def _numero(texto: str | None) -> float | None:
    return float(texto.replace(",", ".")) if texto else None


def _sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def normalizar_modelo(modelo: str | None) -> str:
    """'Trilogy  Evo' e 'TRILOGY-EVO' viram 'TRILOGYEVO' para comparação."""
    return re.sub(r"[^A-Z0-9]", "", _sem_acento(modelo or "").upper())


def _extrair_potencia(texto: str) -> float | None:
    achado = _RE_POTENCIA_ROTULADA.search(texto) or _RE_POTENCIA.search(texto)
    if not achado:
        return None
    valor = _numero(achado.group(1))
    return valor * 1000 if achado.group(2).lower() == "kw" else valor


def _extrair_tensao(texto: str) -> float | None:
    achado = _RE_TENSAO.search(texto)
    if not achado:
        return None
    valores = [float(v) for v in achado.groups() if v]
    return min(valores)


def _extrair_corrente(texto: str) -> float | None:
    achado = _RE_CORRENTE.search(texto)
    if not achado:
        return None
    valores = [_numero(v) for v in achado.groups()[:2] if v]
    fator = 0.001 if achado.group(3).lower() == "ma" else 1.0
    return round(max(valores) * fator, 4)


def _extrair_fabricante(texto: str) -> str | None:
    rotulado = _RE_FABRICANTE.search(texto)
    if rotulado:
        return rotulado.group(1).strip()
    maiusculo = texto.upper()
    return next((f for f in FABRICANTES_CONHECIDOS if f in maiusculo), None)


def _extrair_modelo(texto: str) -> str | None:
    achado = _RE_MODELO.search(texto)
    return achado.group(1).strip(" .-/") if achado else None


def extrair_de_texto(linhas: list[str]) -> LeituraEtiqueta:
    """Rota OCR: aplica regras de regex sobre as linhas lidas pelo OCR."""
    texto = "\n".join(linhas)
    leitura = LeituraEtiqueta(
        legivel=False,
        fabricante=_extrair_fabricante(texto),
        modelo=_extrair_modelo(texto),
        tensao_v=_extrair_tensao(texto),
        corrente_a=_extrair_corrente(texto),
        potencia_w=_extrair_potencia(texto),
    )
    tem_dado_eletrico = leitura.potencia_w is not None or (
        leitura.tensao_v is not None and leitura.corrente_a is not None
    )
    legivel = leitura.modelo is not None or tem_dado_eletrico
    observacao = None if legivel else "OCR não encontrou modelo nem dados elétricos"
    return leitura.model_copy(update={"legivel": legivel, "observacao": observacao})


def estimar_potencia(leitura: LeituraEtiqueta) -> tuple[float | None, bool]:
    """Potência informada tem prioridade; sem ela, V x A (potência aparente, pior caso)."""
    if leitura.potencia_w is not None:
        return leitura.potencia_w, False
    if leitura.tensao_v is not None and leitura.corrente_a is not None:
        return round(leitura.tensao_v * leitura.corrente_a, 1), True
    return None, False


def consolidar(leitura: LeituraEtiqueta, rota: Rota, tempo_ms: int) -> ResultadoLeitura:
    potencia, estimada = estimar_potencia(leitura)
    campos = {"fabricante": leitura.fabricante, "modelo": leitura.modelo, "potencia_w": potencia}
    faltantes = [nome for nome, valor in campos.items() if valor in (None, "")]
    return ResultadoLeitura(
        rota=rota,
        legivel=leitura.legivel,
        fabricante=leitura.fabricante,
        modelo=leitura.modelo,
        tensao_v=leitura.tensao_v,
        corrente_a=leitura.corrente_a,
        potencia_w=potencia,
        potencia_estimada=estimada,
        campos_faltantes=faltantes,
        observacao=leitura.observacao,
        tempo_ms=tempo_ms,
    )
