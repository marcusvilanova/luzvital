const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const dataHora = (iso) => (iso ? fmtDataHora.format(new Date(iso)) : "—");
export const hora = (iso) => (iso ? fmtHora.format(new Date(iso)) : "—");

/** 0 -> "sem bateria"; 95 -> "1h 35min"; 30 -> "30 min" */
export function duracao(minutos) {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos <= 0) return "sem bateria";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

/** Relógio da contagem regressiva: "05:20" (horas:minutos). */
export function relogio(minutos) {
  const total = Math.max(0, minutos);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const km = (valor) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
export const watts = (valor) => (valor ? `${Number(valor).toLocaleString("pt-BR")} W` : "—");

export function telefone(valor) {
  const d = String(valor ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor || "—";
}

export const cep = (valor) => String(valor ?? "").replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2");
