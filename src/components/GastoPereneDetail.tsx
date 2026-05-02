import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { CurrencyInput } from './CurrencyInput';
import { FloatingInput } from './FloatingInput';
import { FloatingSelect } from './FloatingSelect';
import {
  fetchCompromissosByGastoPereneId,
  fetchGastoPereneById,
  updateGastoPereneEdicao,
  encerrarGastoPerene,
} from '../lib/supabase';
import {
  formatCurrency,
  formatVencimentoGastoPerene,
  labelPeriodicidade,
  labelStatusCompromisso,
  compromissoDisplayTitle,
} from '../utils';
import type { CompromissoRecord, GastoPereneRecord } from '../types';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface GastoPereneDetailProps {
  gastoPereneId: string;
  onBack: () => void;
  onSelectCompromisso: (c: CompromissoRecord) => void;
  refreshNonce: number;
}

export const GastoPereneDetail: React.FC<GastoPereneDetailProps> = ({
  gastoPereneId,
  onBack,
  onSelectCompromisso,
  refreshNonce,
}) => {
  const [record, setRecord] = useState<GastoPereneRecord | null>(null);
  const [historico, setHistorico] = useState<CompromissoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [valorCents, setValorCents] = useState(0);
  const [diaStr, setDiaStr] = useState('');
  const [mesNome, setMesNome] = useState('Janeiro');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gp, hist] = await Promise.all([
        fetchGastoPereneById(gastoPereneId),
        fetchCompromissosByGastoPereneId(gastoPereneId),
      ]);
      setRecord(gp);
      setHistorico(hist);
      if (gp) {
        setValorCents(gp.valorPrevistoCents);
        setDiaStr(String(gp.diaVencimento));
        setMesNome(gp.mesVencimento ? MESES[gp.mesVencimento - 1] : 'Janeiro');
        setObservacoes(gp.observacoes);
      }
    } finally {
      setLoading(false);
    }
  }, [gastoPereneId]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  const mesNumero = MESES.indexOf(mesNome) + 1;

  const handleSalvarEdicao = async () => {
    if (!record) return;
    const dia = parseInt(diaStr.replace(/\D/g, ''), 10);
    if (!dia || dia < 1 || dia > 31) {
      alert('Informe o dia de vencimento entre 1 e 31.');
      return;
    }
    if (record.periodicidade === 'anual' && mesNumero < 1) {
      alert('Selecione o mês de vencimento.');
      return;
    }
    setSaving(true);
    try {
      await updateGastoPereneEdicao(record.id, {
        valorPrevistoCents: valorCents,
        diaVencimento: dia,
        mesVencimento: record.periodicidade === 'anual' ? mesNumero : null,
        observacoes: observacoes.trim(),
      });
      setEditing(false);
      await load();
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleEncerrar = async () => {
    if (!record) return;
    if (
      !window.confirm(
        'Encerrar este gasto perene? Nenhum compromisso novo será gerado automaticamente. Os compromissos pendentes já criados permanecem para quitação.'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await encerrarGastoPerene(record.id);
      await load();
    } catch (e) {
      console.error(e);
      alert('Não foi possível encerrar o gasto perene.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !record) {
    return (
      <div className="app-container" style={{ padding: 24 }}>
        <p style={{ color: 'var(--text-inactive)', fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="app-container" style={{ padding: 24 }}>
        <p style={{ fontSize: 13 }}>Gasto perene não encontrado.</p>
        <button type="button" onClick={onBack} className="btn-save-main" style={{ marginTop: 16 }}>
          Voltar
        </button>
      </div>
    );
  }

  const statusClass = (s: CompromissoRecord['status']) => {
    if (s === 'quitado') return 'gasto-perene-hist__pill--muted';
    if (s === 'vencido') return 'compromisso-card__status--danger';
    if (s === 'cancelado') return 'gasto-perene-hist__pill--muted';
    return 'compromisso-card__status--purple';
  };

  return (
    <div className="app-container gasto-perene-detail" style={{ paddingBottom: 32 }}>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} type="button">
          <ChevronLeft size={20} />
        </button>
        <span className="detail-header__title">Gasto perene</span>
        <span style={{ width: 56 }} />
      </div>

      <div className="detail-content">
        <div className="detail-info">
          <div className="detail-info__fornecedor">{record.fornecedor}</div>
          <div className="gasto-perene-detail__meta">
            <span>{labelPeriodicidade(record.periodicidade)}</span>
            <span> · </span>
            <span>{formatVencimentoGastoPerene(record)}</span>
          </div>
        </div>

        {!editing ? (
          <>
            <div className="gasto-perene-detail__row">
              <span className="gasto-perene-detail__label">Valor previsto</span>
              <span className="gasto-perene-detail__value">{formatCurrency(record.valorPrevistoCents)}</span>
            </div>
            <div className="gasto-perene-detail__row">
              <span className="gasto-perene-detail__label">Data de início</span>
              <span>{record.dataInicio}</span>
            </div>
            {record.dataTermino && (
              <div className="gasto-perene-detail__row">
                <span className="gasto-perene-detail__label">Data de término</span>
                <span>{record.dataTermino}</span>
              </div>
            )}
            <div className="gasto-perene-detail__row">
              <span className="gasto-perene-detail__label">Status</span>
              <span>{record.status === 'ativo' ? 'ativo' : 'encerrado'}</span>
            </div>
            {record.observacoes.trim() ? (
              <div className="gasto-perene-detail__obs">
                <div className="gasto-perene-detail__label">Observações</div>
                <p>{record.observacoes}</p>
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ paddingTop: 8 }}>
            <CurrencyInput
              label="Valor previsto"
              valueCents={valorCents}
              onChange={setValorCents}
              bgVariant="surface"
            />
            {record.periodicidade === 'anual' && (
              <FloatingSelect
                label="Mês de vencimento"
                value={mesNome}
                onChange={setMesNome}
                options={MESES}
                bgVariant="surface"
              />
            )}
            <FloatingInput
              label={record.periodicidade === 'anual' ? 'Dia de vencimento' : 'Dia de vencimento'}
              value={diaStr}
              onChange={(v) => setDiaStr(v.replace(/\D/g, '').slice(0, 2))}
              inputMode="numeric"
              bgVariant="surface"
            />
            <div className="floating-field" style={{ marginBottom: 16 }}>
              <textarea
                className="floating-field__input"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                style={{ resize: 'vertical', minHeight: 72 }}
              />
              <label
                className="floating-field__label"
                style={{
                  top: 0,
                  transform: 'translateY(-50%)',
                  fontSize: 10,
                  color: 'var(--accent)',
                  background: 'var(--bg-main)',
                  padding: '0 5px',
                }}
              >
                Observações
              </label>
            </div>
            <button
              type="button"
              className="btn-save-main"
              onClick={handleSalvarEdicao}
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValorCents(record.valorPrevistoCents);
                setDiaStr(String(record.diaVencimento));
                setMesNome(record.mesVencimento ? MESES[record.mesVencimento - 1] : 'Janeiro');
                setObservacoes(record.observacoes);
              }}
              style={{
                width: '100%',
                marginTop: 8,
                padding: '12px',
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                borderRadius: 8,
                color: 'var(--text-inactive)',
                cursor: 'pointer',
              }}
            >
              Cancelar edição
            </button>
          </div>
        )}

        {!editing && (
          <div className="gasto-perene-detail__actions">
            <button type="button" className="btn-save-draft" onClick={() => setEditing(true)}>
              Editar
            </button>
            {record.status === 'ativo' && (
              <button
                type="button"
                className="gasto-perene-detail__encerrar"
                onClick={handleEncerrar}
                disabled={saving}
              >
                Encerrar gasto perene
              </button>
            )}
          </div>
        )}

        <div className="gasto-perene-hist">
          <h3 className="gasto-perene-hist__title">Compromissos deste gasto perene</h3>
          {historico.length === 0 ? (
            <p className="gasto-perene-hist__empty">Nenhum compromisso gerado ainda.</p>
          ) : (
            historico.map((c) => (
              <button
                key={c.id}
                type="button"
                className="gasto-perene-hist__item"
                onClick={() => onSelectCompromisso(c)}
              >
                <div className="gasto-perene-hist__top">
                  <span className="gasto-perene-hist__nome">{compromissoDisplayTitle(c)}</span>
                  <span className="gasto-perene-hist__total">{formatCurrency(c.total)}</span>
                </div>
                <div className="gasto-perene-hist__bottom">
                  <span>{c.dataPrevistaPagamento}</span>
                  <span className={`compromisso-card__status ${statusClass(c.status)}`}>
                    {labelStatusCompromisso(c.status)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
