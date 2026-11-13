"""Métricas de acerto por foto, comparando a leitura com o gabarito anotado pelo grupo."""

from collections import defaultdict
from dataclasses import dataclass

from app.regras import normalizar_modelo
from app.schemas import ResultadoLeitura

TOLERANCIA_W = 0.5  # "acerto exato": diferença de no máximo meio watt (arredondamento)


@dataclass(frozen=True)
class Gabarito:
    arquivo: str
    condicao: str  # normal | borrada | reflexo | parcial | so_va | nao_etiqueta
    legivel: bool
    fabricante: str | None
    modelo: str | None
    potencia_w: float | None  # para so_va, é V x A (potência estimada esperada)


@dataclass(frozen=True)
class Comparacao:
    arquivo: str
    condicao: str
    acerto_potencia: bool | None  # None quando o gabarito não tem potência
    acerto_modelo: bool | None
    acerto_fabricante: bool | None
    acerto_legibilidade: bool
    inventou_potencia: bool  # devolveu potência onde o gabarito não tem
    tempo_ms: int


def _igual_texto(previsto: str | None, esperado: str | None) -> bool | None:
    if not esperado:
        return None
    return normalizar_modelo(previsto) == normalizar_modelo(esperado)


def comparar(gabarito: Gabarito, leitura: ResultadoLeitura) -> Comparacao:
    if gabarito.potencia_w is None:
        acerto_potencia = None
    else:
        acerto_potencia = (
            leitura.potencia_w is not None and abs(leitura.potencia_w - gabarito.potencia_w) <= TOLERANCIA_W
        )
    return Comparacao(
        arquivo=gabarito.arquivo,
        condicao=gabarito.condicao,
        acerto_potencia=acerto_potencia,
        acerto_modelo=_igual_texto(leitura.modelo, gabarito.modelo),
        acerto_fabricante=_igual_texto(leitura.fabricante, gabarito.fabricante),
        acerto_legibilidade=leitura.legivel == gabarito.legivel,
        inventou_potencia=gabarito.potencia_w is None and leitura.potencia_w is not None,
        tempo_ms=leitura.tempo_ms,
    )


def _taxa(valores: list[bool | None]) -> str:
    validos = [v for v in valores if v is not None]
    if not validos:
        return "—"
    return f"{100 * sum(validos) / len(validos):.0f}% ({sum(validos)}/{len(validos)})"


def resumir(comparacoes: list[Comparacao]) -> dict[str, dict[str, str]]:
    """Linha 'geral' + uma linha por condição da foto."""
    grupos: dict[str, list[Comparacao]] = defaultdict(list)
    for c in comparacoes:
        grupos["geral"].append(c)
        grupos[c.condicao].append(c)
    return {
        nome: {
            "fotos": str(len(itens)),
            "potencia": _taxa([c.acerto_potencia for c in itens]),
            "modelo": _taxa([c.acerto_modelo for c in itens]),
            "fabricante": _taxa([c.acerto_fabricante for c in itens]),
            "legibilidade": _taxa([c.acerto_legibilidade for c in itens]),
            "potencia_inventada": str(sum(c.inventou_potencia for c in itens)),
            "tempo_medio_ms": str(round(sum(c.tempo_ms for c in itens) / len(itens))),
        }
        for nome, itens in grupos.items()
    }
