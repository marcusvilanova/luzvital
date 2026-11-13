"""Roda as duas rotas sobre um conjunto de fotos anotadas e gera o relatório comparativo.

Uso (na raiz do repositório):
    python -m avaliacao.avaliar --gabarito dados/gabarito.csv --pasta dados/fotos
    python -m avaliacao.avaliar --gabarito dados/sinteticas/gabarito.csv --pasta dados/sinteticas --rotas ocr
"""

import argparse
import csv
import dataclasses
import sys
import time
from pathlib import Path

from app.config import carregar_config
from app.gemini import GeradorGemini, IAIndisponivel
from app.imagem import preparar_imagem
from app.leitura import RapidOcr, ler_multimodal, ler_ocr
from avaliacao.metricas import Comparacao, Gabarito, comparar, resumir

COLUNAS_RESUMO = ["fotos", "potencia", "modelo", "fabricante", "legibilidade", "potencia_inventada", "tempo_medio_ms"]


def _opcional(valor: str) -> str | None:
    return valor.strip() or None


def carregar_gabarito(caminho: Path) -> list[Gabarito]:
    with caminho.open(encoding="utf-8") as arquivo:
        return [
            Gabarito(
                arquivo=linha["arquivo"].strip(),
                condicao=linha["condicao"].strip(),
                legivel=linha["legivel"].strip().lower() in {"1", "true", "sim"},
                fabricante=_opcional(linha["fabricante"]),
                modelo=_opcional(linha["modelo"]),
                potencia_w=float(linha["potencia_w"].replace(",", ".")) if linha["potencia_w"].strip() else None,
            )
            for linha in csv.DictReader(arquivo)
        ]


def _leitor(rota: str):
    if rota == "ocr":
        ocr = RapidOcr()
        return lambda jpeg: ler_ocr(ocr, jpeg)
    cfg = carregar_config()
    gerador = GeradorGemini(cfg.gemini_api_key, cfg.gemini_model)
    return lambda jpeg: ler_multimodal(gerador, jpeg)


def avaliar_rota(rota: str, gabaritos: list[Gabarito], pasta: Path, saida: Path, pausa_s: float) -> list[Comparacao]:
    ler = _leitor(rota)
    lado = carregar_config().lado_maximo_px
    comparacoes = []
    with (saida / f"predicoes_{rota}.csv").open("w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["arquivo", "condicao", "legivel", "fabricante", "modelo", "tensao_v", "corrente_a",
                           "potencia_w", "potencia_estimada", "tempo_ms", "acerto_potencia", "acerto_modelo"])
        for gabarito in gabaritos:
            jpeg = preparar_imagem((pasta / gabarito.arquivo).read_bytes(), lado)
            try:
                leitura = ler(jpeg)
            except IAIndisponivel as erro:
                print(f"[{rota}] {gabarito.arquivo}: {erro}", file=sys.stderr)
                continue
            comparacao = comparar(gabarito, leitura)
            comparacoes.append(comparacao)
            escritor.writerow([gabarito.arquivo, gabarito.condicao, leitura.legivel, leitura.fabricante,
                               leitura.modelo, leitura.tensao_v, leitura.corrente_a, leitura.potencia_w,
                               leitura.potencia_estimada, leitura.tempo_ms, comparacao.acerto_potencia,
                               comparacao.acerto_modelo])
            time.sleep(pausa_s)
    return comparacoes


def escrever_relatorio(resultados: dict[str, list[Comparacao]], caminho: Path, titulo: str) -> None:
    linhas = [f"# {titulo}", "", "Acerto por rota e por condição da foto (gerado por `avaliacao/avaliar.py`).", ""]
    for rota, comparacoes in resultados.items():
        linhas += [f"## Rota {rota}", "", "| condição | " + " | ".join(COLUNAS_RESUMO) + " |",
                   "|---" * (len(COLUNAS_RESUMO) + 1) + "|"]
        for condicao, valores in resumir(comparacoes).items():
            linhas.append(f"| {condicao} | " + " | ".join(valores[c] for c in COLUNAS_RESUMO) + " |")
        erros = [c.arquivo for c in comparacoes if c.acerto_potencia is False or c.acerto_modelo is False]
        linhas += ["", f"Fotos com erro de potência ou modelo: {', '.join(erros) or 'nenhuma'}", ""]
    caminho.write_text("\n".join(linhas), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--gabarito", type=Path, required=True)
    parser.add_argument("--pasta", type=Path, required=True)
    parser.add_argument("--rotas", default="multimodal,ocr")
    parser.add_argument("--saida", type=Path, default=Path("avaliacao/resultados"))
    parser.add_argument("--pausa", type=float, default=4.0, help="Segundos entre chamadas (cota gratuita)")
    parser.add_argument("--titulo", default="Resultados da avaliação")
    args = parser.parse_args()

    args.saida.mkdir(parents=True, exist_ok=True)
    gabaritos = carregar_gabarito(args.gabarito)
    resultados = {}
    for rota in [r.strip() for r in args.rotas.split(",")]:
        pausa = args.pausa if rota == "multimodal" else 0.0
        resultados[rota] = avaliar_rota(rota, gabaritos, args.pasta, args.saida, pausa)
    escrever_relatorio(resultados, args.saida / "relatorio.md", args.titulo)
    for rota, comparacoes in resultados.items():
        geral = resumir(comparacoes).get("geral", {})
        print(rota, {k: geral.get(k) for k in COLUNAS_RESUMO})


if __name__ == "__main__":
    main()
