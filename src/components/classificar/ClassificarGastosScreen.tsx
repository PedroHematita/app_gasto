import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  classificarGastosEmMassa,
  fetchGastosParaClassificacao,
  supabase,
} from '../../lib/supabase';
import {
  aplicarFiltrosEOrdenacaoClassificacao,
  CLASSIFICAR_FILTROS_VAZIO,
  CLASSIFICAR_ORDENACAO_PADRAO,
  formatCurrency,
  idsVisiveisParaClassificacao,
  listarFornecedoresClassificacao,
  listarInstituicoesClassificacao,
  listarMeiosPagamentoClassificacao,
  proximaOrdenacaoValorClassificacao,
  validarClassificacaoMassaComAuth,
  rotuloFiltroDataClassificacao,
  rotuloFiltroFornecedorClassificacao,
  rotuloFiltroPagamentoClassificacao,
  rotuloFiltroClassificacaoRapida,
  CLASSIFICAR_FILTRO_CLASSIFICACAO_OPCOES,
  temFiltroDataClassificacaoAtivo,
  temFiltroFornecedorClassificacaoAtivo,
  temFiltroPagamentoClassificacaoAtivo,
  temFiltrosClassificacaoAtivos,
} from '../../utils';
import type {
  ClassificarFiltroClassificacao,
  ClassificarFiltroData,
  ClassificarFiltroPagamento,
  ClassificarFiltrosState,
  ClassificarOrdenacaoState,
  GastoClassificacaoRow,
} from '../../types';
import type { ClassificacaoGastoOpcao } from '../../utils';
import { ClassificarFiltroDataSheet } from './ClassificarFiltroDataSheet';
import { ClassificarSelecionadosSheet } from './ClassificarSelecionadosSheet';
import { ClassificarFiltroFornecedorSheet } from './ClassificarFiltroFornecedorSheet';
import { ClassificarFiltroPagamentoSheet } from './ClassificarFiltroPagamentoSheet';
import { ClassificarGastoRow } from './ClassificarGastoRow';
import { ScreenHeader } from '../ScreenHeader';

interface ClassificarGastosScreenProps {
  orgId: string;
  refreshKey: number;
  onOpenGastoDetail: (gastoId: string) => void;
}

function pruneSelectionToVisible(
  selectedIds: Set<string>,
  visible: GastoClassificacaoRow[]
): Set<string> {
  const visibleIds = new Set(visible.map((g) => g.id));
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (visibleIds.has(id)) next.add(id);
  }
  return next;
}

