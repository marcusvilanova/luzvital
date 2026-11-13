"""Servidor estático de desenvolvimento sem cache e com os mesmos cabeçalhos da Vercel (vercel.json).

Assim a política de segurança (CSP) é testada localmente antes de publicar.
Uso: python servidor-dev.py  ->  http://localhost:5500
"""
import functools
import http.server
import json
import re
from pathlib import Path

PORTA = 5500
PASTA = Path(__file__).parent


def carregar_cabecalhos() -> list[tuple[re.Pattern, list[dict]]]:
    config = json.loads((PASTA / "vercel.json").read_text(encoding="utf-8"))
    regras = []
    for regra in config.get("headers", []):
        padrao = "^" + regra["source"].replace("(.*)", ".*") + "$"
        regras.append((re.compile(padrao), regra["headers"]))
    return regras


REGRAS = carregar_cabecalhos()


class ComoVercel(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        caminho = self.path.split("?")[0]
        enviados = set()
        for padrao, cabecalhos in REGRAS:
            if padrao.match(caminho):
                for c in cabecalhos:
                    self.send_header(c["key"], c["value"])
                    enviados.add(c["key"].lower())
        if "cache-control" not in enviados:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(ComoVercel, directory=str(PASTA))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), handler) as servidor:
        print(f"Luz Vital em http://localhost:{PORTA}")
        servidor.serve_forever()
