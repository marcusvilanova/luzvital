// Alerta de bateria baixa para o cuidador: vibra, toca dois bipes e mostra o aviso uma vez por ocorrência.
import { MINUTOS_ALERTA, minutosRestantes } from "../lib/regras.js";
import { toast } from "./toast.js";

const chave = (id) => `lv.alerta.${id}`;

function jaAvisou(id) {
  try { return sessionStorage.getItem(chave(id)) === "1"; } catch { return false; }
}

function marcar(id) {
  try { sessionStorage.setItem(chave(id), "1"); } catch { /* armazenamento bloqueado: avisa de novo, sem problema */ }
}

function bipar() {
  const Contexto = window.AudioContext ?? window.webkitAudioContext;
  if (!Contexto) return;
  const audio = new Contexto();
  [0, 0.35].forEach((inicio) => {
    const osc = audio.createOscillator();
    const volume = audio.createGain();
    osc.frequency.value = 880;
    volume.gain.setValueAtTime(0.18, audio.currentTime + inicio);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + inicio + 0.25);
    osc.connect(volume).connect(audio.destination);
    osc.start(audio.currentTime + inicio);
    osc.stop(audio.currentTime + inicio + 0.26);
  });
}

/** Verifica a ocorrência e alerta se acabou de ficar com menos de 60 minutos. */
export function verificarBateriaBaixa(ocorrencia) {
  if (ocorrencia.status !== "ABERTA" || jaAvisou(ocorrencia.id)) return;
  if (minutosRestantes(ocorrencia, ocorrencia.equipamentos) >= MINUTOS_ALERTA) return;
  marcar(ocorrencia.id);
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  try { bipar(); } catch { /* sem áudio: fica o aviso visual */ }
  toast("Menos de 1 hora de bateria. Ligue a fonte reserva ou vá ao ponto de energia.", "error");
}
