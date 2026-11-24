import { useEffect, useState } from 'react';
import { ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import { FloatingInput } from '../FloatingInput';
import { FloatingSelect } from '../FloatingSelect';
import { PriceHintBar } from '../PriceHintBar';
import { ValorCentavosField } from './ValorCentavosField';
import { resumoPagamentoTexto } from './PagamentoLotePanel';
import {
  classificarItemLinha,
  contarItensCompletos,
  itemCampoDescricaoInvalido,
  itemCampoQuantidadeInvalido,
  itemCampoUnidadeInvalido,
  itemCampoValorInvalido,
  LINHAS_ITEM_INICIAIS,
  parseQuantidadeItem,
  totalGastoCentavos,
  type GastoRascunhoLote,
  type ItemRascunhoLote,
  type PagamentoRascunhoLote,
} from '../../lib/cadastroMultiplo/modelo';
import type { EstadoTravaItem } from '../../lib/cadastroMultiplo/unidadeTrava';
import { formatCurrency, UNIDADES } from '../../utils';
import { searchDescricoes, searchFornecedores } from '../../lib/supabase';

/** Heurística só de UI — não altera validação/negócio. */
export function gastoPareceIncompleto(gasto: GastoRascunhoLote): boolean {
  if (gasto.dataHerdadaPendente) return true;
  if (!gasto.fornecedor.trim()) return true;
  if (gasto.itens.some((item) => classificarItemLinha(item) === 'incompleta')) return true;
  if (contarItensCompletos(gasto) === 0) return true;
  return false;
}

/** Resumo curto do cabeçalho (sem “À Vista” / “Parcelado”). */
function resumoPagamentoCabecalho(pagamento: PagamentoRascunhoLote): string {
  if (pagamento.formaPagamento === 'parcelado') {
    return `${pagamento.parcelas}x · ${pagamento.meioPagamento} · ${pagamento.instituicaoFinanceira}`;
  }
  return `${pagamento.meioPagamento} · ${pagamento.instituicaoFinanceira}`;
}

interface GastoBlocoProps {
  orgId: string;
  gasto: GastoRascunhoLote;
  aberto: boolean;
  temErroValidacao: boolean;
  travasPorItemId: Map<string, EstadoTravaItem>;
  erroNo: (gastoId: string, campo: string, itemId?: string) => boolean;
  onToggle: () => void;
  onPatch: (p: Partial<GastoRascunhoLote>) => void;
  onPatchItem: (itemId: string, p: Partial<ItemRascunhoLote>) => void;
  onAddItem: () => void;
  onTentarDeNovoUnidade: (descricao: string) => void;
  onLimparOuRemoverItem: (itemId: string) => void;
  onOpenPagamento: () => void;
  onOpenDate: () => void;
  onConfirmData: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}

export function GastoBloco({
  orgId,
  gasto,
  aberto,
  temErroValidacao,
  travasPorItemId,
  erroNo,
  onToggle,
  onPatch,
  onPatchItem,
  onAddItem,
  onTentarDeNovoUnidade,
  onLimparOuRemoverItem,
  onOpenPagamento,
  onOpenDate,
  onConfirmData,
  onDuplicar,
  onExcluir,
}: GastoBlocoProps) {
  const fornecedor = gasto.fornecedor.trim();
  const nItens = contarItensCompletos(gasto);
  const total = totalGastoCentavos(gasto);
  const tituloVazio = !fornecedor;
  const temLinhaIncompleta = gasto.itens.some(
    (item) => classificarItemLinha(item) === 'incompleta'
  );
  const [linhasReveladas, setLinhasReveladas] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setLinhasReveladas((prev) => {
      let mudou = false;
      const next = new Set(prev);
      for (const item of gasto.itens) {
        const classif = classificarItemLinha(item);
        if (classif !== 'incompleta' && next.has(item.id)) {
          next.delete(item.id);
          mudou = true;
        }
        if (
          classif === 'incompleta' &&
          (erroNo(gasto.id, 'descricao', item.id) ||
            erroNo(gasto.id, 'quantidade', item.id) ||
            erroNo(gasto.id, 'unidade', item.id) ||
            erroNo(gasto.id, 'valor', item.id)) &&
          !next.has(item.id)
        ) {
          next.add(item.id);
          mudou = true;
        }
      }
      for (const id of [...next]) {
        if (!gasto.itens.some((i) => i.id === id)) {
          next.delete(id);
          mudou = true;
        }
      }
      return mudou ? next : prev;
    });
  }, [gasto.itens, gasto.id, erroNo]);

  return (
    <article
      id={`cad-multi-gasto-${gasto.id}`}
      className={`cad-multi-gasto card-finance card-finance--section${aberto ? ' cad-multi-gasto--aberto' : ''}`}
    >
      <button
        type="button"
        className={`meus-gastos-month-header cad-multi-gasto__header${aberto ? ' meus-gastos-month-header--expanded' : ''}`}
        onClick={onToggle}
        aria-expanded={aberto}
      >
        <div className="meus-gastos-month-header__left">
          <span className="meus-gastos-month-header__title cad-multi-gasto__titulo">
            {tituloVazio ? (
              <span className="cad-multi-gasto__titulo-vazio">Novo gasto</span>
            ) : (
              fornecedor
            )}
            {!aberto && (temErroValidacao || temLinhaIncompleta) ? (
              <span className="cad-multi-gasto__erro-dot" aria-label="Há erros neste gasto" />
            ) : null}
          </span>
          <span className="meus-gastos-month-header__count">
            {gasto.dataCompraBR} · {nItens} {nItens === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <div className="cad-multi-gasto__header-right">
          <div className="cad-multi-gasto__header-meta">
            <span
              className={`meus-gastos-month-header__total${total === 0 ? ' cad-multi-gasto__total--zero' : ''}`}
            >
              {formatCurrency(total)}
            </span>
            <span className="meus-gastos-month-header__count cad-multi-gasto__pag-resumo">
              {resumoPagamentoCabecalho(gasto.pagamento)}
            </span>
          </div>
          <span className={`meus-gastos-month-header__icon ${aberto ? 'is-expanded' : ''}`}>
            <ChevronDown size={16} />
          </span>
        </div>
      </button>

      {aberto ? (
        <div className="cad-multi-gasto__corpo">
          <div className="cad-multi-gasto__campos-block">
            <div className="cad-multi-campos-head" aria-hidden>
              <div className="cad-multi-gasto__data-forn">
                <span>Data</span>
                <span>Fornecedor</span>
              </div>
              <span className="cad-multi-campos-head__pag">Pagamento</span>
            </div>
            <div className="cad-multi-gasto__campos">
              <div className="cad-multi-gasto__data-forn">
                <div className="cad-multi-field">
                  <button
                    type="button"
                    id={`data-${gasto.id}`}
                    className={`cad-multi-cell cad-multi-gasto__data-btn${erroNo(gasto.id, 'data') ? ' cad-multi-cell--erro' : ''}`}
                    onClick={onOpenDate}
                    aria-label="Data"
                  >
                    {gasto.dataCompraBR}
                  </button>
                  {erroNo(gasto.id, 'data') ? (
                    <span className="cad-multi-field__erro">Informe a data</span>
                  ) : null}
                </div>
                <div className="cad-multi-field">
                  <FloatingInput
                    id={`forn-${gasto.id}`}
                    label="Fornecedor"
                    hideLabel
                    bgVariant="surface"
                    className="cad-multi-gasto__fornecedor cad-multi-cell-field"
                    value={gasto.fornecedor}
                    showError={erroNo(gasto.id, 'fornecedor')}
                    onChange={(v) => onPatch({ fornecedor: v })}
                    autocompleteSearch={(q) => searchFornecedores(orgId, q)}
                  />
                  {erroNo(gasto.id, 'fornecedor') ? (
                    <span className="cad-multi-field__erro">Informe o fornecedor</span>
                  ) : null}
                </div>
              </div>
              <div className="cad-multi-field cad-multi-gasto__pag-field">
                <button
                  type="button"
                  id={`pag-${gasto.id}`}
                  className={`cad-multi-cell cad-multi-gasto__pag-resumo-btn${erroNo(gasto.id, 'pagamento') || erroNo(gasto.id, 'parcelas') ? ' cad-multi-cell--erro' : ''}`}
                  onClick={onOpenPagamento}
                  aria-label="Pagamento"
                >
                  {resumoPagamentoTexto(gasto.pagamento)}
                </button>
                {erroNo(gasto.id, 'pagamento') || erroNo(gasto.id, 'parcelas') ? (
                  <span className="cad-multi-field__erro">Informe o pagamento</span>
                ) : null}
              </div>
            </div>
          </div>

          {gasto.dataHerdadaPendente ? (
            <button type="button" className="cad-multi-gasto__herdada" onClick={onConfirmData}>
              data herdada — tocar para confirmar
            </button>
          ) : null}

          <div className="cad-multi-gasto__itens">
            <div className="cad-multi-itens-head" aria-hidden>
              <span className="cad-multi-itens-head__desc">Descrição</span>
              <span className="cad-multi-itens-head__qtd">Qtd</span>
              <span className="cad-multi-itens-head__un">Unidade</span>
              <span className="cad-multi-itens-head__val">Valor</span>
              <span className="cad-multi-itens-head__hint" />
              <span className="cad-multi-itens-head__rm" />
            </div>

            {gasto.itens.map((item, idx) => {
              const ultimo = idx === gasto.itens.length - 1;
              const trava = travasPorItemId.get(item.id);
              const travado = !!trava?.travado;
              const qtdHint = parseQuantidadeItem(item.quantidade);
              const classif = classificarItemLinha(item);
              const vazia = classif === 'vazia';
              const incompleta = classif === 'incompleta';
              const revelada = linhasReveladas.has(item.id);
              const mostrarErroLinha = incompleta && revelada;
              const podeRemoverVazia = vazia && gasto.itens.length > LINHAS_ITEM_INICIAIS;
              const mostrarLixeira = !vazia || podeRemoverVazia;
              const erroDesc = mostrarErroLinha
                ? itemCampoDescricaoInvalido(item)
                : erroNo(gasto.id, 'descricao', item.id);
              const erroQtd = mostrarErroLinha
                ? itemCampoQuantidadeInvalido(item)
                : erroNo(gasto.id, 'quantidade', item.id);
              const erroUn = mostrarErroLinha
                ? itemCampoUnidadeInvalido(item)
                : erroNo(gasto.id, 'unidade', item.id);
              const erroVal = mostrarErroLinha
                ? itemCampoValorInvalido(item)
                : erroNo(gasto.id, 'valor', item.id);
              const unIncompativel =
                erroNo(gasto.id, 'unidade', item.id) && !itemCampoUnidadeInvalido(item);

              return (
                <div
                  key={item.id}
                  className="cad-multi-item-wrap"
                  onBlur={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    const atual = gasto.itens.find((i) => i.id === item.id) ?? item;
                    if (classificarItemLinha(atual) === 'incompleta') {
                      setLinhasReveladas((prev) => {
                        if (prev.has(item.id)) return prev;
                        const next = new Set(prev);
                        next.add(item.id);
                        return next;
                      });
                    }
                  }}
                >
                  <div className="cad-multi-item">
                    <div
                      className="cad-multi-field cad-multi-item__desc"
                      title={erroDesc ? 'Informe a descrição' : undefined}
                    >
                      <FloatingInput
                        id={`desc-${item.id}`}
                        label="Descrição"
                        hideLabel
                        bgVariant="surface"
                        className="cad-multi-cell-field"
                        value={item.descricao}
                        showError={erroDesc}
                        onChange={(descricao) => onPatchItem(item.id, { descricao })}
                        autocompleteSearch={async (q) => {
                          const rows = await searchDescricoes(orgId, q);
                          return rows.map((r) => ({ label: r.label, payload: r.payload }));
                        }}
                        onSelectSuggestion={(label, payload) => {
                          onPatchItem(item.id, {
                            descricao: label,
                            ...(payload?.unidade ? { unidade: String(payload.unidade) } : {}),
                          });
                        }}
                      />
                    </div>
                    <div
                      className="cad-multi-field cad-multi-item__qtd"
                      title={erroQtd ? 'Informe a qtd' : undefined}
                    >
                      <FloatingInput
                        id={`qtd-${item.id}`}
                        label="Qtd"
                        hideLabel
                        bgVariant="surface"
                        className="cad-multi-cell-field"
                        value={item.quantidade}
                        inputMode="decimal"
                        showError={erroQtd}
                        onChange={(quantidade) => onPatchItem(item.id, { quantidade })}
                      />
                    </div>
                    <div
                      className="cad-multi-item__unidade"
                      title={
                        unIncompativel
                          ? 'Unidade incompatível'
                          : erroUn
                            ? 'Informe a unidade'
                            : undefined
                      }
                    >
                      <FloatingSelect
                        id={`un-${item.id}`}
                        label="Unidade"
                        hideLabel
                        bgVariant="surface"
                        className="cad-multi-cell-field"
                        value={item.unidade}
                        options={UNIDADES}
                        disabled={travado}
                        showError={erroUn || unIncompativel}
                        onChange={(unidade) => onPatchItem(item.id, { unidade })}
                      />
                      {trava?.falhaConsulta ? (
                        <button
                          type="button"
                          className="cad-multi-item__unidade-retry"
                          onClick={() => onTentarDeNovoUnidade(item.descricao)}
                        >
                          tentar de novo
                        </button>
                      ) : null}
                    </div>
                    <div
                      className="cad-multi-field cad-multi-item__valor"
                      title={erroVal ? 'Informe o valor' : undefined}
                    >
                      <ValorCentavosField
                        id={`val-${item.id}`}
                        label="Valor total"
                        hideLabel
                        className="cad-multi-cell-field"
                        valueCents={item.valorCentavos}
                        showError={erroVal}
                        onChange={(valorCentavos) => onPatchItem(item.id, { valorCentavos })}
                        onEnter={() => {
                          if (ultimo) onAddItem();
                        }}
                      />
                    </div>
                    <span className="cad-multi-item__hint">
                      <PriceHintBar
                        orgId={orgId}
                        descricao={item.descricao}
                        unidade={item.unidade}
                        valorTotalCentavos={item.valorCentavos}
                        quantidade={qtdHint}
                        variant="icon"
                      />
                    </span>
                    {mostrarLixeira ? (
                      <button
                        type="button"
                        className="cad-multi-item__rm"
                        aria-label={vazia ? 'Remover item' : 'Limpar linha'}
                        onClick={() => onLimparOuRemoverItem(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="cad-multi-item__rm cad-multi-item__rm--spacer" aria-hidden />
                    )}
                  </div>
                  {mostrarErroLinha || erroDesc || erroQtd || erroUn || erroVal ? (
                    <p className="cad-multi-item__msg-incompleta">Complete ou limpe esta linha</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="cad-multi-gasto__rodape">
            <button type="button" className="cad-multi-gasto__add-item" onClick={onAddItem}>
              <Plus size={14} /> Adicionar item
            </button>
            <div className="cad-multi-gasto__rodape-acoes">
              <button type="button" className="cad-multi-gasto__acao-texto" onClick={onDuplicar}>
                <Copy size={14} /> Duplicar
              </button>
              <button type="button" className="cad-multi-gasto__acao-texto" onClick={onExcluir}>
                <Trash2 size={14} /> Excluir gasto
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
