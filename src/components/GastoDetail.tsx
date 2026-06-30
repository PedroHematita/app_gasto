import { ChevronLeft, Pencil, Share2, Image } from 'lucide-react';
import { formatCurrency, buildWhatsAppMessage, openWhatsApp } from '../utils';
import {
  classificacaoGeralMtdLabel,
  direcionamentoMtdLabel,
  mtdCaminhoExibicao,
} from '../lib/mtdTaxonomia';
import {
  gastoElegivelMtd,
  itemMtdEstaClassificado,
  statusMtdExibicaoItem,
} from '../lib/mtdClassificacao';
import type { GastoRecord, PaymentData } from '../types';

interface GastoDetailProps {
  gasto: GastoRecord;
  onBack: () => void;
  onEdit: () => void;
  onClassificarMtdItem?: (itemId: string) => void;
}

function formatMtdDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const GastoDetail: React.FC<GastoDetailProps> = ({
  gasto,
  onBack,
  onEdit,
  onClassificarMtdItem,
}) => {
  const sortedItems = [...gasto.items].sort((a, b) => a.ordem - b.ordem);
  const mtd = gasto.mtd;
  const showMtdSection = mtd && gastoElegivelMtd(mtd.tipoGasto);
  const itensClassificados = sortedItems.filter((i) => i.mtd && itemMtdEstaClassificado(i.mtd)).length;
  const itensTotal = sortedItems.length;

  const paymentForWhatsApp: PaymentData = {
    fornecedor: gasto.fornecedor,
    formaPagamento: gasto.formaPagamento === 'À Vista' ? 'a_vista' : 'parcelado',
    meioPagamento: gasto.meioPagamento,
    instituicaoFinanceira: gasto.instituicaoFinanceira,
    observacoes: gasto.observacoes,
    comprovanteFile: null,
    comprovanteUrl: gasto.comprovanteUrl,
    parcelas: gasto.parcelas,
  };

  const whatsAppMessage = buildWhatsAppMessage(
    gasto.dataCompra,
    gasto.items,
    paymentForWhatsApp,
    gasto.total,
  );

  return (
    <div className="app-container detail-screen">
      <header className="detail-header">
        <button
          className="detail-header__back"
          onClick={onBack}
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="detail-header__title">Gasto #{gasto.seq}</span>
        <button className="detail-header__action" onClick={onEdit} type="button">
          <Pencil size={16} aria-hidden />
          <span>Editar</span>
        </button>
      </header>

      <div className="detail-content">
        <section className="detail-summary-card" aria-label="Resumo do gasto">
          <h2 className="detail-summary-card__title">
            {gasto.fornecedor || 'Sem fornecedor'}
          </h2>
          <p className="detail-summary-card__meta">Compra em {gasto.dataCompra}</p>
          <div className="detail-chips detail-summary-card__chips">
            <span className="detail-chip">
              {gasto.formaPagamento === 'À Vista'
                ? 'À Vista'
                : `Parcelado em ${gasto.parcelas || 2}x`}
            </span>
            <span className="detail-chip">{gasto.meioPagamento}</span>
            <span className="detail-chip">{gasto.instituicaoFinanceira}</span>
          </div>
          <div className="detail-summary-card__total-row">
            <span className="detail-summary-card__total-label">Gasto total</span>
            <span className="detail-summary-card__total-value">
              {formatCurrency(gasto.total)}
            </span>
          </div>
        </section>

        {mtd && !gastoElegivelMtd(mtd.tipoGasto) && mtd.tipoGasto === 'Pessoal' && (
          <section className="detail-section detail-mtd-section" aria-labelledby="gasto-detail-mtd">
            <h3 id="gasto-detail-mtd" className="detail-section__title">
              Classificação MTD
            </h3>
            <p className="detail-mtd-section__nao-aplica">
              MTD não se aplica a gastos pessoais.
            </p>
          </section>
        )}

        {showMtdSection && mtd && (
          <section className="detail-section detail-mtd-section" aria-labelledby="gasto-detail-mtd-emp">
            <h3 id="gasto-detail-mtd-emp" className="detail-section__title">
              Classificação MTD
            </h3>
            <p className="detail-mtd-section__status">
              {itensClassificados}/{itensTotal} itens classificados
              {itensClassificados === 0 && (
                <span className="detail-mtd-section__status--pendente"> · Pendente</span>
              )}
              {itensClassificados > 0 && itensClassificados < itensTotal && (
                <span className="detail-mtd-section__status--pendente"> · Parcial</span>
              )}
            </p>
          </section>
        )}

        <section className="detail-section" aria-labelledby="gasto-detail-itens">
          <h3 id="gasto-detail-itens" className="detail-section__title">
            Itens
          </h3>
          {sortedItems.map((item) => {
            const itemMtd = item.mtd;
            const classificado = itemMtd && itemMtdEstaClassificado(itemMtd);
            return (
              <div key={item.id} className="detail-item detail-item--mtd">
                <div className="detail-item__top">
                  <span className="detail-item__num">{item.ordem}</span>
                  <span className="detail-item__desc">{item.descricao}</span>
                </div>
                <div className="detail-item__bottom">
                  <span className="detail-item__qty">
                    {item.quantidade} {item.unidade}
                  </span>
                  <span className="detail-item__value">
                    {formatCurrency(item.valorCentavos)}
                  </span>
                </div>
                {showMtdSection && itemMtd && (
                  <div className="detail-item-mtd">
                    {!classificado ? (
                      <>
                        <p className="detail-item-mtd__status detail-item-mtd__status--pendente">
                          Não Classificado MTD
                        </p>
                        {onClassificarMtdItem && (
                          <button
                            type="button"
                            className="button-finance button-finance--ghost detail-item-mtd__btn"
                            onClick={() => onClassificarMtdItem(item.id)}
                          >
                            Classificar MTD
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <dl className="detail-item-mtd__list">
                          <div>
                            <dt>Direcionamento</dt>
                            <dd>{direcionamentoMtdLabel(itemMtd.direcionamentoMtd)}</dd>
                          </div>
                          <div>
                            <dt>Classificação geral</dt>
                            <dd>{classificacaoGeralMtdLabel(itemMtd.classificacaoGeralMtd)}</dd>
                          </div>
                          <div>
                            <dt>Natureza MTD</dt>
                            <dd>{mtdCaminhoExibicao(itemMtd.naturezaMtdCaminho)}</dd>
                          </div>
                          <div>
                            <dt>Resumo</dt>
                            <dd>{statusMtdExibicaoItem(itemMtd)}</dd>
                          </div>
                          <div>
                            <dt>Classificado em</dt>
                            <dd>{formatMtdDateTime(itemMtd.mtdClassificadoEm)}</dd>
                          </div>
                        </dl>
                        {onClassificarMtdItem && (
                          <button
                            type="button"
                            className="button-finance button-finance--ghost detail-item-mtd__btn"
                            onClick={() => onClassificarMtdItem(item.id)}
                          >
                            Editar MTD
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {gasto.observacoes ? (
          <section className="detail-section" aria-labelledby="gasto-detail-obs">
            <h3 id="gasto-detail-obs" className="detail-section__title">
              Observações
            </h3>
            <p className="detail-obs__value">{gasto.observacoes}</p>
          </section>
        ) : null}

        <section className="detail-actions" aria-label="Ações">
          <button
            className="btn-whatsapp"
            onClick={() => openWhatsApp(whatsAppMessage)}
            type="button"
          >
            <Share2 size={16} aria-hidden />
            Compartilhar no WhatsApp
          </button>
          {gasto.comprovanteUrl ? (
            <button
              className="btn-new-expense"
              onClick={() => window.open(gasto.comprovanteUrl, '_blank')}
              type="button"
            >
              <Image size={16} aria-hidden />
              Ver comprovante
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
};
