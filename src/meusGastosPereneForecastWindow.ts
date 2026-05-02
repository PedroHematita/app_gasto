/**
 * Janela de previsão (30/60/90 dias) na tela Meus Gastos.
 * Persiste enquanto o bundle JS permanece carregado (session store).
 */
export type PereneForecastWindowDays = 30 | 60 | 90;

export const meusGastosPereneForecastWindow = {
  windowDays: 30 as PereneForecastWindowDays,
};

export function setMeusGastosPereneForecastWindowDays(d: PereneForecastWindowDays): void {
  meusGastosPereneForecastWindow.windowDays = d;
}
