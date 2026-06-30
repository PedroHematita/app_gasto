import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  classificarItensMtdEmMassa,
  fetchGastosParaClassificacaoMtd,
  supabase,
} from '../../lib/supabase';
import {
  aplicarFiltrosClassificarMtd,
  CLASSIFICAR_MTD_FILTRO_STATUS_OPCOES,
  CLASSIFICAR_MTD_FILTROS_VAZIO,
  filtrarGruposEmpresariais,
  gastoTemItensPendentesMtd,
  idsItensVisiveisParaClassificacao,
  itemMtdEstaClassificado,
  pruneSelecaoItensParaGruposVisiveis,
} from '../../lib/mtdClassificacao';
import {
  formatCurrency,
  listarFornecedoresClassificacao,
  listarInstituicoesClassificacao,
  listarMeiosPagamentoClassificacao,
  proximaOrdenacaoValorClassificacao,
  rotuloFiltroDataClassificacao,
  temFiltroDataClassificacaoAtivo,
  temFiltroFornecedorClassificacaoAtivo,
  temFiltroPagamentoClassificacaoAtivo,
  CLASSIFICAR_ORDENACAO_PADRAO,
} from '../../utils';
import type {
  ClassificarMtdFiltroStatus,
  ClassificarMtdFiltrosState,
  ClassificarOrdenacaoState,
  GastoMtdGrupo,
} from '../../types';
import { ClassificarFiltroDataSheet } from './ClassificarFiltroDataSheet';
import { ClassificarFiltroFornecedorSheet } from './ClassificarFiltroFornecedorSheet';
import { ClassificarFiltroPagamentoSheet } from './ClassificarFiltroPagamentoSheet';
import { ClassificarMtdGrupo } from './ClassificarMtdGrupo';
import { ClassificarMtdSheet } from './ClassificarMtdSheet';
import { ScreenHeader } from '../ScreenHeader';

interface ClassificarMtdScreenProps {
  orgId: string;
  refreshKey: number;
  onOpenGastoDetail: (gastoId: string) => void;
}

function temFiltrosMtdAtivos(filtros: ClassificarMtdFiltrosState): boolean {
  return (
    filtros.statusMtd !== 'pendente' ||
    temFiltroDataClassificacaoAtivo(filtros.data) ||
    temFiltroFornecedorClassificacaoAtivo(filtros.fornecedores) ||
    temFiltroPagamentoClassificacaoAtivo(filtros.pagamento)
  );
}

function contarItensPendentes(grupos: GastoMtdGrupo[]): number {
  return grupos.reduce(
    (acc, g) => acc + g.itens.filter((i) => !itemMtdEstaClassificado(i)).length,
    0
  );
}

