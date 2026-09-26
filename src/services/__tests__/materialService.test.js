import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { linkValido, podeApagarMaterial } = require('../materialService');

describe('linkValido', () => {
  it('aceita http e https', () => {
    expect(linkValido('https://drive.google.com/file/d/abc/view')).toBe('https://drive.google.com/file/d/abc/view');
    expect(linkValido('http://site.com.br/lista.pdf')).toBe('http://site.com.br/lista.pdf');
  });

  it('completa link sem protocolo com https', () => {
    expect(linkValido('youtube.com/watch?v=abc')).toBe('https://youtube.com/watch?v=abc');
    expect(linkValido('  docs.google.com/presentation/d/1  ')).toBe('https://docs.google.com/presentation/d/1');
  });

  it('recusa esquemas que rodam código ou não são web', () => {
    expect(linkValido('javascript:alert(1)')).toBeNull();
    expect(linkValido('JAVASCRIPT:alert(1)')).toBeNull();
    expect(linkValido('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(linkValido('file:///etc/passwd')).toBeNull();
    expect(linkValido('ftp://arquivos.com/x')).toBeNull();
  });

  it('recusa o que não é link', () => {
    expect(linkValido('')).toBeNull();
    expect(linkValido('   ')).toBeNull();
    expect(linkValido('olha a lista')).toBeNull();
    expect(linkValido('https://localhost/x')).toBeNull();
    expect(linkValido(undefined)).toBeNull();
    expect(linkValido('https://' + 'a'.repeat(2000) + '.com')).toBeNull();
  });
});

describe('podeApagarMaterial', () => {
  const material = { userId: 'autor' };

  it('quem adicionou apaga', () => {
    expect(podeApagarMaterial({ user: { id: 'autor' } }, material, false)).toBe(true);
  });

  it('colega não apaga o de outra pessoa', () => {
    expect(podeApagarMaterial({ user: { id: 'colega' } }, material, false)).toBe(false);
  });

  it('representante apaga qualquer um, inclusive com autor populado', () => {
    expect(podeApagarMaterial({ user: { id: 'rep' } }, { userId: { _id: 'autor' } }, true)).toBe(true);
  });
});
