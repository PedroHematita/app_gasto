import { describe, it, expect } from 'vitest';
import { normalizeDescricao } from './utils';

describe('normalizeDescricao', () => {
  it('trim + lower + colapsa espaços', () => {
    expect(normalizeDescricao('  Café   COM  Leite  ')).toBe('café com leite');
  });

  it('string vazia ou só espaços', () => {
    expect(normalizeDescricao('')).toBe('');
    expect(normalizeDescricao('   ')).toBe('');
  });

  it('mesma chave para variantes de capitalização e espaços', () => {
    expect(normalizeDescricao('Arroz')).toBe(normalizeDescricao('  arroz  '));
  });
});