export const ClassificarMtdScreen: React.FC<ClassificarMtdScreenProps> = ({
  orgId,
  refreshKey,
  onOpenGastoDetail,
}) => {
  const [gruposBrutos, setGruposBrutos] = useState<GastoMtdGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState<ClassificarMtdFiltrosState>(CLASSIFICAR_MTD_FILTROS_VAZIO);
  const [ordenacao, setOrdenacao] = useState<ClassificarOrdenacaoState>(
    CLASSIFICAR_ORDENACAO_PADRAO
  );
  const [dataSheetOpen, setDataSheetOpen] = useState(false);
  const [fornecedorSheetOpen, setFornecedorSheetOpen] = useState(false);
  const [pagamentoSheetOpen, setPagamentoSheetOpen] = useState(false);
  const [mtdSheetOpen, setMtdSheetOpen] = useState(false);
  const [savingMtd, setSavingMtd] = useState(false);

  const reloadGrupos = useCallback(async () => {
    try {
      const rows = await fetchGastosParaClassificacaoMtd(orgId);
      setGruposBrutos(rows);
    } catch {
      setGruposBrutos([]);
    }
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGastosParaClassificacaoMtd(orgId)
      .then((rows) => {
        if (!cancelled) setGruposBrutos(rows);
      })
      .catch(() => {
        if (!cancelled) setGruposBrutos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const gruposEmpresariais = useMemo(
    () => filtrarGruposEmpresariais(gruposBrutos),
    [gruposBrutos]
  );

  const itensPendentesCount = useMemo(
    () => contarItensPendentes(gruposEmpresariais),
    [gruposEmpresariais]
  );

  const gruposVisiveis = useMemo(
    () => aplicarFiltrosClassificarMtd(gruposBrutos, filtros, ordenacao),
    [gruposBrutos, filtros, ordenacao]
  );
  const fornecedoresDisponiveis = useMemo(
    () => listarFornecedoresClassificacao(gruposEmpresariais),
    [gruposEmpresariais]
  );

  const meiosDisponiveis = useMemo(
    () => listarMeiosPagamentoClassificacao(gruposEmpresariais),
    [gruposEmpresariais]
  );

  const instituicoesDisponiveis = useMemo(
    () => listarInstituicoesClassificacao(gruposEmpresariais),
    [gruposEmpresariais]
  );

  const filtrosAtivos = temFiltrosMtdAtivos(filtros);
  const filtroDataAtivo = temFiltroDataClassificacaoAtivo(filtros.data);
  const filtroFornecedorAtivo = temFiltroFornecedorClassificacaoAtivo(filtros.fornecedores);
  const filtroPagamentoAtivo = temFiltroPagamentoClassificacaoAtivo(filtros.pagamento);
  const rotuloDataAtivo = rotuloFiltroDataClassificacao(filtros.data);
  const rotuloStatusMtd =
    CLASSIFICAR_MTD_FILTRO_STATUS_OPCOES.find((o) => o.id === filtros.statusMtd)?.label ?? '';

  const selectionMode = selectedIds.size > 0;
  const filtroPendente = filtros.statusMtd === 'pendente';

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const applyFiltroStatus = useCallback(
    (statusMtd: ClassificarMtdFiltroStatus) => {
      setFiltros((prev) => ({ ...prev, statusMtd }));
      clearSelection();
    },
    [clearSelection]
  );

  const applyFiltroData = useCallback(
    (data: ClassificarMtdFiltrosState['data']) => {
      setFiltros((prev) => ({ ...prev, data }));
      clearSelection();
      setDataSheetOpen(false);
    },
    [clearSelection]
  );

  const applyFiltroFornecedor = useCallback(
    (fornecedores: string[]) => {
      setFiltros((prev) => ({ ...prev, fornecedores }));
      clearSelection();
      setFornecedorSheetOpen(false);
    },
    [clearSelection]
  );

  const applyFiltroPagamento = useCallback(
    (pagamento: ClassificarMtdFiltrosState['pagamento']) => {
      setFiltros((prev) => ({ ...prev, pagamento }));
      clearSelection();
      setPagamentoSheetOpen(false);
    },
    [clearSelection]
  );

  const limparFiltros = useCallback(() => {
    setFiltros(CLASSIFICAR_MTD_FILTROS_VAZIO);
    setOrdenacao(CLASSIFICAR_ORDENACAO_PADRAO);
    clearSelection();
  }, [clearSelection]);

  const handleValorSort = useCallback(() => {
    const nextOrdenacao = proximaOrdenacaoValorClassificacao(ordenacao);
    setOrdenacao(nextOrdenacao);
    const nextVisible = aplicarFiltrosClassificarMtd(gruposBrutos, filtros, nextOrdenacao);
    setSelectedIds((prev) => pruneSelecaoItensParaGruposVisiveis(prev, nextVisible));
  }, [ordenacao, gruposBrutos, filtros]);

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

  const selecionarTodosItensDoGasto = useCallback(
    (gastoId: string) => {
      const grupo = gruposVisiveis.find((g) => g.id === gastoId);
      if (!grupo) return;
      const alvo = filtroPendente
        ? grupo.itens.filter((i) => !itemMtdEstaClassificado(i))
        : grupo.itens;
      const ids = alvo.map((i) => i.id);
      const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allSelected) ids.forEach((id) => next.delete(id));
        else ids.forEach((id) => next.add(id));
        return next;
      });
    },
    [gruposVisiveis, filtroPendente, selectedIds]
  );

  const todosPendentesSelecionadosNoGrupo = useCallback(
    (grupo: GastoMtdGrupo) => {
      const ids = grupo.itens.filter((i) => !itemMtdEstaClassificado(i)).map((i) => i.id);
      return ids.length > 0 && ids.every((id) => selectedIds.has(id));
    },
    [selectedIds]
  );

  const idsSelecionadosVisiveis = useMemo(
    () => idsItensVisiveisParaClassificacao(selectedIds, gruposVisiveis),
    [selectedIds, gruposVisiveis]
  );

  const selectedCount = idsSelecionadosVisiveis.length;

  const selectedTotalCents = useMemo(() => {
    let sum = 0;
    for (const g of gruposVisiveis) {
      for (const item of g.itens) {
        if (selectedIds.has(item.id)) sum += item.valorCentavos;
      }
    }
    return sum;
  }, [gruposVisiveis, selectedIds]);

  const handleClassificarMtd = () => {
    if (idsSelecionadosVisiveis.length === 0) return;
    setMtdSheetOpen(true);
  };

  const handleAplicarMtd = useCallback(
    async (payload: {
      direcionamentoMtd: string;
      classificacaoGeralMtd: string;
      naturezaMtdRaiz: string;
      naturezaMtdCaminho: string[];
    }) => {
      if (!supabase) {
        alert('Não foi possível classificar MTD. Tente novamente.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        alert('Usuário não autenticado.');
        return;
      }

      setSavingMtd(true);
      const result = await classificarItensMtdEmMassa({
        itemIds: idsSelecionadosVisiveis,
        orgId,
        payload,
        responsavelClassificacao: user.id,
      });
      setSavingMtd(false);

      if (!result.ok) {
        alert(result.error);
        return;
      }

      const n = result.updatedCount;
      await reloadGrupos();
      clearSelection();
      setMtdSheetOpen(false);
      alert(`${n} ${n === 1 ? 'item classificado' : 'itens classificados'} com MTD.`);
    },
    [idsSelecionadosVisiveis, orgId, reloadGrupos, clearSelection]
  );

  const hintText = selectionMode
    ? 'Toque nos itens para marcar ou desmarcar.'
    : 'Toque em um item para selecionar e classificar MTD.';

  const gruposComItensVisiveis = useMemo(
    () => gruposVisiveis.filter((g) => (filtroPendente ? gastoTemItensPendentesMtd(g) : true)),
    [gruposVisiveis, filtroPendente]
  );

  return (
    <div
      className={`app-container classificar-gastos-screen classificar-mtd-screen ${selectionMode ? 'classificar-gastos-screen--selecting' : 'classificar-gastos-screen--idle'}`}
    >
      <header className="classificar-gastos-screen__header">
        <ScreenHeader title="Classificar MTD" subtitle={hintText}>
          {!loading && gruposEmpresariais.length > 0 && (
            <p className="screen-header__meta">
              {gruposEmpresariais.length} {gruposEmpresariais.length === 1 ? 'gasto' : 'gastos'}
              {itensPendentesCount > 0 && (
                <>
                  {' '}
                  · <strong>{itensPendentesCount}</strong> itens sem MTD
                </>
              )}
            </p>
          )}
        </ScreenHeader>

        {!loading && gruposEmpresariais.length > 0 && (
          <>
            <div
              className="classificar-gastos-screen__classificacao-filtro"
              role="group"
              aria-label="Filtrar por status MTD"
            >
              {CLASSIFICAR_MTD_FILTRO_STATUS_OPCOES.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  className={`classificar-gastos-screen__classificacao-chip ${
                    filtros.statusMtd === opcao.id
                      ? 'classificar-gastos-screen__classificacao-chip--active'
                      : ''
                  }`}
                  aria-pressed={filtros.statusMtd === opcao.id}
                  onClick={() => applyFiltroStatus(opcao.id)}
                >
                  {opcao.label}
                </button>
              ))}
            </div>

            <div className="classificar-mtd-screen__toolbar">
              <button
                type="button"
                className={`classificar-mtd-screen__filter-btn ${filtroDataAtivo ? 'classificar-mtd-screen__filter-btn--active' : ''}`}
                onClick={() => setDataSheetOpen(true)}
              >
                Data{filtroDataAtivo ? `: ${rotuloDataAtivo}` : ''}
              </button>
              <button
                type="button"
                className={`classificar-mtd-screen__filter-btn ${filtroFornecedorAtivo ? 'classificar-mtd-screen__filter-btn--active' : ''}`}
                onClick={() => setFornecedorSheetOpen(true)}
              >
                Fornecedor
              </button>
              <button
                type="button"
                className={`classificar-mtd-screen__filter-btn ${filtroPagamentoAtivo ? 'classificar-mtd-screen__filter-btn--active' : ''}`}
                onClick={() => setPagamentoSheetOpen(true)}
              >
                Pagamento
              </button>
              <button
                type="button"
                className="classificar-mtd-screen__filter-btn"
                onClick={handleValorSort}
              >
                {ordenacao.modo === 'valor' && ordenacao.direcao === 'asc'
                  ? 'Valor ↑'
                  : ordenacao.modo === 'valor' && ordenacao.direcao === 'desc'
                    ? 'Valor ↓'
                    : 'Valor'}
              </button>
            </div>
          </>
        )}

        {!loading && filtrosAtivos && gruposEmpresariais.length > 0 && (
          <div className="classificar-gastos-screen__filtros-bar">
            <p className="classificar-gastos-screen__filtros-count">
              {gruposVisiveis.length} de {gruposEmpresariais.length} gastos
              {rotuloStatusMtd ? (
                <span className="classificar-gastos-screen__filtros-label"> · {rotuloStatusMtd}</span>
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

      <div className="classificar-mtd-screen__list-wrap">
        {loading && (
          <div className="meus-gastos-empty" role="status" aria-live="polite">
            Carregando…
          </div>
        )}
        {!loading && gruposEmpresariais.length === 0 && (
          <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
            <span className="meus-gastos-empty__title">Nenhum gasto empresarial</span>
            <span className="meus-gastos-empty__hint">
              Classifique gastos como Empresarial na tela Classificar antes de aplicar MTD.
            </span>
          </div>
        )}
        {!loading && gruposEmpresariais.length > 0 && gruposComItensVisiveis.length === 0 && (
          <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
            <span className="meus-gastos-empty__title">Nenhum item neste filtro</span>
            <span className="meus-gastos-empty__hint">Ajuste os filtros ou limpe para ver todos.</span>
            <button
              type="button"
              className="classificar-gastos-screen__limpar-cta button-finance button-finance--ghost"
              onClick={limparFiltros}
            >
              Limpar filtros
            </button>
          </div>
        )}
        {!loading && gruposComItensVisiveis.length > 0 && (
          <div className="classificar-mtd-screen__grupos">
            {gruposComItensVisiveis.map((grupo) => (
              <ClassificarMtdGrupo
                key={grupo.id}
                grupo={grupo}
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                filtroPendente={filtroPendente}
                onToggleItem={toggleSelect}
                onSelectItemByLongPress={selectByLongPress}
                onSelecionarTodosItens={selecionarTodosItensDoGasto}
                onOpenGastoDetail={onOpenGastoDetail}
                todosPendentesSelecionados={todosPendentesSelecionadosNoGrupo(grupo)}
              />
            ))}
          </div>
        )}
      </div>

      {selectionMode && (
        <div className="classificar-gastos-action-bar classificar-mtd-action-bar" aria-live="polite">
          <p className="classificar-mtd-action-bar__summary">
            <strong>{selectedCount}</strong> {selectedCount === 1 ? 'item' : 'itens'} ·{' '}
            <strong>{formatCurrency(selectedTotalCents)}</strong>
          </p>
          <div className="classificar-mtd-action-bar__actions">
            <button
              type="button"
              className="classificar-mtd-action-bar__cancel button-finance button-finance--ghost"
              onClick={clearSelection}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="classificar-mtd-action-bar__primary button-finance button-finance--primary"
              onClick={handleClassificarMtd}
              disabled={selectedCount === 0 || savingMtd}
            >
              Classificar MTD
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

      {mtdSheetOpen && (
        <ClassificarMtdSheet
          selectedCount={selectedCount}
          totalCents={selectedTotalCents}
          saving={savingMtd}
          onClose={() => !savingMtd && setMtdSheetOpen(false)}
          onApply={handleAplicarMtd}
        />
      )}
    </div>
  );
};
