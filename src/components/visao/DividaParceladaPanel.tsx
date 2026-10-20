import { useEffect, useMemo, useState } from 'react';
import type { VisaoFinanceiraBruta } from '../../lib/visaoFinanceiraDados';
import {
  montarComprasNovas,
  montarFatiasDivida,
  type CompraParceladaNova,
  type FatiaDivida,
  type SituacaoFatiaDivida,
} from '../../lib/dividaParceladaModelo';
import {
  colunasComprasNovas,
  colunasDivida,
  comprasDoMes,
  destinoDaCompra,
  encerramentosDoMes,
  fatiasDoMes,
  filtrarComprasNovas,
  filtrarFatiasDivida,
  indicadoresDoMes,
  indicadoresInstituicaoDoMes,
  opcoesInstituicaoDivida,
  origemDoMes,
  resumoComprasDoMes,
  resumoPorInstituicao,
  type InstituicaoFiltroDivida,
} from '../../lib/dividaParceladaConsulta';
import {
  ROTULO_NATUREZA,
  monthKeyFromDate,
  rotuloMesLongo,
  type NaturezaFiltroVisao,
} from '../../lib/visaoFinanceiraModelo';
import { distribuirValorParcelas } from '../../lib/gastosParceladosFuturos';
import { formatCurrency, formatDateBR } from '../../utils';
import { DividaParceladaGrafico } from './DividaParceladaGrafico';

const NATUREZAS: { id: NaturezaFiltroVisao; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'nao_classificado', label: 'Não classificado' },
];

const ROTULO_SITUACAO_DIVIDA: Record<SituacaoFatiaDivida, string> = {
  projecao: 'Projeção',
  pendente: 'Pendente',
  vencido: 'Vencido',
  quitado: 'Quitado',
};

interface DividaParceladaPanelProps {
  bruto: VisaoFinanceiraBruta;
  hoje: Date;
}

function textoParticipacao(valor: number | null): string {
  if (valor == null) return '—';
  return `${Math.round(valor * 100)}%`;
}

function chaveCompra(compra: CompraParceladaNova): string {
  return compra.gastoId ? `g:${compra.gastoId}` : `c:${compra.compromissoId}`;
}

function textoValorParcela(totalCents: number, totalParcelas: number): string {
  const valores = distribuirValorParcelas(totalCents, totalParcelas);
  if (valores.length === 0) return '—';
  const base = valores[0];
  const ultima = valores[valores.length - 1];
  if (base === ultima) return formatCurrency(base);
  return `${formatCurrency(base)} · última ${formatCurrency(ultima)}`;
}

function rotuloOrigemCompra(compra: CompraParceladaNova): string {
  return compra.origemTipo === 'gasto_agenda' ? 'Gasto parcelado' : 'Compromisso parcelado';
}

