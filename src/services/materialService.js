/**
 * Regras dos materiais, puras para serem testáveis sem banco.
 */

/**
 * Normaliza e valida o link. Só http e https: um "javascript:" ou "data:"
 * guardado aqui viraria um clique que roda código no navegador de quem abrir.
 * Link sem protocolo ("drive.google.com/...") ganha https. Devolve null se
 * não der para aceitar.
 */
exports.linkValido = (bruto) => {
  if (typeof bruto !== 'string') return null;
  let texto = bruto.trim();
  if (!texto || texto.length > 2000) return null;

  // Sem protocolo: é o que acontece quando alguém copia da barra de endereço
  // do celular. Qualquer outro esquema ("javascript:", "data:") fica de fora.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(texto)) texto = `https://${texto}`;

  let url;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // Um host de verdade: sem ponto é endereço de rede interna ou erro de digitação.
  if (!url.hostname.includes('.')) return null;

  return url.toString();
};

/** Quem adicionou apaga o próprio; o representante apaga qualquer um. */
exports.podeApagarMaterial = (req, material, ehRepresentante) =>
  String(material.userId?._id ?? material.userId) === String(req.user?.id) || Boolean(ehRepresentante);
