import {
  itemLinhaCompleta,
  totalGastoCentavos,
  type GastoRascunhoLote,
  type ItemRascunhoLote,
} from '../../lib/cadastroMultiplo/modelo';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const ABREV_UNIDADE: Record<string, string> = {
  Litro: 'L',
  Mililitro: 'ml',
  Quilograma: 'kg',
  Grama: 'g',
  Metro: 'm',
  'Metro Cúbico': 'm³',
};

export function compararDataBR(a: string, b: string): number {
  const [da, ma, ya] = a.split('/').map(Number);
  const [db, mb, yb] = b.split('/').map(Number);
  return ya - yb || ma - mb || da - db;
}

export function formatarDiaRevisao(dataCompraBR: string): string {
  const [d, m, y] = dataCompraBR.split('/').map(Number);
  if (!d || !m || !y) return dataCompraBR;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return dataCompraBR;
  return `${DIAS_SEMANA[date.getDay()]}, ${d} ${MESES_CURTOS[m - 1]}`;
}

function abreviarUnidade(unidade: string): string {
  return ABREV_UNIDADE[unidade] ?? unidade;
}

/** Resumo do primeiro item completo para a linha do gasto. */
export function resumoPrimeiroItem(item: ItemRascunhoLote): string {
  const desc = item.descricao.trim().replace(/\s+/g, ' ');
  const un = item.unidade.trim();
  if (un && un !== 'Unidade' && un !== 'Serviço') {
    const qtd = item.quantidade.trim().replace('.', ',');
    return `${desc} ${qtd} ${abreviarUnidade(un)}`;
  }
  return desc;
}

export function resumoItensGasto(gasto: GastoRascunhoLote): string {
  const completos = gasto.itens.filter(itemLinhaCompleta);
  if (completos.length === 0) return '';
  const primeiro = resumoPrimeiroItem(completos[0]);
  const extras = completos.length - 1;
  if (extras <= 0) return primeiro;
  return `${primeiro} e mais ${extras}`;
}

export function gruposRevisaoPorDia(gastos: GastoRascunhoLote[]): Array<{
  dataCompraBR: string;
  labelDia: string;
  subtotalCentavos: number;
  gastos: GastoRascunhoLote[];
}> {
  const porDia = new Map<string, GastoRascunhoLote[]>();
  for (const g of gastos) {
    const lista = porDia.get(g.dataCompraBR) ?? [];
    lista.push(g);
    porDia.set(g.dataCompraBR, lista);
  }
  const dias = [...porDia.keys()].sort(compararDataBR);
  return dias.map((dataCompraBR) => {
    const lista = porDia.get(dataCompraBR) ?? [];
    return {
      dataCompraBR,
      labelDia: formatarDiaRevisao(dataCompraBR),
      subtotalCentavos: lista.reduce((s, g) => s + totalGastoCentavos(g), 0),
      gastos: lista,
    };
  });
}

export function contarDiasLote(gastos: GastoRascunhoLote[]): number {
  return new Set(gastos.map((g) => g.dataCompraBR)).size;
}
