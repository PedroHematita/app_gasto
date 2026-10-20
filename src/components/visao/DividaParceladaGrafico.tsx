import { useLayoutEffect, useRef } from 'react';
import { rotuloMesCurto } from '../../lib/visaoFinanceiraModelo';
import { scrollInicialGrafico } from '../../lib/visaoFinanceiraRolagem';
import type { ColunaDivida } from '../../lib/dividaParceladaConsulta';
import { formatCurrency } from '../../utils';

const LARGURA_COLUNA = 88;
const ALTURA = 220;
const COR_BARRA_PADRAO = '#7FA6C9';

interface DividaParceladaGraficoProps {
  colunas: ColunaDivida[];
  mesSelecionado: string | null;
  chaveMesAtual: string;
  onSelectMes: (monthKey: string) => void;
  rotuloSerie?: string;
  corBarra?: string;
  ariaLabelGrafico?: string;
  captionTabela?: string;
}

function valorCompacto(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) {
    return `${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export function DividaParceladaGrafico({
  colunas,
  mesSelecionado,
  chaveMesAtual,
  onSelectMes,
  rotuloSerie = 'Parcelas do mês',
  corBarra = COR_BARRA_PADRAO,
  ariaLabelGrafico = 'Evolução mensal das parcelas',
  captionTabela = 'Valores mensais das parcelas',
}: DividaParceladaGraficoProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const eixoPosicionado = useRef<string | null>(null);
  const eixo = colunas.map((coluna) => coluna.monthKey).join('|');

  useLayoutEffect(() => {
    const area = scrollRef.current;
    if (!area) return;
    const posicionar = () => {
      const chaves = eixo ? eixo.split('|') : [];
      if (chaves.length === 0 || area.clientWidth === 0) return;
      if (eixoPosicionado.current === eixo) return;
      eixoPosicionado.current = eixo;
      area.scrollLeft = scrollInicialGrafico({
        chaves,
        chaveAtual: chaveMesAtual,
        larguraColuna: LARGURA_COLUNA,
        larguraVisivel: area.clientWidth,
        larguraConteudo: area.scrollWidth,
      });
    };
    posicionar();
    const observador = new ResizeObserver(posicionar);
    observador.observe(area);
    return () => observador.disconnect();
  }, [chaveMesAtual, eixo]);

  const margemTopo = 16;
  const margemBase = 28;
  const plotH = ALTURA - margemTopo - margemBase;
  const largura = Math.max(colunas.length * LARGURA_COLUNA, LARGURA_COLUNA);
  const maximo = Math.max(...colunas.map((coluna) => coluna.totalCents), 1);
  const barraLargura = 28;

  return (
    <div className="visao-grafico">
      <div className="visao-grafico__fixo">
        <div className="visao-grafico__eixo" aria-hidden>
          <span>{valorCompacto(maximo)}</span>
          <span>{valorCompacto(Math.round(maximo / 2))}</span>
          <span>0</span>
        </div>
        <div className="visao-tabela__rotulos">
          <span className="visao-tabela__rotulo visao-tabela__rotulo--total">{rotuloSerie}</span>
        </div>
      </div>
      <div className="visao-grafico__scroll" ref={scrollRef}>
        <svg
          className="visao-grafico__svg"
          width={largura}
          height={ALTURA}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          aria-label={ariaLabelGrafico}
        >
          {colunas.map((coluna, indice) => {
            const x = indice * LARGURA_COLUNA + (LARGURA_COLUNA - barraLargura) / 2;
            const h = coluna.totalCents > 0 ? (coluna.totalCents / maximo) * plotH : 0;
            const y = margemTopo + plotH - h;
            const selecionada = coluna.monthKey === mesSelecionado;
            return (
              <g key={coluna.monthKey}>
                {h > 0 ? (
                  <rect
                    x={x}
                    y={y}
                    width={barraLargura}
                    height={Math.max(h, 1)}
                    rx={2}
                    fill={corBarra}
                    opacity={coluna.fase === 'futuro' ? 0.55 : 1}
                  >
                    <title>{`${rotuloMesCurto(coluna.monthKey)} · ${formatCurrency(coluna.totalCents)}`}</title>
                  </rect>
                ) : null}
                {coluna.fase === 'atual' ? (
                  <rect
                    x={x - 4}
                    y={margemTopo}
                    width={barraLargura + 8}
                    height={plotH}
                    fill="none"
                    stroke="#DC615C"
                    strokeDasharray="3 3"
                  />
                ) : null}
                <text
                  x={indice * LARGURA_COLUNA + LARGURA_COLUNA / 2}
                  y={ALTURA - 8}
                  textAnchor="middle"
                  className="visao-grafico__mes"
                  fill={selecionada ? '#F0F0EB' : '#ACACAC'}
                >
                  {rotuloMesCurto(coluna.monthKey)}
                </text>
                <rect
                  x={indice * LARGURA_COLUNA}
                  y={0}
                  width={LARGURA_COLUNA}
                  height={ALTURA}
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  aria-pressed={selecionada}
                  aria-label={`${rotuloMesCurto(coluna.monthKey)}, ${coluna.fase}`}
                  onClick={() => onSelectMes(coluna.monthKey)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectMes(coluna.monthKey);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
        <table className="visao-tabela" style={{ width: largura }}>
          <caption className="visao-tabela__caption">{captionTabela}</caption>
          <tbody>
            <tr className="visao-tabela__linha--total">
              {colunas.map((coluna) => {
                const selecionada = coluna.monthKey === mesSelecionado;
                return (
                  <td
                    key={coluna.monthKey}
                    className={[
                      selecionada ? 'visao-tabela__celula--selecionada' : '',
                      coluna.fase === 'futuro' ? 'visao-tabela__celula--futura' : '',
                    ].filter(Boolean).join(' ') || undefined}
                    style={{ width: LARGURA_COLUNA }}
                  >
                    <button type="button" onClick={() => onSelectMes(coluna.monthKey)}>
                      {formatCurrency(coluna.totalCents)}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
