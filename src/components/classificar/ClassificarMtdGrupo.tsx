import React, { useMemo } from 'react';
import {
  dataCompraTabelaClassificacao,
  fornecedorExibicaoClassificacao,
  formatCurrency,
  formaPagamentoTabelaClassificacao,
  meioPagamentoTabelaClassificacao,
} from '../../utils';
import { isFormaPagamentoParcelado } from '../../lib/gastosParceladosFuturos';
import {
  badgeMtdGrupo,
  itemMtdEstaClassificado,
  statusMtdExibicaoItem,
  statusMtdLinhaItem,
} from '../../lib/mtdClassificacao';
import type { GastoMtdGrupo, ItemMtdRow } from '../../types';
import { ClassificarMtdItemRow } from './ClassificarMtdItemRow';

interface ClassificarMtdGrupoProps {
  grupo: GastoMtdGrupo;
  selectedIds: Set<string>;
  selectionMode: boolean;
  filtroPendente: boolean;
  onToggleItem: (itemId: string) => void;
  onSelectItemByLongPress: (itemId: string) => void;
  onSelecionarTodosItens: (gastoId: string) => void;
  onOpenGastoDetail: (gastoId: string) => void;
  todosPendentesSelecionados: boolean;
}

function metaLinhaGrupoMtd(grupo: GastoMtdGrupo): string {
  const parts = [
    dataCompraTabelaClassificacao(grupo.dataCompra),
    meioPagamentoTabelaClassificacao(grupo.meioPagamento),
  ];
  if (isFormaPagamentoParcelado(grupo.formaPagamento)) {
    parts.push(formaPagamentoTabelaClassificacao(grupo));
  }
  const inst = grupo.instituicaoFinanceira?.trim();
  if (inst) parts.push(inst);
  return parts.join(' · ');
}

export const ClassificarMtdGrupo: React.FC<ClassificarMtdGrupoProps> = ({
  grupo,
  selectedIds,
  selectionMode,
  filtroPendente,
  onToggleItem,
  onSelectItemByLongPress,
  onSelecionarTodosItens,
  onOpenGastoDetail,
  todosPendentesSelecionados,
}) => {
  const fornecedorLabel = fornecedorExibicaoClassificacao(grupo.fornecedor);
  const mtdBadge = badgeMtdGrupo(grupo.itens);
  const metaLinha = useMemo(() => metaLinhaGrupoMtd(grupo), [grupo]);

  const itensExibir: ItemMtdRow[] = filtroPendente
    ? grupo.itens.filter((i) => !itemMtdEstaClassificado(i))
    : grupo.itens;

  const idsPendentesGrupo = grupo.itens.filter((i) => !itemMtdEstaClassificado(i)).map((i) => i.id);
  const { classificados, total } = useMemo(() => {
    const t = grupo.itens.length;
    const c = grupo.itens.filter((i) => itemMtdEstaClassificado(i)).length;
    return { classificados: c, total: t };
  }, [grupo.itens]);

  if (itensExibir.length === 0) return null;

  return (
    <article className="classificar-mtd-grupo" aria-label={`Gasto ${fornecedorLabel}`}>
      <header className="classificar-mtd-grupo__header">
        <div className="classificar-mtd-grupo__title-row">
          <button
            type="button"
            className="classificar-mtd-grupo__fornecedor-btn"
            onClick={() => onOpenGastoDetail(grupo.id)}
          >
            {fornecedorLabel}
          </button>
          <span
            className={`classificar-mtd-grupo__badge ${classificados === total && total > 0 ? 'classificar-mtd-grupo__badge--ok' : classificados > 0 ? 'classificar-mtd-grupo__badge--partial' : ''}`}
          >
            {mtdBadge}
          </span>
        </div>
        <p className="classificar-mtd-grupo__meta">{metaLinha}</p>
        <div className="classificar-mtd-grupo__footer-row">
          <span className="classificar-mtd-grupo__total">Total {formatCurrency(grupo.total)}</span>
          {idsPendentesGrupo.length > 0 && (
            <button
              type="button"
              className="classificar-mtd-grupo__select-chip"
              onClick={() => onSelecionarTodosItens(grupo.id)}
            >
              {todosPendentesSelecionados ? 'Desmarcar' : 'Selecionar pendentes'}
            </button>
          )}
        </div>
      </header>

      <ul className="classificar-mtd-grupo__itens" role="list">
        {itensExibir.map((item) => {
          const pendente = !itemMtdEstaClassificado(item);
          const linhaCurta = statusMtdLinhaItem(item);
          const tituloCompleto = pendente ? 'Pendente MTD' : statusMtdExibicaoItem(item);
          return (
            <li key={item.id} className="classificar-mtd-grupo__item-wrap">
              <ClassificarMtdItemRow
                item={item}
                selected={selectedIds.has(item.id)}
                selectionMode={selectionMode}
                mtdLabel={linhaCurta}
                mtdTitle={tituloCompleto}
                pendente={pendente}
                onToggleSelect={onToggleItem}
                onSelectByLongPress={onSelectItemByLongPress}
              />
            </li>
          );
        })}
      </ul>
    </article>
  );
};
