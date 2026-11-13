"""Servidor estático de desenvolvimento sem cache (para ver mudanças de CSS/JS na hora).

Uso: python servidor-dev.py  ->  http://localhost:5500
"""
import functools
import http.server
from pathlib import Path

PORTA = 5500


class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    pasta = Path(__file__).parent
    handler = functools.partial(SemCache, directory=str(pasta))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), handler) as servidor:
        print(f"Luz Vital em http://localhost:{PORTA}")
        servidor.serve_forever()
