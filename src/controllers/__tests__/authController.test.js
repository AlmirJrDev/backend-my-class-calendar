import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const User = require('../../models/user');

const fonte = readFileSync(new URL('../authController.js', import.meta.url), 'utf8');

describe('authController — papéis', () => {
  it('só usa papéis que o modelo aceita', () => {
    // O cadastro criava o usuário com role "student", que saiu do enum na
    // migração de papéis: o Mongoose recusava e todo cadastro novo virava 500.
    const usados = [...fonte.matchAll(/role:\s*'([^']+)'/g)].map((m) => m[1]);
    const validos = User.schema.path('role').enumValues;

    expect(usados.every((papel) => validos.includes(papel))).toBe(true);
  });

  it('usuário novo nasce como "user"', () => {
    const novo = new User({ email: 'a@b.com', name: 'A' });
    expect(novo.role).toBe('user');
    expect(User.schema.path('role').enumValues).toEqual(['superadmin', 'user']);
  });
});
