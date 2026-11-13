"""Contratos de entrada e saída do serviço de IA."""

from typing import Literal

from pydantic import BaseModel, Field

Rota = Literal["multimodal", "ocr"]
FonteReserva = Literal["nenhuma", "cilindro_oxigenio", "bateria_externa", "gerador", "outra"]


# ---------- Leitura da etiqueta ----------

class LeituraEtiqueta(BaseModel):
    """O que o modelo multimodal (ou o OCR + regras) consegue ler na etiqueta."""

    legivel: bool = Field(description="false se não é etiqueta ou se não dá para ler modelo nem dados elétricos")
    fabricante: str | None = None
    modelo: str | None = None
    tensao_v: float | None = Field(default=None, description="Menor valor quando houver faixa, ex.: 100-240 V -> 100")
    corrente_a: float | None = Field(default=None, description="Maior valor quando houver faixa; mA convertido para A")
    potencia_w: float | None = Field(default=None, description="Só se a etiqueta trouxer W ou VA escrito")
    observacao: str | None = Field(default=None, description="Motivo de ilegibilidade ou de campo faltante")


class ResultadoLeitura(BaseModel):
    """Resposta da API: leitura + campos derivados pelas regras do serviço."""

    rota: Rota
    legivel: bool
    fabricante: str | None
    modelo: str | None
    tensao_v: float | None
    corrente_a: float | None
    potencia_w: float | None
    potencia_estimada: bool = Field(description="true quando a potência foi calculada como V x A (potência aparente)")
    campos_faltantes: list[str]
    precisa_confirmacao: bool = Field(default=True, description="O cuidador sempre confirma o que foi lido")
    observacao: str | None
    tempo_ms: int


# ---------- Plano de contingência ----------

class AparelhoPlano(BaseModel):
    tipo: str = Field(min_length=2, max_length=60, examples=["Concentrador de oxigênio"])
    modelo: str | None = Field(default=None, max_length=60)
    potencia_w: float | None = Field(default=None, gt=0, le=5000)
    autonomia_min: int = Field(ge=0, le=10080, description="Autonomia da bateria interna em minutos (0 = sem bateria)")
    suporte_vida: bool
    fonte_reserva: FonteReserva = "nenhuma"


class PedidoPlano(BaseModel):
    """Sem nome, CPF ou endereço do paciente: o plano só precisa dos aparelhos."""

    aparelhos: list[AparelhoPlano] = Field(min_length=1, max_length=10)
    bairro: str | None = Field(default=None, max_length=60)


class EtapaPlano(BaseModel):
    faixa: str = Field(description="Faixa de tempo desde a queda de energia, ex.: '0 a 30 min'")
    acoes: list[str]


class PlanoGerado(BaseModel):
    """Parte do plano escrita pela IA generativa."""

    resumo: str
    etapas: list[EtapaPlano]
    quando_pedir_ajuda: list[str]
    sinais_alerta: list[str]


class Contato(BaseModel):
    nome: str
    numero: str
    quando: str


class PlanoContingencia(PlanoGerado):
    """Plano final: texto da IA + campos calculados e fixos pelo serviço."""

    minutos_criticos: int
    aparelho_critico: str
    contatos: list[Contato]
    aviso: str
    origem: Literal["ia", "modelo_padrao"]
    acoes_removidas: int = Field(default=0, description="Ações descartadas pelo filtro de orientação clínica")
