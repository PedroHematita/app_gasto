import React from 'react';
import { Plus, Check } from 'lucide-react';
import { FloatingInput } from './FloatingInput';
import { PriceHintBar } from './PriceHintBar';
import { FloatingSelect } from './FloatingSelect';
import { CurrencyInput } from './CurrencyInput';
import { UNIDADES } from '../utils';
import { searchDescricoes } from '../lib/supabase';
import type { GastoItem } from '../types';

interface ItemFormProps {
  descricao: string;
  quantidade: string;
  unidade: string;
  valorCentavos: number;
  editingItem: GastoItem | null;
  onDescricaoChange: (v: string) => void;
  onQuantidadeChange: (v: string) => void;
  onUnidadeChange: (v: string) => void;
  onValorChange: (cents: number) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

export const ItemForm: React.FC<ItemFormProps> = ({
  descricao,
  quantidade,
  unidade,
  valorCentavos,
  editingItem,
  onDescricaoChange,
  onQuantidadeChange,
  onUnidadeChange,
  onValorChange,
  onSubmit,
  onCancelEdit,
}) => {
  const isEditing = editingItem !== null;
  const bgVariant = isEditing ? 'edit' : 'main';

  return (
    <div className={`item-form ${isEditing ? 'item-form--editing' : ''}`}>
      {isEditing && (
        <div className="item-form__editing-badge">
          <span>Editando item</span>
          <span className="item-form__editing-badge-number">#{editingItem.ordem}</span>
        </div>
      )}

      <FloatingInput
        id="input-descricao"
        label="Descrição do produto/serviço"
        value={descricao}
        onChange={onDescricaoChange}
        bgVariant={bgVariant}
        autocompleteSearch={searchDescricoes}
      />
      <PriceHintBar descricao={descricao} />

      <div className="form-row">
        <FloatingInput
          id="input-quantidade"
          label="Quantidade"
          value={quantidade}
          onChange={onQuantidadeChange}
          type="text"
          inputMode="decimal"
          bgVariant={bgVariant}
        />
        <FloatingSelect
          id="select-unidade"
          label="Unidade de medida"
          value={unidade}
          onChange={onUnidadeChange}
          options={UNIDADES}
          bgVariant={bgVariant}
        />
      </div>

      <CurrencyInput
        id="input-valor"
        label="Valor total"
        valueCents={valorCentavos}
        onChange={onValorChange}
        bgVariant={bgVariant}
      />

      <button
        className="btn-launch"
        onClick={onSubmit}
        type="button"
      >
        {isEditing ? (
          <>
            <Check size={14} />
            Salvar alteração
          </>
        ) : (
          <>
            <Plus size={14} />
            Lançar gasto
          </>
        )}
      </button>

      {isEditing && (
        <button
          onClick={onCancelEdit}
          type="button"
          style={{
            width: '100%',
            marginTop: 8,
            padding: 8,
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Cancelar edição
        </button>
      )}
    </div>
  );
};
