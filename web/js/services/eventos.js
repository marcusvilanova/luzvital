// Avisa as telas que os dados mudaram em OUTRA janela (cuidador numa aba, gestor na outra).
// No modo mock vem do evento "storage" do navegador; com backend real, as telas usam a busca periódica.
const alvo = new EventTarget();

export function avisarMudanca() {
  alvo.dispatchEvent(new Event("mudou"));
}

/** Registra `fn` e devolve a função que cancela o registro (use com aoDeixar). */
export function aoMudarDados(fn) {
  alvo.addEventListener("mudou", fn);
  return () => alvo.removeEventListener("mudou", fn);
}
