import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Turma = require('../turma');

describe('Turma — link de compartilhamento', () => {
  it('turma nova não grava shareToken', () => {
    // Um null gravado entraria no índice único e colidiria com a próxima turma.
    const turma = new Turma({ name: 'X', ownerId: '6aa33a15df486702633893b6' });
    expect(turma.toObject()).not.toHaveProperty('shareToken');
  });

  it('desligar remove o token em vez de gravar null', () => {
    const turma = new Turma({ name: 'X', ownerId: '6aa33a15df486702633893b6' });
    turma.rotateShareToken();
    turma.disableSharing();
    expect(turma.toObject()).not.toHaveProperty('shareToken');
  });

  it('o índice único vale só para tokens de verdade', () => {
    const indice = Turma.schema.indexes().find(([campos]) => 'shareToken' in campos);
    expect(indice).toBeDefined();
    const [, opcoes] = indice;
    expect(opcoes.unique).toBe(true);
    expect(opcoes.partialFilterExpression).toEqual({ shareToken: { $type: 'string' } });
    expect(opcoes.sparse).toBeUndefined();
  });
});