export function DividaParceladaPanel({ bruto, hoje }: DividaParceladaPanelProps) {
  const [natureza, setNatureza] = useState<NaturezaFiltroVisao>('todas');
  const [instituicao, setInstituicao] = useState<InstituicaoFiltroDivida>('todas');
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);
  const [mesCompraGrafico, setMesCompraGrafico] = useState<string | null>(null);
  const [mesCompraDestino, setMesCompraDestino] = useState<string | null>(null);
  const [compraDestinoId, setCompraDestinoId] = useState<string | null>(null);

  const input = useMemo(() => ({
    hoje,
    gastos: bruto.gastos,
    tipoGastoPorId: bruto.tipoGastoPorId,
    gastoIdsPerene: bruto.gastoIdsPerene,
    gastoIdsParcela: bruto.gastoIdsParcela,
    compromissosParcelados: bruto.compromissosParcelados,
  }), [bruto, hoje]);

  const fatiasBase = useMemo(() => montarFatiasDivida(input), [input]);
  const comprasBase = useMemo(() => montarComprasNovas(input), [input]);
  const fatiasPorNatureza = useMemo(
    () => filtrarFatiasDivida(fatiasBase, natureza, 'todas'),
    [fatiasBase, natureza],
  );
  const opcoesInstituicao = useMemo(
    () => opcoesInstituicaoDivida(fatiasPorNatureza),
    [fatiasPorNatureza],
  );
  const fatias = useMemo(
    () => filtrarFatiasDivida(fatiasBase, natureza, instituicao),
    [fatiasBase, natureza, instituicao],
  );
  const compras = useMemo(
    () => filtrarComprasNovas(comprasBase, natureza, instituicao),
    [comprasBase, natureza, instituicao],
  );
  const colunas = useMemo(() => colunasDivida(fatias, hoje), [fatias, hoje]);
  const colunasCompras = useMemo(() => colunasComprasNovas(compras, hoje), [compras, hoje]);
  const chaveAtual = monthKeyFromDate(hoje);

  useEffect(() => {
    if (instituicao === 'todas') return;
    if (!opcoesInstituicao.includes(instituicao)) setInstituicao('todas');
  }, [instituicao, opcoesInstituicao]);

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

  useEffect(() => {
    if (colunasCompras.length === 0) {
      setMesCompraGrafico(null);
      return;
    }
    setMesCompraGrafico((atual) => {
      if (atual && colunasCompras.some((c) => c.monthKey === atual)) return atual;
      return colunasCompras.find((c) => c.monthKey === chaveAtual)?.monthKey ?? colunasCompras[0].monthKey;
    });
  }, [colunasCompras, chaveAtual]);

  const mes = mesSelecionado;
  const mesCompra = mesCompraGrafico;
  const resumoComprasMes = useMemo(
    () => (mesCompra ? resumoComprasDoMes(compras, mesCompra) : null),
    [compras, mesCompra],
  );
  const comprasDoMesGrafico = useMemo(
    () => (mesCompra ? comprasDoMes(compras, mesCompra) : []),
    [compras, mesCompra],
  );
  const indicadores = useMemo(
    () => (mes ? indicadoresDoMes(fatias, compras, mes) : null),
    [fatias, compras, mes],
  );
  const indicadoresInst = useMemo(
    () => (mes ? indicadoresInstituicaoDoMes(fatias, mes) : null),
    [fatias, mes],
  );
  const resumoInstituicoes = useMemo(
    () => (mes && instituicao === 'todas' ? resumoPorInstituicao(fatias, mes) : []),
    [fatias, mes, instituicao],
  );
  const origem = useMemo(() => (mes ? origemDoMes(fatias, mes) : []), [fatias, mes]);
  const detalhe = useMemo(() => (mes ? fatiasDoMes(fatias, mes) : []), [fatias, mes]);
  const encerramentos = useMemo(() => (mes ? encerramentosDoMes(fatias, mes) : []), [fatias, mes]);
  const novas = useMemo(() => (mes ? comprasDoMes(compras, mes) : []), [compras, mes]);

  const destino = useMemo(() => {
    if (compraDestinoId) {
      const compra = compras.find((c) => chaveCompra(c) === compraDestinoId);
      if (!compra) return [];
      return destinoDaCompra(fatias, {
        gastoId: compra.gastoId,
        compromissoId: compra.compromissoId,
      });
    }
    if (mesCompraDestino) return destinoDaCompra(fatias, { monthKeyCompra: mesCompraDestino });
    return [];
  }, [compraDestinoId, mesCompraDestino, compras, fatias]);

  const destinoTitulo = compraDestinoId
    ? compras.find((c) => chaveCompra(c) === compraDestinoId)?.fornecedor
    : mesCompraDestino
      ? rotuloMesLongo(mesCompraDestino)
      : null;

  function selecionarOrigem(monthKeyCompra: string) {
    setMesCompraDestino(monthKeyCompra);
    setCompraDestinoId(null);
  }

  function selecionarCompra(compra: CompraParceladaNova) {
    setCompraDestinoId(chaveCompra(compra));
    setMesCompraDestino(compra.monthKeyCompra);
  }

  return (
    <div className="divida-parcelada">
      <p className="visao-nota divida-parcelada__nota">
        Parcelas de cartão são previsão de calendário (dia 6), não pagamento confirmado.
        Só compromissos parcelados têm quitação por parcela. O saldo remanescente é obrigação projetada, não fatura nem dívida bancária.
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
        <fieldset className="visao-filtros__grupo">
          <legend>Instituição financeira</legend>
          <div className="visao-chips">
            <button
              type="button"
              className={instituicao === 'todas' ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
              aria-pressed={instituicao === 'todas'}
              onClick={() => setInstituicao('todas')}
            >
              Todas
            </button>
            {opcoesInstituicao.map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={instituicao === opcao ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
                aria-pressed={instituicao === opcao}
                onClick={() => setInstituicao(opcao)}
              >
                {opcao}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {colunas.length === 0 && colunasCompras.length === 0 ? (
        <p className="visao-estado">Nenhum parcelamento encontrado neste recorte.</p>
      ) : (
        <>
          <section className="divida-bloco-grafico" aria-label="Novas compras parceladas">
            <h2 className="divida-bloco-grafico__titulo">Novas compras parceladas</h2>
            <p className="divida-secao__ajuda">
              Valor integral no mês da compra (gastos parcelados e compromissos parcelados).
              Não distribui o total pelas parcelas futuras. Não some este gráfico ao de vencimentos.
            </p>
            {colunasCompras.length === 0 ? (
              <p className="visao-estado">Nenhuma compra parcelada neste recorte.</p>
            ) : (
              <>
                <DividaParceladaGrafico
                  colunas={colunasCompras}
                  mesSelecionado={mesCompra}
                  chaveMesAtual={chaveAtual}
                  onSelectMes={setMesCompraGrafico}
                  rotuloSerie="Compras do mês"
                  corBarra="#D6A84F"
                  ariaLabelGrafico="Evolução mensal das novas compras parceladas"
                  captionTabela="Valores integrais das compras parceladas por mês"
                />
                {mesCompra && resumoComprasMes ? (
                  <div className="divida-compras-resumo">
                    <h3>{rotuloMesLongo(mesCompra)}</h3>
                    <p>
                      <span>Novas compras parceladas</span>
                      <strong>
                        {formatCurrency(resumoComprasMes.totalCents)}
                        <small>
                          {' · '}
                          {resumoComprasMes.qtd === 1
                            ? '1 lançamento'
                            : `${resumoComprasMes.qtd} lançamentos`}
                        </small>
                      </strong>
                    </p>
                  </div>
                ) : null}
                <div className="divida-secao" aria-label="Composição das novas compras">
                  <h3>Composição das novas compras</h3>
                  {comprasDoMesGrafico.length === 0 ? (
                    <p className="visao-estado">Nenhuma compra parcelada neste mês.</p>
                  ) : (
                    <div className="divida-tabela__scroll">
                      <table className="divida-tabela divida-tabela--compras">
                        <thead>
                          <tr>
                            <th>Fornecedor / Local</th>
                            <th>Instituição financeira</th>
                            <th>Natureza</th>
                            <th className="divida-tabela__num">Valor total</th>
                            <th className="divida-tabela__num">Parcelas</th>
                            <th className="divida-tabela__num">Valor da parcela</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comprasDoMesGrafico.map((compra) => (
                            <tr key={compra.id}>
                              <td className="divida-tabela__fornecedor">
                                <button
                                  type="button"
                                  className="divida-link"
                                  onClick={() => selecionarCompra(compra)}
                                >
                                  <strong>{compra.fornecedor}</strong>
                                </button>
                                <span>{rotuloOrigemCompra(compra)}</span>
                              </td>
                              <td>{compra.instituicao}</td>
                              <td>{ROTULO_NATUREZA[compra.natureza]}</td>
                              <td className="divida-tabela__num divida-tabela__valor">
                                {formatCurrency(compra.totalCents)}
                              </td>
                              <td className="divida-tabela__num">{compra.totalParcelas}x</td>
                              <td className="divida-tabela__num">
                                {textoValorParcela(compra.totalCents, compra.totalParcelas)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3}>Total do mês</td>
                            <td className="divida-tabela__num divida-tabela__valor">
                              {formatCurrency(resumoComprasMes?.totalCents ?? 0)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {colunas.length === 0 ? (
            <p className="visao-estado">Nenhuma parcela por vencimento neste recorte.</p>
          ) : (
          <>
          <section className="divida-bloco-grafico" aria-label="Parcelas por mês de vencimento">
            <h2 className="divida-bloco-grafico__titulo">Parcelas por mês de vencimento</h2>
            <p className="divida-secao__ajuda">
              Distribuição das parcelas pela agenda do cartão e pelos compromissos. Perspectiva distinta das novas compras.
            </p>
          <DividaParceladaGrafico
            colunas={colunas}
            mesSelecionado={mes}
            chaveMesAtual={chaveAtual}
            onSelectMes={setMesSelecionado}
          />
          </section>

          {mes && indicadores && indicadoresInst ? (
            <section className="divida-indicadores" aria-label="Indicadores do mês">
              <h2>{rotuloMesLongo(mes)}</h2>
              <ul>
                <li>
                  <span title="Compras ou compromissos distintos com parcelas ainda em aberto">
                    Parcelamentos ativos
                  </span>
                  <strong>{indicadoresInst.qtdParcelamentosAtivos}</strong>
                </li>
                <li>
                  <span title="Quantidade de parcelas em aberto a partir deste mês">
                    Parcelas restantes
                  </span>
                  <strong>{indicadoresInst.qtdParcelasRestantes}</strong>
                </li>
                <li>
                  <span>Parcelas atribuídas ao mês</span>
                  <strong>{formatCurrency(indicadores.parcelasMesCents)}</strong>
                </li>
                <li>
                  <span title="Obrigação remanescente projetada após o mês">
                    Saldo remanescente projetado
                  </span>
                  <strong>{formatCurrency(indicadoresInst.saldoFuturoCents)}</strong>
                </li>
                <li>
                  <span>Novas compras parceladas</span>
                  <strong>
                    {formatCurrency(indicadores.novasComprasCents)}
                    <small> · {indicadores.qtdNovasCompras}</small>
                  </strong>
                </li>
                <li>
                  <span>Últimas parcelas previstas</span>
                  <strong>
                    {formatCurrency(indicadores.encerramentosCents)}
                    <small> · {indicadores.qtdEncerramentos}</small>
                  </strong>
                </li>
                <li>
                  <span title="Obrigação remanescente projetada no início do mês">
                    Saldo remanescente no início
                  </span>
                  <strong>{formatCurrency(indicadores.saldoInicioCents)}</strong>
                </li>
                <li>
                  <span title="Obrigação remanescente projetada após o mês">
                    Saldo remanescente no fim
                  </span>
                  <strong>{formatCurrency(indicadores.saldoFimCents)}</strong>
                </li>
              </ul>
            </section>
          ) : null}

          {mes && instituicao === 'todas' && resumoInstituicoes.length > 0 ? (
            <section className="divida-secao" aria-label="Resumo por instituição financeira">
              <h3>Por instituição financeira</h3>
              <p className="divida-secao__ajuda">
                Comparativo do mês selecionado. Parcelamentos ativos são compras ou compromissos distintos; parcelas restantes são as fatias ainda em aberto.
              </p>
              <div className="divida-tabela__scroll">
                <table className="divida-tabela">
                  <thead>
                    <tr>
                      <th>Instituição</th>
                      <th className="divida-tabela__num">Ativos</th>
                      <th className="divida-tabela__num">Parcelas restantes</th>
                      <th className="divida-tabela__num">Previsto no mês</th>
                      <th className="divida-tabela__num">Saldo futuro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoInstituicoes.map((linha) => (
                      <tr key={linha.instituicao}>
                        <td>
                          <button
                            type="button"
                            className="divida-link"
                            onClick={() => setInstituicao(linha.instituicao)}
                          >
                            {linha.instituicao}
                          </button>
                        </td>
                        <td className="divida-tabela__num">{linha.qtdParcelamentosAtivos}</td>
                        <td className="divida-tabela__num">{linha.qtdParcelasRestantes}</td>
                        <td className="divida-tabela__num">{formatCurrency(linha.parcelasMesCents)}</td>
                        <td className="divida-tabela__num divida-tabela__valor">
                          {formatCurrency(linha.saldoFuturoCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="divida-secao" aria-label="Origem das parcelas do mês">
            <h3>Origem das parcelas do mês</h3>
            {origem.length === 0 ? (
              <p className="visao-estado">Nenhuma parcela com vencimento neste mês.</p>
            ) : (
              <div className="divida-tabela__scroll">
                <table className="divida-tabela">
                  <thead>
                    <tr>
                      <th>Mês da compra</th>
                      <th className="divida-tabela__num">Valor no mês</th>
                      <th className="divida-tabela__num">Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {origem.map((linha) => (
                      <tr key={linha.monthKeyCompra}>
                        <td>
                          <button
                            type="button"
                            className="divida-link"
                            onClick={() => selecionarOrigem(linha.monthKeyCompra)}
                          >
                            {rotuloMesLongo(linha.monthKeyCompra)}
                          </button>
                        </td>
                        <td className="divida-tabela__num">{formatCurrency(linha.valorCents)}</td>
                        <td className="divida-tabela__num">{textoParticipacao(linha.participacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="divida-secao" aria-label="Composição detalhada">
            <h3>Composição detalhada</h3>
            {detalhe.length === 0 ? (
              <p className="visao-estado">Nenhuma parcela neste mês.</p>
            ) : (
              <div className="divida-tabela__scroll">
                <table className="divida-tabela divida-tabela--detalhe">
                  <colgroup>
                    <col className="divida-tabela__col--fornecedor" />
                    <col className="divida-tabela__col--instituicao" />
                    <col className="divida-tabela__col--compra" />
                    <col className="divida-tabela__col--parcela" />
                    <col className="divida-tabela__col--natureza" />
                    <col className="divida-tabela__col--vencimento" />
                    <col className="divida-tabela__col--valor" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Fornecedor / Local</th>
                      <th>Instituição</th>
                      <th>Compra</th>
                      <th>Parcela</th>
                      <th>Natureza</th>
                      <th className="divida-tabela__num">Vencimento</th>
                      <th className="divida-tabela__num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.map((linha) => (
                      <tr key={linha.id}>
                        <td className="divida-tabela__fornecedor">
                          <strong>{linha.fornecedor}</strong>
                          <span>{formatCurrency(linha.totalCompraCents)} total</span>
                        </td>
                        <td>{linha.instituicao}</td>
                        <td>
                          <button
                            type="button"
                            className="divida-link"
                            onClick={() => {
                              setMesCompraDestino(linha.monthKeyCompra);
                              setCompraDestinoId(
                                linha.gastoId ? `g:${linha.gastoId}` : `c:${linha.compromissoId}`,
                              );
                            }}
                          >
                            {rotuloMesLongo(linha.monthKeyCompra)}
                          </button>
                        </td>
                        <td>{linha.parcela}/{linha.totalParcelas}</td>
                        <td>{ROTULO_NATUREZA[linha.natureza]}</td>
                        <td className="divida-tabela__num">{formatDateBR(linha.dataVencimento)}</td>
                        <td className="divida-tabela__num divida-tabela__valor">
                          {formatCurrency(linha.valorCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6}>Total do mês</td>
                      <td className="divida-tabela__num divida-tabela__valor">
                        {formatCurrency(detalhe.reduce((s, f) => s + f.valorCents, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="divida-secao" aria-label="Últimas parcelas do mês">
            <h3>Últimas parcelas previstas no mês</h3>
            <p className="divida-secao__ajuda">
              No cartão, indica o fim da agenda prevista — não confirma pagamento.
            </p>
            {encerramentos.length === 0 ? (
              <p className="visao-estado">Nenhum parcelamento termina neste mês.</p>
            ) : (
              <ListaFatiasCompacta fatias={encerramentos} />
            )}
          </section>

          <section className="divida-secao" aria-label="Novas compras parceladas">
            <h3>Novas compras parceladas no mês</h3>
            {novas.length === 0 ? (
              <p className="visao-estado">Nenhuma compra parcelada cadastrada neste mês.</p>
            ) : (
              <div className="divida-tabela__scroll">
                <table className="divida-tabela">
                  <thead>
                    <tr>
                      <th>Fornecedor / Local</th>
                      <th>Origem</th>
                      <th>Parcelas</th>
                      <th>Natureza</th>
                      <th className="divida-tabela__num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novas.map((compra) => (
                      <tr key={compra.id}>
                        <td className="divida-tabela__fornecedor">
                          <button
                            type="button"
                            className="divida-link"
                            onClick={() => selecionarCompra(compra)}
                          >
                            <strong>{compra.fornecedor}</strong>
                          </button>
                        </td>
                        <td>
                          {compra.origemTipo === 'gasto_agenda' ? 'Agenda do cartão' : 'Compromisso'}
                        </td>
                        <td>{compra.totalParcelas}x</td>
                        <td>{ROTULO_NATUREZA[compra.natureza]}</td>
                        <td className="divida-tabela__num divida-tabela__valor">
                          {formatCurrency(compra.totalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="divida-secao" aria-label="Destino das compras">
            <h3>Destino das compras</h3>
            <p className="divida-secao__ajuda">
              Selecione um mês de origem ou uma compra nas tabelas acima para ver em quais meses as parcelas caem.
            </p>
            {destino.length === 0 || !destinoTitulo ? (
              <p className="visao-estado">Nenhuma compra selecionada para destino.</p>
            ) : (
              <>
                <p className="divida-destino__titulo">
                  Distribuição de <strong>{destinoTitulo}</strong>
                  {mesCompraDestino && !compraDestinoId ? ` (${rotuloMesLongo(mesCompraDestino)})` : ''}
                </p>
                <div className="divida-tabela__scroll">
                  <table className="divida-tabela">
                    <thead>
                      <tr>
                        <th>Mês do vencimento</th>
                        <th className="divida-tabela__num">Valor</th>
                        <th className="divida-tabela__num">Participação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {destino.map((linha) => (
                        <tr key={linha.monthKeyVencimento}>
                          <td>
                            <button
                              type="button"
                              className="divida-link"
                              onClick={() => setMesSelecionado(linha.monthKeyVencimento)}
                            >
                              {rotuloMesLongo(linha.monthKeyVencimento)}
                            </button>
                          </td>
                          <td className="divida-tabela__num">{formatCurrency(linha.valorCents)}</td>
                          <td className="divida-tabela__num">{textoParticipacao(linha.participacao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          </>
          )}
        </>
      )}
    </div>
  );
}

function ListaFatiasCompacta({ fatias }: { fatias: FatiaDivida[] }) {
  return (
    <div className="divida-tabela__scroll">
      <table className="divida-tabela">
        <thead>
          <tr>
            <th>Fornecedor / Local</th>
            <th>Parcela</th>
            <th>Situação</th>
            <th className="divida-tabela__num">Valor</th>
          </tr>
        </thead>
        <tbody>
          {fatias.map((linha) => (
            <tr key={linha.id}>
              <td className="divida-tabela__fornecedor"><strong>{linha.fornecedor}</strong></td>
              <td>{linha.parcela}/{linha.totalParcelas}</td>
              <td>{ROTULO_SITUACAO_DIVIDA[linha.situacao]}</td>
              <td className="divida-tabela__num divida-tabela__valor">{formatCurrency(linha.valorCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
