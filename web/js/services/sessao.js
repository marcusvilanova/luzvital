// Sessão do usuário: token JWT + dados públicos do usuário. Nunca guarda a senha.
// Cada aba tem a sua (sessionStorage), para cuidador e gestor ficarem lado a lado na demonstração.
// A cópia no localStorage só serve para manter o login ao reabrir o app.
const CHAVE = "lv.sessao";
const ouvintes = new Set();

function lerDe(armazenamento) {
  try {
    return JSON.parse(armazenamento.getItem(CHAVE));
  } catch {
    return null;
  }
}

function gravar(valor) {
  for (const armazenamento of [sessionStorage, localStorage]) {
    try {
      if (valor) armazenamento.setItem(CHAVE, JSON.stringify(valor));
      else armazenamento.removeItem(CHAVE);
    } catch { /* armazenamento bloqueado: a sessão dura só até recarregar */ }
  }
}

function ler() {
  let sessao = lerDe(sessionStorage);
  if (!sessao) {
    sessao = lerDe(localStorage);
    if (sessao) {
      try { sessionStorage.setItem(CHAVE, JSON.stringify(sessao)); } catch { /* segue sem cópia local */ }
    }
  }
  if (!sessao) return null;
  // Mantém o registro expirado até o próximo login, para a tela de Login avisar "Sessão expirada".
  if (sessao.expiraEm && new Date(sessao.expiraEm) <= new Date()) return { expirada: true };
  return sessao;
}

export const sessao = {
  atual() {
    const s = ler();
    return s && !s.expirada ? s : null;
  },
  expirou() {
    return ler()?.expirada === true;
  },
  salvar({ token, usuario, expiraEm }) {
    gravar({ token, usuario, expiraEm });
    ouvintes.forEach((fn) => fn(this.atual()));
  },
  limpar() {
    gravar(null);
    ouvintes.forEach((fn) => fn(null));
  },
  aoMudar(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },
};
