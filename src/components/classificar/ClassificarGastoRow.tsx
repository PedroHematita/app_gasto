import React, { useCallback } from 'react';
import {
  badgePagamentoClassificacao,
  dataCompraTabelaClassificacao,
  fornecedorExibicaoClassificacao,
  meioPagamentoTabelaClassificacao,
  statusClassificacaoTabela,
  valorTabelaClassificacao,
} from '../../utils';
import type { GastoClassificacaoRow } from '../../types';
import { useClassificarRowPress } from './useClassificarRowPress';

interface ClassificarGastoRowProps {
  gasto: GastoClassificacaoRow;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
  onSelectByLongPress: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

export const ClassificarGastoRow: React.FC<ClassificarGastoRowProps> = ({
  gasto,
  selected,
  selectionMode,
  onToggleSelect,
  onSelectByLongPress,
  onOpenDetail,
}) => {
  const fornecedorLabel = fornecedorExibicaoClassificacao(gasto.fornecedor);
  const classificacaoLabel = statusClassificacaoTabela(gasto);
  const meioLabel = meioPagamentoTabelaClassificacao(gasto.meioPagamento);
  const pagamentoMeta = badgePagamentoClassificacao(gasto);

  const onLongPress = useCallback(() => {
    onSelectByLongPress(gasto.id);
  }, [gasto.id, onSelectByLongPress]);

  const onShortPress = useCallback(() => {
    if (selectionMode) {
      onToggleSelect(gasto.id);
    } else {
      onOpenDetail(gasto.id);
    }
  }, [gasto.id, selectionMode, onToggleSelect, onOpenDetail]);

  const pressHandlers = useClassificarRowPress({ onLongPress, onShortPress });

  return (
    <tr
      className={`classificar-gastos-table__row ${selected ? 'classificar-gastos-table__row--selected' : ''} ${selectionMode ? 'classificar-gastos-table__row--selection-mode' : ''}`}
      {...pressHandlers}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'manipulation' }}
    >
      <td className="classificar-gastos-table__cell classificar-gastos-table__cell--data">
        {dataCompraTabelaClassificacao(gasto.dataCompra)}
      </td>
      <td
        className="classificar-gastos-table__cell classificar-gastos-table__cell--fornecedor"
        title={fornecedorLabel}
      >
        <div className="classificar-gastos-table__fornecedor-block">
          <span className="classificar-gastos-table__fornecedor-nome">{fornecedorLabel}</span>
          <span
            className="classificar-gastos-table__fornecedor-meta"
            title={classificacaoLabel}
          >
            {classificacaoLabel}
          </span>
        </div>
      </td>
      <td className="classificar-gastos-table__cell classificar-gastos-table__cell--valor">
        {valorTabelaClassificacao(gasto.total)}
      </td>
      <td className="classificar-gastos-table__cell classificar-gastos-table__cell--pagamento">
        <div className="classificar-gastos-table__pagamento-block">
          <span className="classificar-gastos-table__pagamento-meio">{meioLabel}</span>
          <span className="classificar-gastos-table__pagamento-meta" title={pagamentoMeta}>
            {pagamentoMeta}
          </span>
        </div>
      </td>
    </tr>
  );
};
