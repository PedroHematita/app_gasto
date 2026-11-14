import type { GastoRecord } from '../types';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export type MesGastosGroup = {
  key: string;
  year: number;
  month: number;
  label: string;
  gastos: GastoRecord[];
  total: number;
  count: number;
};

export type AnoGastosGroup = {
  year: number;
  total: number;
  months: MesGastosGroup[];
};

/** Calendário dd/mm/aaaa → YYYY-MM-DD, sem Date (evita deslocamento de fuso). */
export function isoCalendarioDeDataCompraBR(dataCompraBR: string): string | null {
  const parts = dataCompraBR.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Principal: data_compra desc. Empate: createdAt desc, depois id desc.
 * createdAt nunca substitui a data do gasto.
 */
export function compareGastosPorDataCompraDesc(a: GastoRecord, b: GastoRecord): number {
  const isoA = isoCalendarioDeDataCompraBR(a.dataCompra) ?? '';
  const isoB = isoCalendarioDeDataCompraBR(b.dataCompra) ?? '';
  const byCompra = isoB.localeCompare(isoA);
  if (byCompra !== 0) return byCompra;
  const byCreated = (b.createdAt || '').localeCompare(a.createdAt || '');
  if (byCreated !== 0) return byCreated;
  return b.id.localeCompare(a.id);
}

export function agruparGastosPorDataCompra(gastos: GastoRecord[]): AnoGastosGroup[] {
  const monthMap = new Map<string, MesGastosGroup>();

  for (const gasto of gastos) {
    const iso = isoCalendarioDeDataCompraBR(gasto.dataCompra);
    if (!iso) continue;
    const year = Number(iso.slice(0, 4));
    const month = Number(iso.slice(5, 7));
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        year,
        month,
        label: MONTH_NAMES[month - 1] ?? '',
        gastos: [],
        total: 0,
        count: 0,
      });
    }

    const monthGroup = monthMap.get(key)!;
    monthGroup.gastos.push(gasto);
    monthGroup.total += gasto.total;
    monthGroup.count += 1;
  }

  const months = [...monthMap.values()]
    .map((monthGroup) => ({
      ...monthGroup,
      gastos: [...monthGroup.gastos].sort(compareGastosPorDataCompraDesc),
    }))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));

  const yearMap = new Map<number, MesGastosGroup[]>();
  for (const monthGroup of months) {
    if (!yearMap.has(monthGroup.year)) yearMap.set(monthGroup.year, []);
    yearMap.get(monthGroup.year)!.push(monthGroup);
  }

  return [...yearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthsInYear]) => ({
      year,
      total: monthsInYear.reduce((sum, monthGroup) => sum + monthGroup.total, 0),
      months: monthsInYear,
    }));
}
