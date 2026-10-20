import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ScreenHeader } from '../ScreenHeader';
import { formatCurrency, formatDateBR } from '../../utils';
import {
  formaExibida,
  instituicaoExibida,
  meioExibido,
  ordenarLancamentosVisao,
  proximaOrdenacao,
  type ColunaOrdenacaoVisao,
  type OrdenacaoVisao,
} from '../../lib/visaoFinanceiraOrdenacao';
import { carregarVisaoFinanceira } from '../../lib/visaoFinanceiraDados';
import {
  MODALIDADES_VISAO,
  ROTULO_MODALIDADE,
  ROTULO_NATUREZA,
  calcularEvolucao,
  colunasDoGrafico,
  filtrarLinhasVisao,
  CRITERIO_PERSPECTIVA,
  monthKeyFromDate,
  montarLinhasVisao,
  resumirLinhasVisao,
  rotuloMesCurto,
  rotuloMesLongo,
  type ModalidadeVisao,
  type NaturezaFiltroVisao,
  type PeriodoVisao,
  type PerspectivaVisao,
} from '../../lib/visaoFinanceiraModelo';
import { CORES_MODALIDADE, VisaoFinanceiraGrafico } from './VisaoFinanceiraGrafico';
import { DividaParceladaPanel } from './DividaParceladaPanel';
import { GastosPerenesPanel } from './GastosPerenesPanel';
import { FiltroColunaLancamento } from './FiltroColunaLancamento';
import {
  alternarOpcaoFiltro,
  filtrarLancamentosVisao,
  filtrosLancamentoAtivos,
  opcoesFiltroLancamento,
  type ColunaFiltroVisao,
  type FiltrosLancamentoVisao,
} from '../../lib/visaoFinanceiraFiltroLancamentos';
import './visao-financeira.css';

type AbaVisao = 'geral' | 'divida' | 'perenes';

interface VisaoFinanceiraScreenProps {
  orgId: string;
}

const NATUREZAS: { id: NaturezaFiltroVisao; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'nao_classificado', label: 'Não classificado' },
];

const PERIODOS: { id: PeriodoVisao; label: string }[] = [
  { id: 'historico', label: 'Histórico' },
  { id: 'mes_atual', label: 'Mês atual' },
  { id: 'futuro', label: 'Futuro' },
  { id: 'completa', label: 'Visão completa' },
];

const COLUNAS_LANCAMENTO: {
  id: ColunaOrdenacaoVisao;
  rotulo: string;
  numerica: boolean;
  ordena: boolean;
  filtra: boolean;
}[] = [
  { id: 'fornecedor', rotulo: 'Fornecedor / Local', numerica: false, ordena: true, filtra: false },
  { id: 'forma', rotulo: 'Forma de pagamento', numerica: false, ordena: false, filtra: true },
  { id: 'meio', rotulo: 'Meio de pagamento', numerica: false, ordena: false, filtra: true },
  { id: 'instituicao', rotulo: 'Instituição financeira', numerica: false, ordena: false, filtra: true },
  { id: 'classificacao', rotulo: 'Classificação', numerica: false, ordena: false, filtra: true },
  { id: 'data', rotulo: 'Data', numerica: true, ordena: true, filtra: false },
  { id: 'valor', rotulo: 'Valor', numerica: true, ordena: true, filtra: false },
];

function textoParticipacao(valor: number | null): string {
  if (valor == null) return '—';
  return `${Math.round(valor * 100)}%`;
}

function textoQuantidade(quantidade: number): string {
  return quantidade === 1 ? '1 lançamento' : `${quantidade} lançamentos`;
}