export const ClassificarGastosScreen: React.FC<ClassificarGastosScreenProps> = ({
  orgId,
  refreshKey,
  onOpenGastoDetail,
}) => {
  const [gastosBrutos, setGastosBrutos] = useState<GastoClassificacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState<ClassificarFiltrosState>(CLASSIFICAR_FILTROS_VAZIO);
  const [ordenacao, setOrdenacao] = useState<ClassificarOrdenacaoState>(
    CLASSIFICAR_ORDENACAO_PADRAO
  );
  const [dataSheetOpen, setDataSheetOpen] = useState(false);
  const [fornecedorSheetOpen, setFornecedorSheetOpen] = useState(false);
  const [pagamentoSheetOpen, setPagamentoSheetOpen] = useState(false);
  const [classificarSheetOpen, setClassificarSheetOpen] = useState(false);
  const [savingClassificacao, setSavingClassificacao] = useState(false);

  const reloadGastos = useCallback(async () => {
    try {
      const rows = await fetchGastosParaClassificacao(orgId);
      setGastosBrutos(rows);
    } catch {
      setGastosBrutos([]);
    }
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGastosParaClassificacao(orgId)
      .then((rows) => {
        if (!cancelled) setGastosBrutos(rows);
      })
      .catch(() => {
        if (!cancelled) setGastosBrutos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const gastosVisiveis = useMemo(
    () => aplicarFiltrosEOrdenacaoClassificacao(gastosBrutos, filtros, ordenacao),
    [gastosBrutos, filtros, ordenacao]
  );

  const totalVisivelCents = useMemo(
    () => gastosVisiveis.reduce((acc, gasto) => acc + gasto.total, 0),
    [gastosVisiveis]
  );

  const fornecedoresDisponiveis = useMemo(
    () => listarFornecedoresClassificacao(gastosBrutos),
    [gastosBrutos]
  );

  const meiosDisponiveis = useMemo(
    () => listarMeiosPagamentoClassificacao(gastosBrutos),
    [gastosBrutos]
  );

  const instituicoesDisponiveis = useMemo(
    () => listarInstituicoesClassificacao(gastosBrutos),
    [gastosBrutos]
  );

  const filtrosAtivos = temFiltrosClassificacaoAtivos(filtros);
  const filtroDataAtivo = temFiltroDataClassificacaoAtivo(filtros.data);
  const filtroFornecedorAtivo = temFiltroFornecedorClassificacaoAtivo(filtros.fornecedores);
  const filtroPagamentoAtivo = temFiltroPagamentoClassificacaoAtivo(filtros.pagamento);
  const rotuloDataAtivo = rotuloFiltroDataClassificacao(filtros.data);
  const rotuloFornecedorAtivo = rotuloFiltroFornecedorClassificacao(filtros.fornecedores);
  const rotuloPagamentoAtivo = rotuloFiltroPagamentoClassificacao(filtros.pagamento);
  const rotuloClassificacaoAtivo = rotuloFiltroClassificacaoRapida(filtros.classificacao);

  const selectionMode = selectedIds.size > 0;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const applyFiltroData = useCallback((data: ClassificarFiltroData) => {
    setFiltros((prev) => ({ ...prev, data }));
    clearSelection();
    setDataSheetOpen(false);
  }, [clearSelection]);

  const applyFiltroFornecedor = useCallback(
    (fornecedores: string[]) => {
      setFiltros((prev) => ({ ...prev, fornecedores }));
      clearSelection();
      setFornecedorSheetOpen(false);
    },
    [clearSelection]
  );

  const applyFiltroPagamento = useCallback(
    (pagamento: ClassificarFiltroPagamento) => {
      setFiltros((prev) => ({ ...prev, pagamento }));
      clearSelection();
      setPagamentoSheetOpen(false);
    },
    [clearSelection]
  );

  const applyFiltroClassificacao = useCallback(
    (classificacao: ClassificarFiltroClassificacao) => {
      setFiltros((prev) => ({ ...prev, classificacao }));
      clearSelection();
    },
    [clearSelection]
  );

  const limparFiltros = useCallback(() => {
    setFiltros(CLASSIFICAR_FILTROS_VAZIO);
    setOrdenacao(CLASSIFICAR_ORDENACAO_PADRAO);
    clearSelection();
  }, [clearSelection]);

  const handleValorHeaderClick = useCallback(() => {
    const nextOrdenacao = proximaOrdenacaoValorClassificacao(ordenacao);
    setOrdenacao(nextOrdenacao);
    const nextVisible = aplicarFiltrosEOrdenacaoClassificacao(
      gastosBrutos,
      filtros,
      nextOrdenacao
    );
    setSelectedIds((prev) => pruneSelectionToVisible(prev, nextVisible));
  }, [ordenacao, gastosBrutos, filtros]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectByLongPress = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const idsSelecionadosVisiveis = useMemo(
    () => idsVisiveisParaClassificacao(selectedIds, gastosVisiveis),
    [selectedIds, gastosVisiveis]
  );

  const selectedCount = idsSelecionadosVisiveis.length;

  const selectedTotalCents = useMemo(() => {
    let sum = 0;
    for (const g of gastosVisiveis) {
      if (selectedIds.has(g.id)) sum += g.total;
    }
    return sum;
  }, [gastosVisiveis, selectedIds]);

  const handleClassificar = () => {
    if (idsSelecionadosVisiveis.length === 0) return;
    setClassificarSheetOpen(true);
  };

  const handleAplicarClassificacao = useCallback(
    async (classificacao: ClassificacaoGastoOpcao) => {
      if (!supabase) {
        alert('Não foi possível classificar os gastos. Tente novamente.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;

      const validacao = validarClassificacaoMassaComAuth({
        ids: idsSelecionadosVisiveis,
        classificacao,
        responsavelClassificacao: userId,
      });

      if (!validacao.ok) {
        alert(validacao.mensagem);
        return;
      }

      const { payload } = validacao;

      setSavingClassificacao(true);
      const result = await classificarGastosEmMassa({
        ids: idsSelecionadosVisiveis,
        orgId,
        quemGastou: payload.quemGastou,
        tipoGasto: payload.tipoGasto,
        setor: payload.setor,
        responsavelClassificacao: userId!,
      });
      setSavingClassificacao(false);

      if (!result.ok) {
        alert(result.error);
        return;
      }

      const n = result.updatedCount;
      await reloadGastos();
      clearSelection();
      setClassificarSheetOpen(false);
      alert(
        `${n} ${n === 1 ? 'gasto classificado' : 'gastos classificados'} com sucesso.`
      );
    },
    [idsSelecionadosVisiveis, orgId, reloadGastos, clearSelection]
  );

  const hintText = selectionMode
    ? 'Toque nas linhas para selecionar ou remover.'
    : 'Segure uma linha para selecionar.';

  const valorHeaderLabel =
    ordenacao.modo === 'valor' && ordenacao.direcao === 'asc'
      ? 'Valor ↑'
      : ordenacao.modo === 'valor' && ordenacao.direcao === 'desc'
        ? 'Valor ↓'
        : 'Valor';

  return (
    <div
      className={`app-container classificar-gastos-screen ${selectionMode ? 'classificar-gastos-screen--selecting' : 'classificar-gastos-screen--idle'}`}
    >
      <header className="classificar-gastos-screen__header">
        <ScreenHeader title="Classificar Gastos" subtitle={hintText}>
          {!loading && gastosVisiveis.length > 0 && (
            <p className="screen-header__meta">
              Total: <strong>{formatCurrency(totalVisivelCents)}</strong>
            </p>
          )}
        </ScreenHeader>
        {!loading && gastosBrutos.length > 0 && (
          <div
            className="classificar-gastos-screen__classificacao-filtro"
            role="group"
            aria-label="Filtrar por classificação"
          >
            {CLASSIFICAR_FILTRO_CLASSIFICACAO_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                className={`classificar-gastos-screen__classificacao-chip ${
                  filtros.classificacao === opcao.id
                    ? 'classificar-gastos-screen__classificacao-chip--active'
                    : ''
                }`}
                aria-pressed={filtros.classificacao === opcao.id}
                onClick={() => applyFiltroClassificacao(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        )}
        {!loading && filtrosAtivos && gastosBrutos.length > 0 && (
          <div className="classificar-gastos-screen__filtros-bar">
            <p className="classificar-gastos-screen__filtros-count">
              {gastosVisiveis.length} de {gastosBrutos.length} gastos
              {rotuloDataAtivo ? (
                <span className="classificar-gastos-screen__filtros-label">
                  {' '}
                  · Data: {rotuloDataAtivo}
                </span>
              ) : null}
              {rotuloFornecedorAtivo ? (
                <span className="classificar-gastos-screen__filtros-label">
                  {' '}
                  · {rotuloFornecedorAtivo}
                </span>
              ) : null}
              {rotuloPagamentoAtivo ? (
                <span className="classificar-gastos-screen__filtros-label">
                  {' '}
                  · {rotuloPagamentoAtivo}
                </span>
              ) : null}
              {rotuloClassificacaoAtivo ? (
                <span className="classificar-gastos-screen__filtros-label">
                  {' '}
                  · {rotuloClassificacaoAtivo}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              className="classificar-gastos-screen__limpar-filtros"
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </header>

      <div className="classificar-gastos-screen__table-wrap">
        {loading && (
          <div className="meus-gastos-empty" role="status" aria-live="polite">
            Carregando…
          </div>
        )}
        {!loading && gastosBrutos.length === 0 && (
          <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
            <span className="meus-gastos-empty__title">Nenhum gasto cadastrado</span>
            <span className="meus-gastos-empty__hint">
              Quando houver gastos para classificar, eles aparecerão aqui.
            </span>
          </div>
        )}
        {!loading && gastosBrutos.length > 0 && gastosVisiveis.length === 0 && (
          <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
            <span className="meus-gastos-empty__title">Nenhum gasto neste filtro</span>
            <span className="meus-gastos-empty__hint">
              Ajuste os filtros ou limpe para ver todos os gastos.
            </span>
            <button
              type="button"
              className="classificar-gastos-screen__limpar-cta button-finance button-finance--ghost"
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          </div>
        )}
        {!loading && gastosVisiveis.length > 0 && (
          <div className="classificar-gastos-table-scroll">
            <table className="classificar-gastos-table">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={`classificar-gastos-table__th classificar-gastos-table__th--data ${filtroDataAtivo ? 'classificar-gastos-table__th--filter-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="classificar-gastos-table__th-btn"
                      onClick={() => setDataSheetOpen(true)}
                      aria-label={
                        filtroDataAtivo && rotuloDataAtivo
                          ? `Data, filtro ativo: ${rotuloDataAtivo}`
                          : 'Data, filtrar'
                      }
                    >
                      Data
                    </button>
                  </th>
                  <th
                    scope="col"
                    className={`classificar-gastos-table__th classificar-gastos-table__th--fornecedor ${filtroFornecedorAtivo ? 'classificar-gastos-table__th--filter-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="classificar-gastos-table__th-btn"
                      onClick={() => setFornecedorSheetOpen(true)}
                      aria-label={
                        filtroFornecedorAtivo && rotuloFornecedorAtivo
                          ? `Fornecedor, filtro ativo: ${rotuloFornecedorAtivo}`
                          : 'Fornecedor, filtrar'
                      }
                    >
                      Fornecedor
                    </button>
                  </th>
                  <th
                    scope="col"
                    className={`classificar-gastos-table__th classificar-gastos-table__th--valor ${ordenacao.modo === 'valor' ? 'classificar-gastos-table__th--sort-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="classificar-gastos-table__th-btn classificar-gastos-table__th-btn--right"
                      onClick={handleValorHeaderClick}
                      aria-label={`${valorHeaderLabel}, ordenar`}
                    >
                      {valorHeaderLabel}
                    </button>
                  </th>
                  <th
                    scope="col"
                    className={`classificar-gastos-table__th classificar-gastos-table__th--pagamento ${filtroPagamentoAtivo ? 'classificar-gastos-table__th--filter-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="classificar-gastos-table__th-btn"
                      onClick={() => setPagamentoSheetOpen(true)}
                      aria-label={
                        filtroPagamentoAtivo && rotuloPagamentoAtivo
                          ? `Pagamento, filtro ativo: ${rotuloPagamentoAtivo}`
                          : 'Pagamento, filtrar'
                      }
                    >
                      Pagamento
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gastosVisiveis.map((gasto) => (
                  <ClassificarGastoRow
                    key={gasto.id}
                    gasto={gasto}
                    selected={selectedIds.has(gasto.id)}
                    selectionMode={selectionMode}
                    onToggleSelect={toggleSelect}
                    onSelectByLongPress={selectByLongPress}
                    onOpenDetail={onOpenGastoDetail}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectionMode && (
        <div className="classificar-gastos-action-bar" aria-live="polite">
          <div className="classificar-gastos-action-bar__summary">
            <span>
              Selecionados: <strong>{selectedCount}</strong>
            </span>
            <span>
              Total selecionado: <strong>{formatCurrency(selectedTotalCents)}</strong>
            </span>
          </div>
          <div className="classificar-gastos-action-bar__actions">
            <button
              type="button"
              className="classificar-gastos-action-bar__clear button-finance button-finance--ghost"
              onClick={clearSelection}
            >
              Cancelar seleção
            </button>
            <button
              type="button"
              className="classificar-gastos-action-bar__primary button-finance button-finance--primary"
              onClick={handleClassificar}
              disabled={selectedCount === 0 || savingClassificacao}
            >
              Classificar selecionados
            </button>
          </div>
        </div>
      )}

      {dataSheetOpen && (
        <ClassificarFiltroDataSheet
          filtroAplicado={filtros.data}
          onClose={() => setDataSheetOpen(false)}
          onApply={applyFiltroData}
        />
      )}

      {fornecedorSheetOpen && (
        <ClassificarFiltroFornecedorSheet
          fornecedoresDisponiveis={fornecedoresDisponiveis}
          filtroAplicado={filtros.fornecedores}
          onClose={() => setFornecedorSheetOpen(false)}
          onApply={applyFiltroFornecedor}
        />
      )}

      {pagamentoSheetOpen && (
        <ClassificarFiltroPagamentoSheet
          meiosDisponiveis={meiosDisponiveis}
          instituicoesDisponiveis={instituicoesDisponiveis}
          filtroAplicado={filtros.pagamento}
          onClose={() => setPagamentoSheetOpen(false)}
          onApply={applyFiltroPagamento}
        />
      )}

      {classificarSheetOpen && (
        <ClassificarSelecionadosSheet
          selectedCount={selectedCount}
          totalCents={selectedTotalCents}
          saving={savingClassificacao}
          onClose={() => !savingClassificacao && setClassificarSheetOpen(false)}
          onApply={handleAplicarClassificacao}
        />
      )}
    </div>
  );
};
