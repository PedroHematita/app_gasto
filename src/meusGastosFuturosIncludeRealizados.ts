/**
 * Toggle "Incluir realizados" na seção Gastos futuros (sessão até reload).
 */
export const meusGastosFuturosIncludeRealizados = {
  include: false,
};

export function setMeusGastosFuturosIncludeRealizados(include: boolean): void {
  meusGastosFuturosIncludeRealizados.include = include;
}