export function VisaoFinanceiraScreen({ orgId }: VisaoFinanceiraScreenProps) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [bruto, setBruto] = useState<Awaited<ReturnType<typeof carregarVisaoFinanceira>> | null>(null);
  const [perspectiva, setPerspectiva] = useState<PerspectivaVisao>('completa');
  const [natureza, setNatureza] = useState<NaturezaFiltroVisao>('todas');
  const [modalidades, setModalidades] = useState<ModalidadeVisao[]>([...MODALIDADES_VISAO]);
  const [periodo, setPeriodo] = useState<PeriodoVisao>('completa');
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);
  const [focoModalidade, setFocoModalidade] = useState<ModalidadeVisao | null>(null);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoVisao | null>(null);
  const [filtrosLancamento, setFiltrosLancamento] = useState<FiltrosLancamentoVisao>({});
  const [aba, setAba] = useState<AbaVisao>('geral');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    carregarVisaoFinanceira(orgId)
      .then((dados) => {
        if (!ativo) return;
        setBruto(dados);
        setAvisos(dados.avisos);
      })
      .catch(() => {
        if (!ativo) return;
        setErro('Não foi possível montar a visão com os dados atuais.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [orgId]);

  const hoje = useMemo(() => new Date(), []);

  const linhasBase = useMemo(() => {
    if (!bruto) return [];
    return montarLinhasVisao({
      hoje,
      gastos: bruto.gastos,
      tipoGastoPorId: bruto.tipoGastoPorId,
      gastoIdsPerene: bruto.gastoIdsPerene,
      gastoIdsParcela: bruto.gastoIdsParcela,
      compromissos: bruto.compromissos,
      perenes: bruto.perenes,
      perspectiva,
    });
  }, [bruto, hoje, perspectiva]);

  const linhasModalidade = useMemo(
    () => filtrarLinhasVisao(linhasBase, natureza, modalidades, 'completa', hoje),
    [linhasBase, natureza, modalidades, hoje]
  );

  const linhasPeriodo = useMemo(
    () => filtrarLinhasVisao(linhasBase, natureza, modalidades, periodo, hoje),
    [linhasBase, natureza, modalidades, periodo, hoje]
  );

  const colunas = useMemo(
    () => colunasDoGrafico(linhasPeriodo, periodo, hoje),
    [linhasPeriodo, periodo, hoje]
  );

  const resumo = useMemo(() => resumirLinhasVisao(linhasPeriodo), [linhasPeriodo]);
  const evolucao = useMemo(
    () => calcularEvolucao(linhasModalidade, periodo, hoje),
    [linhasModalidade, periodo, hoje]
  );

  useEffect(() => {
    if (colunas.length === 0) {
      setMesSelecionado(null);
      return;
    }
    setMesSelecionado((atual) => {
      if (atual && colunas.some((coluna) => coluna.monthKey === atual)) return atual;
      const chaveHoje = monthKeyFromDate(hoje);
      return colunas.find((coluna) => coluna.monthKey === chaveHoje)?.monthKey ?? colunas[0].monthKey;
    });
  }, [colunas, hoje]);

  const detalheBase = linhasPeriodo.filter((linha) => {
    if (mesSelecionado && linha.monthKey !== mesSelecionado) return false;
    if (focoModalidade && linha.modalidade !== focoModalidade) return false;
    return true;
  });
  const detalheFiltrado = filtrarLancamentosVisao(detalheBase, filtrosLancamento);
  const ordenacaoTabela = ordenacao && COLUNAS_LANCAMENTO.some((coluna) => coluna.ordena && coluna.id === ordenacao.coluna)
    ? ordenacao
    : null;
  const detalhe = ordenarLancamentosVisao(detalheFiltrado, ordenacaoTabela);
  const totalDetalheCents = detalheBase.reduce((soma, linha) => soma + linha.valorCents, 0);
  const totalFiltradoCents = detalhe.reduce((soma, linha) => soma + linha.valorCents, 0);
  const haFiltroLancamento = filtrosLancamentoAtivos(filtrosLancamento);
  const colunaSelecionada = colunas.find((coluna) => coluna.monthKey === mesSelecionado) ?? null;
  const totalMesCents = colunaSelecionada?.totalCents ?? 0;

  function alternarModalidade(id: ModalidadeVisao) {
    setModalidades((atual) => (
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    ));
  }

  const textoEvolucao = evolucao.variacao == null
    ? `Sem base em ${rotuloMesCurto(evolucao.mesBase)} para comparar com ${rotuloMesCurto(evolucao.mesReferencia)}.`
    : `${evolucao.variacao > 0 ? '+' : ''}${Math.round(evolucao.variacao * 100)}% de ${rotuloMesCurto(evolucao.mesBase)} para ${rotuloMesCurto(evolucao.mesReferencia)}.`;

  return (
    <div className="app-container visao-financeira">
      <ScreenHeader
        title="Visão Financeira — DEV"
        subtitle={
          aba === 'divida'
            ? 'Evolução das compras parceladas e da obrigação remanescente projetada'
            : aba === 'perenes'
              ? 'Evolução mensal dos gastos recorrentes e composição de cada mês'
              : 'Duas leituras separadas: o que foi cadastrado e o que vence em cada mês'
        }
        action={<BarChart3 size={18} aria-hidden />}
      />

      <nav className="visao-abas" aria-label="Seções da visão financeira">
        <button
          type="button"
          className={aba === 'geral' ? 'visao-aba visao-aba--ativa' : 'visao-aba'}
          aria-current={aba === 'geral' ? 'page' : undefined}
          onClick={() => setAba('geral')}
        >
          Visão Geral
        </button>
        <button
          type="button"
          className={aba === 'divida' ? 'visao-aba visao-aba--ativa' : 'visao-aba'}
          aria-current={aba === 'divida' ? 'page' : undefined}
          onClick={() => setAba('divida')}
        >
          Dívida Parcelada
        </button>
        <button
          type="button"
          className={aba === 'perenes' ? 'visao-aba visao-aba--ativa' : 'visao-aba'}
          aria-current={aba === 'perenes' ? 'page' : undefined}
          onClick={() => setAba('perenes')}
        >
          Gastos Perenes
        </button>
      </nav>

      {aba === 'divida' ? (
        <>
          {carregando ? <p className="visao-estado">Carregando parcelamentos...</p> : null}
          {erro ? <p className="visao-estado visao-estado--erro">{erro}</p> : null}
          {!carregando && !erro && bruto ? (
            <DividaParceladaPanel bruto={bruto} hoje={hoje} />
          ) : null}
          {avisos.length > 0 ? (
            <ul className="visao-avisos">
              {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
            </ul>
          ) : null}
        </>
      ) : null}

      {aba === 'perenes' ? (
        <>
          {carregando ? <p className="visao-estado">Carregando gastos perenes...</p> : null}
          {erro ? <p className="visao-estado visao-estado--erro">{erro}</p> : null}
          {!carregando && !erro && bruto ? (
            <GastosPerenesPanel bruto={bruto} hoje={hoje} />
          ) : null}
          {avisos.length > 0 ? (
            <ul className="visao-avisos">
              {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
            </ul>
          ) : null}
        </>
      ) : null}

      {aba === 'geral' ? (
      <>
      <div className="visao-filtros">
        <fieldset className="visao-filtros__grupo">
          <legend>Perspectiva</legend>
          <div className="visao-chips" role="group" aria-label="Perspectiva financeira">
            <button
              type="button"
              className={perspectiva === 'completa' ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
              aria-pressed={perspectiva === 'completa'}
              onClick={() => setPerspectiva('completa')}
            >
              Visão mensal completa
            </button>
            <button
              type="button"
              className={perspectiva === 'registrados' ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
              aria-pressed={perspectiva === 'registrados'}
              onClick={() => setPerspectiva('registrados')}
            >
              Gastos registrados
            </button>
            <button
              type="button"
              className={perspectiva === 'comprometimento' ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
              aria-pressed={perspectiva === 'comprometimento'}
              onClick={() => setPerspectiva('comprometimento')}
            >
              Comprometimento mensal
            </button>
          </div>
          <p className="visao-criterio">{CRITERIO_PERSPECTIVA[perspectiva]}</p>
        </fieldset>
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
          <legend>Modalidade</legend>
          <div className="visao-chips">
            <button
              type="button"
              className={modalidades.length === MODALIDADES_VISAO.length ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
              aria-pressed={modalidades.length === MODALIDADES_VISAO.length}
              onClick={() => setModalidades([...MODALIDADES_VISAO])}
            >
              Todas
            </button>
            {MODALIDADES_VISAO.map((id) => (
              <button
                key={id}
                type="button"
                className={modalidades.includes(id) ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
                aria-pressed={modalidades.includes(id)}
                onClick={() => alternarModalidade(id)}
              >
                {ROTULO_MODALIDADE[id]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="visao-filtros__grupo">
          <legend>Período</legend>
          <div className="visao-chips">
            {PERIODOS.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                className={periodo === opcao.id ? 'visao-chip visao-chip--ativo' : 'visao-chip'}
                aria-pressed={periodo === opcao.id}
                onClick={() => setPeriodo(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {carregando ? <p className="visao-estado">Carregando lançamentos...</p> : null}
      {erro ? <p className="visao-estado visao-estado--erro">{erro}</p> : null}

      {!carregando && !erro && (
        <>
          <section className="visao-resumo" aria-label="Indicadores do período">
            <p>
              <span>
                {perspectiva === 'registrados'
                  ? 'Total registrado no período'
                  : perspectiva === 'comprometimento'
                    ? 'Comprometido no período'
                    : 'Composição do período'}
              </span>
              <strong>{formatCurrency(resumo.totalCents)}</strong>
            </p>
            {MODALIDADES_VISAO.map((id) => (
              <p key={id}>
                <span>{ROTULO_MODALIDADE[id]}</span>
                <strong>
                  {formatCurrency(resumo.porModalidade[id])}
                  <small> {textoParticipacao(resumo.participacao[id])}</small>
                </strong>
              </p>
            ))}
            <p className="visao-resumo__evolucao">
              <span>Evolução</span>
              <strong>{textoEvolucao}</strong>
            </p>
          </section>

          {modalidades.length === 0 ? (
            <p className="visao-estado">Selecione ao menos uma modalidade para comparar.</p>
          ) : (
            <>
              <VisaoFinanceiraGrafico
                colunas={colunas}
                mesSelecionado={mesSelecionado}
                chaveMesAtual={monthKeyFromDate(hoje)}
                onSelectMes={setMesSelecionado}
              />
              <p className="visao-nota">
                {perspectiva === 'registrados'
                  ? 'Meses futuros usam cor mais clara. O valor é o cadastrado na data do gasto e não inclui compromisso ainda em aberto.'
                  : perspectiva === 'comprometimento'
                    ? 'Meses futuros usam cor mais clara. Coluna vazia não significa ausência de despesa. A agenda do cartão é previsão de calendário, mesmo depois do vencimento, e não é um pagamento confirmado.'
                    : 'Meses futuros usam cor mais clara. A coluna reúne o que foi registrado, o que vence e o que é projeção. A agenda do cartão não é um pagamento confirmado.'}
              </p>
              <ul className="visao-legenda">
                {MODALIDADES_VISAO.map((id) => {
                  const valorCents = colunaSelecionada?.porModalidade[id] ?? 0;
                  const participacao = totalMesCents > 0 ? valorCents / totalMesCents : null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={focoModalidade === id ? 'visao-legenda__item visao-legenda__item--ativo' : 'visao-legenda__item'}
                        aria-pressed={focoModalidade === id}
                        onClick={() => setFocoModalidade((atual) => (atual === id ? null : id))}
                      >
                        <i style={{ background: CORES_MODALIDADE[id] }} />
                        <span className="visao-legenda__texto">
                          <span className="visao-legenda__nome">{ROTULO_MODALIDADE[id]}</span>
                          <span className="visao-legenda__valor">
                            {formatCurrency(valorCents)}
                            {' · '}
                            {textoParticipacao(participacao)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <section className="visao-detalhe" aria-label="Registros do mês">
            <div className="visao-detalhe__cabecalho">
              <h2>
                {mesSelecionado ? rotuloMesLongo(mesSelecionado) : 'Registros'}
                {focoModalidade ? ` · ${ROTULO_MODALIDADE[focoModalidade]}` : ''}
              </h2>
              <p className="visao-detalhe__total">
                <span>
                  {perspectiva === 'registrados'
                    ? 'Total do mês'
                    : perspectiva === 'comprometimento'
                      ? 'Comprometido no mês'
                      : 'Composição do mês'}
                </span>
                <strong>{formatCurrency(totalDetalheCents)}</strong>
              </p>
            </div>
            {detalheBase.length > 0 ? (
              <p className="visao-detalhe__consulta">
                <span>
                  {textoQuantidade(detalhe.length)}
                  {haFiltroLancamento ? ` · Total filtrado ${formatCurrency(totalFiltradoCents)}` : ''}
                </span>
                {haFiltroLancamento ? (
                  <button type="button" onClick={() => setFiltrosLancamento({})}>
                    Limpar filtros
                  </button>
                ) : null}
              </p>
            ) : null}
            {detalheBase.length === 0 ? (
              <p className="visao-estado">Nenhum registro neste recorte.</p>
            ) : (
              <div className="visao-lancamentos__scroll">
                <table className="visao-lancamentos">
                  <colgroup>
                    {COLUNAS_LANCAMENTO.map((coluna) => (
                      <col key={coluna.id} className={`visao-lancamentos__medida visao-lancamentos__medida--${coluna.id}`} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {COLUNAS_LANCAMENTO.map((coluna) => {
                        const ativa = ordenacaoTabela?.coluna === coluna.id;
                        const sentido = ativa ? ordenacaoTabela.sentido : undefined;
                        return (
                          <th
                            key={coluna.id}
                            aria-sort={
                              coluna.ordena
                                ? sentido === 'asc'
                                  ? 'ascending'
                                  : sentido === 'desc'
                                    ? 'descending'
                                    : 'none'
                                : undefined
                            }
                            className={
                              coluna.id === 'data'
                                ? 'visao-lancamentos__col--data'
                                : coluna.id === 'valor'
                                  ? 'visao-lancamentos__col--valor'
                                  : undefined
                            }
                          >
                            <div className="visao-lancamentos__cabeca">
                              {coluna.filtra ? (
                                <FiltroColunaLancamento
                                  rotulo={coluna.rotulo}
                                  opcoes={opcoesFiltroLancamento(detalheBase, coluna.id as ColunaFiltroVisao)}
                                  selecionadas={filtrosLancamento[coluna.id as ColunaFiltroVisao] ?? []}
                                  onAlternar={(opcao) => {
                                    setFiltrosLancamento((atual) =>
                                      alternarOpcaoFiltro(atual, coluna.id as ColunaFiltroVisao, opcao),
                                    );
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="visao-lancamentos__ordenar"
                                  onClick={() => setOrdenacao((atual) => proximaOrdenacao(atual, coluna.id))}
                                >
                                  {coluna.rotulo}
                                  {ativa ? <span aria-hidden>{sentido === 'asc' ? '↑' : '↓'}</span> : null}
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.length === 0 ? (
                      <tr>
                        <td className="visao-lancamentos__vazio" colSpan={COLUNAS_LANCAMENTO.length}>
                          Nenhum lançamento com esses filtros.
                        </td>
                      </tr>
                    ) : null}
                    {detalhe.map((linha) => (
                      <tr key={linha.id}>
                        <td className="visao-lancamentos__fornecedor">
                          <strong>{linha.fornecedor}</strong>
                        </td>
                        <td>{formaExibida(linha.formaPagamento)}</td>
                        <td>{meioExibido(linha.meioPagamento)}</td>
                        <td>{instituicaoExibida(linha.instituicaoFinanceira)}</td>
                        <td>{ROTULO_NATUREZA[linha.natureza]}</td>
                        <td className="visao-lancamentos__data">{formatDateBR(linha.dataRef)}</td>
                        <td className="visao-lancamentos__valor">{formatCurrency(linha.valorCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {avisos.length > 0 ? (
            <ul className="visao-avisos">
              {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
            </ul>
          ) : null}
        </>
      )}
      </>
      ) : null}
    </div>
  );
}
