/**
 * Limites da janela de previsão (N dias incluindo o dia inicial).
 * Usado por utils e por gastosPerenePeriods — uma única definição.
 */

function sod(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Último dia inclusivo da janela: [windowStart, resultado], ambos só data local.
 * N dias incluindo o primeiro dia = avança (N − 1) dias a partir de windowStart.
 */
export function endOfForecastWindowInclusive(windowStart: Date, windowDays: number): Date {
  const start = sod(windowStart);
  const end = new Date(start);
  end.setDate(end.getDate() + windowDays - 1);
  return sod(end);
}

export function isDateInForecastWindow(due: Date, windowStart: Date, windowDays: number): boolean {
  const start = sod(windowStart);
  const endSod = endOfForecastWindowInclusive(windowStart, windowDays);
  const d = sod(due);
  return d.getTime() >= start.getTime() && d.getTime() <= endSod.getTime();
}
