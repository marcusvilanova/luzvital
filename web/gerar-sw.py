"""Atualiza a lista de arquivos do service worker (rode depois de criar ou renomear arquivos).

Uso: python gerar-sw.py
"""
import hashlib
import re
from pathlib import Path

RAIZ = Path(__file__).parent
PASTAS = ["css", "js", "icones"]
AVULSOS = ["index.html", "manifest.webmanifest"]

arquivos = AVULSOS + sorted(str(p.relative_to(RAIZ)).replace("\\", "/") for d in PASTAS for p in (RAIZ / d).rglob("*") if p.is_file())
conteudo = b"".join((RAIZ / a).read_bytes() for a in arquivos)
versao = hashlib.sha256(conteudo).hexdigest()[:10]

sw = (RAIZ / "sw.js").read_text(encoding="utf-8")
lista = "\n".join(f'  "./{a}",' for a in arquivos)
sw = re.sub(r'const ARQUIVOS = \[\n.*?\n\];', f'const ARQUIVOS = [\n  "./",\n{lista}\n];', sw, flags=re.S)
sw = re.sub(r'const VERSAO = "[^"]+";', f'const VERSAO = "luz-vital-{versao}";', sw)
(RAIZ / "sw.js").write_text(sw, encoding="utf-8")
print(f"{len(arquivos)} arquivos, versão {versao}")
