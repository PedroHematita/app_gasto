export type SelectOptionItem = { value: string; label: string };

export const SELECT_COMPACT_QUERY = '(max-width: 799px)';
export const SELECT_SEARCH_MIN_OPTIONS = 8;

export function toSelectOptionItems(options: readonly string[]): SelectOptionItem[] {
  return options.map((opt) => ({ value: opt, label: opt }));
}

export function filtrarOpcoesSelect(
  options: readonly SelectOptionItem[],
  query: string,
): SelectOptionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((opt) => opt.label.toLowerCase().includes(q));
}

export function selectDeveExibirPesquisa(totalOpcoes: number): boolean {
  return totalOpcoes >= SELECT_SEARCH_MIN_OPTIONS;
}
