import { useEffect, useMemo, useState } from 'react';
import type { VisaoFinanceiraBruta } from '../../lib/visaoFinanceiraDados';
import {
  ROTULO_PERIODICIDADE_PERENE,
  montarLinhasPerenesVisao,
} from '../../lib/gastosPerenesVisaoModelo';
import {
  colunasPerenes,
  composicaoDoMes,
  filtrarLinhasPerenes,
  totalDoMes,
} from '../../lib/gastosPerenesVisaoConsulta';
import {
  ROTULO_NATUREZA,
  monthKeyFromDate,
  rotuloMesLongo,
  type NaturezaFiltroVisao,
} from '../../lib/visaoFinanceiraModelo';
import { formatCurrency, formatDateBR } from '../../utils';
import { DividaParceladaGrafico } from './DividaParceladaGrafico';

const NATUREZAS: { id: NaturezaFiltroVisao; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'nao_classificado', label: 'Não classificado' },
];

interface GastosPerenesPanelProps {
  bruto: VisaoFinanceiraBruta;
  hoje: Date;
}

export function GastosPerenesPanel({ bruto, hoje }: GastosPerenesPanelProps) {
  const [natureza, setNatureza] = useState<NaturezaFiltroVisao>('todas');
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  const linhasBase = useMemo(
    () => montarLinhasPerenesVisao({
      hoje,
      gastos: bruto.gastos,
      tipoGastoPorId: bruto.tipoGastoPorId,
      gastoIdsPerene: bruto.gastoIdsPerene,
      gastoPereneIdPorGastoId: bruto.gastoPereneIdPorGastoId,
      compromissos: bruto.compromissos,
      perenes: bruto.perenes,
    }),
    [bruto, hoje],
  );

  const linhas = useMemo(() => filtrarLinhasPerenes(linhasBase, natureza), [linhasBase, natureza]);
  const colunas = useMemo(() => colunasPerenes(linhas, hoje), [linhas, hoje]);
  const chaveAtual = monthKeyFromDate(hoje);

  useEffect(() => {
    if (colunas.length === 0) {
      setMesSelecionado(null);
      return;
    }
    setMesSelecionado((atual) => {
      if (atual && colunas.some((c) => c.monthKey === atual)) return atual;
      return colunas.find((c) => c.monthKey === chaveAtual)?.monthKey ?? colunas[0].monthKey;
    });
  }, [colunas, chaveAtual]);

  const mes = mesSelecionado;
  const composicao = useMemo(() => (mes ? composicaoDoMes(linhas, mes) : []), [linhas, mes]);
  const totalMes = mes ? totalDoMes(linhas, mes) : 0;

  return (
    <div className="gastos-perenes">
      <p className="visao-nota divida-parcelada__nota">
        Projeções respeitam a periodicidade cadastrada e não são pagamento confirmado.
        Compromissos e previsões sem classificação aparecem como Não classificado — o filtro não inventa natureza.
      </p>

      <div className="visao-filtros">
        <fieldset className="visao-filtros__grupo">
          <legend>Natureza</legend>
          <div className="visao-chips">
            {NATUREZAS.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                className={natureza === opcao.id ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
                aria-pressed={natureza === opcao.id}
                onClick={() => setNatureza(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {colunas.length === 0 ? (
        <p className="visao-estado">Nenhum gasto perene encontrado neste recorte.</p>
      ) : (
        <>
          <section className="divida-bloco-grafico" aria-label="Evolução mensal dos gastos perenes">
            <h2 className="divida-bloco-grafico__titulo">Evolução mensal</h2>
            <DividaParceladaGrafico
              colunas={colunas}
              mesSelecionado={mes}
              chaveMesAtual={chaveAtual}
              onSelectMes={setMesSelecionado}
              rotuloSerie="Gastos perenes"
              corBarra="#8F7AD8"
              ariaLabelGrafico="Evolução mensal dos gastos perenes"
              captionTabela="Totais mensais dos gastos perenes"
            />
          </section>

          {mes ? (
            <section className="divida-compras-resumo" aria-label="Total do mês selecionado">
              <h3>{rotuloMesLongo(mes)}</h3>
              <p>
                <span>Gastos perenes</span>
                <strong>{formatCurrency(totalMes)}</strong>
              </p>
            </section>
          ) : null}

          <section className="divida-secao" aria-label="Composição do mês">
            <h3>Composição do mês</h3>
            {composicao.length === 0 ? (
              <p className="visao-estado">Nenhum gasto perene neste mês.</p>
            ) : (
              <div className="divida-tabela__scroll">
                <table className="divida-tabela divida-tabela--perenes">
                  <thead>
                    <tr>
                      <th>Gasto / Fornecedor</th>
                      <th>Natureza</th>
                      <th>Periodicidade</th>
                      <th className="divida-tabela__num">Vencimento</th>
                      <th className="divida-tabela__num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {composicao.map((linha) => (
                      <tr key={linha.id}>
                        <td className="divida-tabela__fornecedor">
                          <strong>{linha.fornecedor}</strong>
                          <span>{linha.origem}</span>
                        </td>
                        <td>{ROTULO_NATUREZA[linha.natureza]}</td>
                        <td>
                          {linha.periodicidade
                            ? ROTULO_PERIODICIDADE_PERENE[linha.periodicidade]
                            : '—'}
                        </td>
                        <td className="divida-tabela__num">{formatDateBR(linha.dataRef)}</td>
                        <td className="divida-tabela__num divida-tabela__valor">
                          {formatCurrency(linha.valorCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total do mês</td>
                      <td className="divida-tabela__num divida-tabela__valor">
                        {formatCurrency(totalMes)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
