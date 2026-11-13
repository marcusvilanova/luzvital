// PWA: registra o service worker (app offline) e guarda o convite de instalação do navegador.
let convite = null;

window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  convite = evento;
});

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* sem service worker o app funciona igual, só não fica disponível offline */
  });
}

export const instalacao = {
  disponivel: () => convite !== null,
  instalado: () => matchMedia("(display-mode: standalone)").matches,
  async instalar() {
    if (!convite) return false;
    convite.prompt();
    const { outcome } = await convite.userChoice;
    convite = null;
    return outcome === "accepted";
  },
};
