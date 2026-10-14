/**
 * Origens que o navegador pode usar para chamar a API.
 *
 * Função pura (recebe o env) para ser testável sem subir o servidor.
 *
 * - FRONTEND_URL é o endereço principal do site. Também entra nos links dos
 *   e-mails de login, então deve ser um endereço só.
 * - O mesmo site com e sem "www" conta como uma origem só: o navegador trata
 *   myclasscalendar.com.br e www.myclasscalendar.com.br como origens diferentes,
 *   e o domínio redireciona de um para o outro.
 * - CORS_ORIGINS lista endereços extras separados por vírgula, por exemplo o
 *   endereço antigo da Vercel enquanto as pessoas ainda o usam.
 */

const DESENVOLVIMENTO = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4173', // vite preview
];

/** "HTTPS://Site.com/" → "https://site.com". Devolve null se não for uma origem http(s) válida. */
function normalizarOrigem(valor) {
  if (!valor) return null;
  try {
    const url = new URL(String(valor).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** A mesma origem com o "www" colocado ou retirado. */
function variantesDeWww(origem) {
  const url = new URL(origem);
  // Só faz sentido para domínio com nome; IP e localhost não têm www.
  if (url.hostname === 'localhost' || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) {
    return [origem];
  }
  const outro = url.hostname.startsWith('www.') ? url.hostname.slice(4) : `www.${url.hostname}`;
  return [origem, `${url.protocol}//${outro}${url.port ? `:${url.port}` : ''}`];
}

function origensPermitidas(env = process.env) {
  const origens = new Set(DESENVOLVIMENTO);

  const principal = normalizarOrigem(env.FRONTEND_URL);
  if (principal) variantesDeWww(principal).forEach((o) => origens.add(o));

  for (const extra of String(env.CORS_ORIGINS || '').split(',')) {
    const origem = normalizarOrigem(extra);
    if (origem) origens.add(origem);
  }

  return origens;
}

/** Função `origin` do pacote cors. */
function verificarOrigem(env = process.env) {
  const permitidas = origensPermitidas(env);
  return (origin, callback) => {
    // Sem Origin = chamada server-to-server (curl, health check), liberada.
    // Origem desconhecida: responde sem o cabeçalho e deixa o navegador
    // barrar. Lançar erro aqui cairia no handler global, devolvendo 500 e
    // gravando um stack trace a cada requisição bloqueada.
    callback(null, !origin || permitidas.has(normalizarOrigem(origin)));
  };
}

module.exports = { origensPermitidas, verificarOrigem, normalizarOrigem };
