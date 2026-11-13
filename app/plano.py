"""Plano de contingência: a IA escreve o texto; o serviço calcula o tempo crítico e aplica limites."""

import json
import re

from app.gemini import IAIndisponivel
from app.leitura import Gerador
from app.schemas import (
    AparelhoPlano,
    Contato,
    EtapaPlano,
    PedidoPlano,
    PlanoContingencia,
    PlanoGerado,
)

AVISO = (
    "O Luz Vital não substitui o 192, o 193 nem o canal da distribuidora e não dá orientação clínica. "
    "Em caso de piora do paciente, ligue 192."
)

CONTATOS = [
    Contato(nome="SAMU", numero="192", quando="Paciente com falta de ar, cor arroxeada ou desmaio"),
    Contato(nome="Bombeiros", numero="193", quando="Risco de incêndio, choque elétrico ou resgate"),
    Contato(nome="Defesa Civil", numero="199", quando="Apagão longo com necessidade de remoção ou abrigo"),
    Contato(nome="Distribuidora de energia", numero="Telefone impresso na conta de luz",
            quando="Logo após a queda, informando que há equipamento vital na casa"),
]

# Termos de conduta clínica que a IA não pode recomendar (dose, fluxo, medicação).
_RE_CLINICO = re.compile(
    r"\b(dose|dosagem|mg|ml/h|medica(?:mento|ção)|aumente o fluxo|reduza o fluxo|ajuste o fluxo|"
    r"litros por minuto|l/min|desligue o (?:ventilador|respirador))\b",
    re.IGNORECASE,
)

PROMPT_PLANO = """Escreva um plano de contingência para uma família que cuida de um paciente
dependente de aparelhos elétricos em casa, para usar quando faltar luz.

Aparelhos (JSON): {aparelhos}
Tempo até o primeiro aparelho de suporte à vida parar: {minutos} minutos ({critico}).
Bairro: {bairro}

Regras:
- Linguagem simples, frases curtas, no imperativo, em português do Brasil.
- etapas: 3 a 5 faixas de tempo contadas desde a queda de energia, cobrindo de 0 até {minutos} minutos
  (se {minutos} for 0, a primeira faixa é "Imediatamente"). Cada faixa com 2 a 4 ações práticas:
  conferir bateria, ligar a fonte reserva, avisar a distribuidora, abrir "Estou sem luz" no app,
  procurar ponto de energia próximo, preparar remoção.
- Não dê orientação clínica: nada de dose, medicação, ajuste de fluxo ou de parâmetros do aparelho.
- Não invente telefones nem endereços.
- sinais_alerta: sinais no paciente que exigem ligar 192.
"""


def calcular_tempo_critico(aparelhos: list[AparelhoPlano]) -> tuple[int, str]:
    """Menor autonomia entre aparelhos de suporte à vida; sem nenhum, menor autonomia geral."""
    candidatos = [a for a in aparelhos if a.suporte_vida] or aparelhos
    critico = min(candidatos, key=lambda a: a.autonomia_min)
    return critico.autonomia_min, critico.tipo


def _filtrar_clinico(gerado: PlanoGerado) -> tuple[PlanoGerado, int]:
    etapas = []
    removidas = 0
    for etapa in gerado.etapas:
        seguras = [acao for acao in etapa.acoes if not _RE_CLINICO.search(acao)]
        removidas += len(etapa.acoes) - len(seguras)
        if seguras:
            etapas.append(etapa.model_copy(update={"acoes": seguras}))
    return gerado.model_copy(update={"etapas": etapas}), removidas


def plano_padrao(minutos: int) -> PlanoGerado:
    """Usado quando a IA está indisponível: o cuidador nunca fica sem plano."""
    metade = max(minutos // 2, 30)
    if minutos == 0:
        resumo = "O aparelho mais crítico não tem bateria: ligue a fonte reserva agora e peça ajuda."
    else:
        resumo = f"Você tem cerca de {minutos} minutos até o aparelho mais crítico parar. Aja já."
    return PlanoGerado(
        resumo=resumo,
        etapas=[
            EtapaPlano(faixa="Imediatamente" if minutos == 0 else "0 a 15 min", acoes=[
                "Confira se o aparelho passou para a bateria interna.",
                "Toque em 'Estou sem luz' no app.",
                "Ligue para a distribuidora e diga que há equipamento vital na casa.",
            ]),
            EtapaPlano(faixa=f"15 a {metade} min", acoes=[
                "Ligue a fonte reserva (cilindro, bateria externa ou gerador), se houver.",
                "Veja no app o ponto de energia mais próximo.",
            ]),
            EtapaPlano(faixa=f"{metade} min até o fim da bateria", acoes=[
                "Se a luz não voltou, prepare a ida ao ponto de energia ou a remoção.",
                "Mantenha o celular carregado e o app aberto para receber o atendimento.",
            ]),
        ],
        quando_pedir_ajuda=[
            "Se faltar menos de 60 minutos de bateria e a luz não voltou.",
            "Se o aparelho não tem bateria e não há fonte reserva.",
        ],
        sinais_alerta=["Falta de ar", "Lábios ou unhas arroxeados", "Confusão ou sonolência fora do comum"],
    )


def gerar_plano(pedido: PedidoPlano, gerador: Gerador | None) -> PlanoContingencia:
    minutos, critico = calcular_tempo_critico(pedido.aparelhos)
    origem = "ia"
    removidas = 0
    try:
        if gerador is None:
            raise IAIndisponivel("Sem gerador configurado")
        prompt = PROMPT_PLANO.format(
            aparelhos=json.dumps([a.model_dump() for a in pedido.aparelhos], ensure_ascii=False),
            minutos=minutos, critico=critico, bairro=pedido.bairro or "não informado",
        )
        gerado, removidas = _filtrar_clinico(gerador.gerar([prompt], PlanoGerado, temperatura=0.3))
        if not gerado.etapas:
            raise IAIndisponivel("Plano da IA ficou vazio após o filtro")
    except IAIndisponivel:
        gerado, origem = plano_padrao(minutos), "modelo_padrao"

    return PlanoContingencia(
        **gerado.model_dump(),
        minutos_criticos=minutos,
        aparelho_critico=critico,
        contatos=CONTATOS,
        aviso=AVISO,
        origem=origem,
        acoes_removidas=removidas,
    )
