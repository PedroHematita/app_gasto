import { useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { FloatingInput } from './components/FloatingInput';
import { TotalBar } from './components/TotalBar';
import { ItemForm } from './components/ItemForm';
import { ItemsTable } from './components/ItemsTable';
import { PaymentModal } from './components/PaymentModal';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { LoginScreen } from './components/LoginScreen';
import { DatePickerSheet } from './components/DatePickerSheet';
import { BottomNav } from './components/BottomNav';
import { MeusGastos } from './components/MeusGastos';
import { GastoDetail } from './components/GastoDetail';
import { PriceWarningModal } from './components/PriceWarningModal';
import { formatDateBR, generateId } from './utils';
import { supabase, saveGasto, updateGasto, fetchPriceHistory } from './lib/supabase';
import type { GastoItem, PaymentData, Screen, GastoRecord } from './types';

const defaultPayment: PaymentData = {
  fornecedor: '',
  formaPagamento: 'a_vista',
  meioPagamento: 'PIX',
  instituicaoFinanceira: 'Nubank',
  observacoes: '',
  comprovanteFile: null,
  comprovanteUrl: '',
  parcelas: 2,
};

function App() {
  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setCheckingAuth(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Screen state
  const [screen, setScreen] = useState<Screen>('main');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Date
  const [dataCompra, setDataCompra] = useState(formatDateBR(new Date()));

  // Items
  const [items, setItems] = useState<GastoItem[]>([]);
  const [latestItemId, setLatestItemId] = useState<string | null>(null);
  const [nextOrdem, setNextOrdem] = useState(1);

  // Form state
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [unidade, setUnidade] = useState('Unidade');
  const [valorCentavos, setValorCentavos] = useState(0);
  const [lockedUnit, setLockedUnit] = useState<string | null>(null);

  const [pendingItemWarning, setPendingItemWarning] = useState<{
    media: number;
    unidade: string;
    limiteInferior: number;
    limiteSuperior: number;
    valorInformado: number;
    commit: () => void;
  } | null>(null);

  // Zero value warning state
  const [pendingZeroWarning, setPendingZeroWarning] = useState<(() => void) | null>(null);

  // Edit mode (editing an item within the form)
  const [editingItem, setEditingItem] = useState<GastoItem | null>(null);

  // Payment
  const [payment, setPayment] = useState<PaymentData>({ ...defaultPayment });

  // Saved data for confirmation
  const [savedData, setSavedData] = useState<{
    dataCompra: string;
    items: GastoItem[];
    payment: PaymentData;
    totalCents: number;
  } | null>(null);

  // Edit gasto mode (editing an existing gasto from DB)
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);
  const [editingGastoSeq, setEditingGastoSeq] = useState<number | null>(null);

  // Meus Gastos
  const [selectedGasto, setSelectedGasto] = useState<GastoRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Computed total
  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.valorCentavos, 0),
    [items]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setDescricao('');
    setQuantidade('1');
    setUnidade('Unidade');
    setValorCentavos(0);
    setEditingItem(null);
    setLockedUnit(null);
  }, []);

  // Full reset to new gasto state
  const resetAll = useCallback(() => {
    setItems([]);
    setLatestItemId(null);
    setNextOrdem(1);
    setDataCompra(formatDateBR(new Date()));
    setPayment({ ...defaultPayment });
    setSavedData(null);
    setEditingGastoId(null);
    setEditingGastoSeq(null);
    resetForm();
  }, [resetForm]);

  // Check history to lock unit
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (descricao.trim().length < 2) {
        setLockedUnit(null);
        return;
      }
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const normInput = normalize(descricao);

      // 1. Check local list
      const itemAtual = items.find((i) => i.id !== editingItem?.id && normalize(i.descricao) === normInput);
      if (itemAtual) {
        setLockedUnit(itemAtual.unidade);
        setUnidade(itemAtual.unidade);
        return;
      }

      // 2. Check DB
      const { checkUnidadeForDescricao } = await import('./lib/supabase');
      const dbUnit = await checkUnidadeForDescricao(descricao);
      if (dbUnit) {
        setLockedUnit(dbUnit);
        setUnidade(dbUnit);
      } else {
        setLockedUnit(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [descricao, items, editingItem]);

  // Add or update item
  const handleSubmitItem = useCallback(async () => {
    if (!descricao.trim()) return;

    // Validação da quantidade
    const qtyStr = quantidade.replace(',', '.');
    const qty = parseFloat(qtyStr);
    
    if (isNaN(qty) || qty <= 0) {
      alert("A quantidade informada é inválida.\nInforme um valor maior que zero para continuar.");
      setTimeout(() => document.getElementById('input-quantidade')?.focus(), 10);
      return;
    }

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const normInput = normalize(descricao);

    // 1. Validar na lista atual
    const itemAtual = items.find((i) => i.id !== editingItem?.id && normalize(i.descricao) === normInput);
    if (itemAtual && itemAtual.unidade !== unidade) {
      alert(`Esta descrição já está na lista atual com a unidade de medida "${itemAtual.unidade}".\nPara usar outra unidade, altere a descrição do item.`);
      return;
    }

    // 2. Validar no banco de dados
    const { checkUnidadeForDescricao } = await import('./lib/supabase');
    const unidadeNoBanco = await checkUnidadeForDescricao(descricao);
    
    if (unidadeNoBanco && unidadeNoBanco !== unidade) {
      alert(`Esta descrição já está cadastrada com a unidade de medida "${unidadeNoBanco}".\nPara usar outra unidade, altere a descrição do item.\nExemplo: "${descricao.trim()} sem controle de litros".`);
      return;
    }

    const commitItem = () => {
      if (editingItem) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? { ...item, descricao: descricao.trim(), quantidade: qty, unidade, valorCentavos }
              : item
          )
        );
        resetForm();
      } else {
        const newItem: GastoItem = {
          id: generateId(),
          ordem: nextOrdem,
          descricao: descricao.trim(),
          quantidade: qty,
          unidade,
          valorCentavos,
        };
        setItems((prev) => [...prev, newItem]);
        setLatestItemId(newItem.id);
        setNextOrdem((n) => n + 1);
        resetForm();
      }
    };

    const checkPriceDeviationAndCommit = async () => {
      // Price deviation check
      if (qty > 0 && valorCentavos > 0) {
        const history = await fetchPriceHistory(descricao.trim(), unidade);

        if (history.length > 0) {
          const totalHistCents = history.reduce((s, r) => s + r.valorCentavos, 0);
          const totalHistQty = history.reduce((s, r) => s + r.quantidade, 0);
          const mediaPonderada = totalHistQty > 0 ? Math.round(totalHistCents / totalHistQty) : 0;

          if (mediaPonderada > 0) {
            const limInf = Math.round(mediaPonderada * 0.9);
            const limSup = Math.round(mediaPonderada * 1.1);
            const valorUnitario = Math.round(valorCentavos / qty);

            if (valorUnitario < limInf || valorUnitario > limSup) {
              setPendingItemWarning({
                media: mediaPonderada,
                unidade,
                limiteInferior: limInf,
                limiteSuperior: limSup,
                valorInformado: valorUnitario,
                commit: () => {
                  commitItem();
                  setPendingItemWarning(null);
                }
              });
              return;
            }
          }
        }
      }

      commitItem();
    };

    if (valorCentavos === 0) {
      setPendingZeroWarning(() => checkPriceDeviationAndCommit);
      return;
    }

    await checkPriceDeviationAndCommit();
  }, [descricao, quantidade, unidade, valorCentavos, editingItem, nextOrdem, resetForm, items]);

  const handleEdit = useCallback((item: GastoItem) => {
    setEditingItem(item);
    setDescricao(item.descricao);
    setQuantidade(String(item.quantidade));
    setUnidade(item.unidade);
    setValorCentavos(item.valorCentavos);
  }, []);

  const handleCancelEdit = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleDelete = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (editingItem?.id === id) resetForm();
      if (latestItemId === id) setLatestItemId(null);
    },
    [editingItem, latestItemId, resetForm]
  );

  const handleOpenPayment = useCallback(() => {
    setShowPaymentModal(true);
  }, []);

  const handlePaymentChange = useCallback((data: Partial<PaymentData>) => {
    setPayment((prev) => ({ ...prev, ...data }));
  }, []);

  // Save or update gasto
  const handleSaveGasto = useCallback(async () => {
    setSaving(true);
    try {
      const forma = payment.formaPagamento === 'a_vista' ? 'À Vista' : 'Parcelado';
      const itemsPayload = items.map((item) => ({
        ordem: item.ordem,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valorCentavos: item.valorCentavos,
      }));

      if (editingGastoId) {
        // UPDATE mode — preserve comprovante_url if no new file
        const newUrl = payment.comprovanteFile ? payment.comprovanteUrl : null;
        await updateGasto(
          editingGastoId,
          dataCompra,
          payment.fornecedor,
          forma,
          payment.meioPagamento,
          payment.instituicaoFinanceira,
          payment.observacoes,
          totalCents,
          newUrl,
          payment.parcelas,
          itemsPayload
        );
      } else {
        // INSERT mode
        await saveGasto(
          dataCompra,
          payment.fornecedor,
          forma,
          payment.meioPagamento,
          payment.instituicaoFinanceira,
          payment.observacoes,
          totalCents,
          payment.comprovanteUrl,
          payment.parcelas,
          itemsPayload
        );
      }

      setSavedData({
        dataCompra,
        items: [...items],
        payment: { ...payment },
        totalCents,
      });

      setShowPaymentModal(false);
      setRefreshKey((k) => k + 1);

      if (editingGastoId) {
        // After edit: go back to detail (refresh it)
        const { fetchGastoById } = await import('./lib/supabase');
        const updated = await fetchGastoById(editingGastoId);
        if (updated) {
          setSelectedGasto(updated);
          setScreen('gasto_detail');
        } else {
          setScreen('meus_gastos');
        }
        resetAll();
      } else {
        setScreen('confirmation');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Erro ao salvar. Verifique o console.');
    } finally {
      setSaving(false);
    }
  }, [dataCompra, items, payment, totalCents, editingGastoId, resetAll]);

  // New expense
  const handleNewExpense = useCallback(() => {
    resetAll();
    setScreen('main');
  }, [resetAll]);

  // Navigate from bottom nav
  const handleNavigate = useCallback((target: Screen) => {
    if (target === 'main') {
      resetAll();
    }
    setScreen(target);
  }, [resetAll]);

  // Select gasto from list
  const handleSelectGasto = useCallback((gasto: GastoRecord) => {
    setSelectedGasto(gasto);
    setScreen('gasto_detail');
  }, []);

  // Start editing a gasto
  const handleStartEdit = useCallback(() => {
    if (!selectedGasto) return;
    const g = selectedGasto;

    // Hydrate the main screen with existing data
    setDataCompra(g.dataCompra);
    setItems(g.items.map((item) => ({ ...item })));
    setNextOrdem(g.items.length > 0 ? Math.max(...g.items.map((i) => i.ordem)) + 1 : 1);
    setLatestItemId(null);

    // Hydrate payment
    setPayment({
      fornecedor: g.fornecedor,
      formaPagamento: g.formaPagamento === 'À Vista' ? 'a_vista' : 'parcelado',
      meioPagamento: g.meioPagamento,
      instituicaoFinanceira: g.instituicaoFinanceira,
      observacoes: g.observacoes,
      comprovanteFile: null,
      comprovanteUrl: g.comprovanteUrl,
      parcelas: g.parcelas || 2,
    });

    setEditingGastoId(g.id);
    setEditingGastoSeq(g.seq);
    resetForm();
    setScreen('gasto_edit');
  }, [selectedGasto, resetForm]);

  // Cancel editing gasto
  const handleCancelGastoEdit = useCallback(() => {
    resetAll();
    if (selectedGasto) {
      setScreen('gasto_detail');
    } else {
      setScreen('meus_gastos');
    }
  }, [resetAll, selectedGasto]);

  // Loading
  if (checkingAuth) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-inactive)', fontSize: 13 }}>Carregando...</p>
      </div>
    );
  }

  // Login
  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  // Confirmation screen
  if (screen === 'confirmation' && savedData) {
    return (
      <ConfirmationScreen
        dataCompra={savedData.dataCompra}
        items={savedData.items}
        payment={savedData.payment}
        totalCents={savedData.totalCents}
        onNewExpense={handleNewExpense}
      />
    );
  }

  // Meus Gastos
  if (screen === 'meus_gastos') {
    return (
      <>
        <MeusGastos
          onSelectGasto={handleSelectGasto}
          onNewGasto={() => handleNavigate('main')}
          refreshKey={refreshKey}
        />
        <BottomNav active="meus_gastos" onNavigate={handleNavigate} />
      </>
    );
  }

  // Gasto Detail
  if (screen === 'gasto_detail' && selectedGasto) {
    return (
      <GastoDetail
        gasto={selectedGasto}
        onBack={() => setScreen('meus_gastos')}
        onEdit={handleStartEdit}
      />
    );
  }

  // Main screen (new or edit mode)
  const isEditMode = screen === 'gasto_edit' && editingGastoId;

  return (
    <div className="app-container" style={{ paddingBottom: isEditMode ? 0 : 70 }}>
      {/* Edit mode header */}
      {isEditMode && (
        <div className="edit-mode-header">
          <button className="edit-mode-header__back" onClick={handleCancelGastoEdit} type="button">
            <ChevronLeft size={20} />
          </button>
          <span className="edit-mode-header__title">Editando gasto #{editingGastoSeq}</span>
        </div>
      )}

      {/* Date header */}
      <div className="date-header">
        <div className="date-header__row">
          <FloatingInput
            id="input-data"
            label="Data da compra"
            value={dataCompra}
            onChange={(value) => {
              // Auto-format with slashes
              const digits = value.replace(/\D/g, '');
              let formatted = '';
              if (digits.length <= 2) {
                formatted = digits;
              } else if (digits.length <= 4) {
                formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
              } else {
                formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
              }

              // Validate: block future dates when full date is typed
              if (digits.length === 8) {
                const day = parseInt(digits.slice(0, 2));
                const month = parseInt(digits.slice(2, 4));
                const year = parseInt(digits.slice(4, 8));
                const typed = new Date(year, month - 1, day);
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (typed > today) return; // block future
              }

              setDataCompra(formatted);
            }}
            inputMode="numeric"
            bgVariant="main"
          />
          <button
            className="date-header__calendar-btn"
            onClick={() => setShowDatePicker(true)}
            type="button"
            aria-label="Abrir calendário"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>
      </div>

      {showDatePicker && (
        <DatePickerSheet
          selectedDate={dataCompra}
          onSelect={(d) => setDataCompra(d)}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <TotalBar totalCents={totalCents} />

      <ItemForm
        descricao={descricao}
        quantidade={quantidade}
        unidade={unidade}
        valorCentavos={valorCentavos}
        editingItem={editingItem}
        lockedUnit={lockedUnit}
        onDescricaoChange={setDescricao}
        onQuantidadeChange={setQuantidade}
        onUnidadeChange={setUnidade}
        onValorChange={setValorCentavos}
        onSubmit={handleSubmitItem}
        onCancelEdit={handleCancelEdit}
      />

      <ItemsTable
        items={items}
        editingItemId={editingItem?.id ?? null}
        latestItemId={latestItemId}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <button
        className="btn-save-main"
        disabled={items.length === 0}
        onClick={handleOpenPayment}
        type="button"
      >
        {isEditMode ? 'Salvar alterações' : 'Salvar gasto'}
      </button>

      {showPaymentModal && (
        <PaymentModal
          payment={payment}
          onChange={handlePaymentChange}
          onSave={handleSaveGasto}
          onClose={() => setShowPaymentModal(false)}
          saving={saving}
          isEditing={!!editingGastoId}
          totalCents={totalCents}
        />
      )}

      {pendingItemWarning && (
        <PriceWarningModal
          media={pendingItemWarning.media}
          unidade={pendingItemWarning.unidade}
          limiteInferior={pendingItemWarning.limiteInferior}
          limiteSuperior={pendingItemWarning.limiteSuperior}
          valorInformado={pendingItemWarning.valorInformado}
          onConfirm={pendingItemWarning.commit}
          onCancel={() => setPendingItemWarning(null)}
        />
      )}

      {pendingZeroWarning && (
        <div className="modal-overlay" onClick={() => setPendingZeroWarning(null)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet price-history-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="ph-title" style={{ color: '#ffcc00', marginBottom: 12 }}>Atenção: Valor Zerado</div>
            
            <div style={{ padding: '10px 20px 20px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <p>O valor do item está zerado. Deseja lançar assim mesmo?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
              <button
                onClick={() => {
                  setPendingZeroWarning(null);
                  document.getElementById('input-valor')?.focus();
                }}
                type="button"
                style={{ width: '100%', padding: '14px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer' }}
              >
                Corrigir valor
              </button>
              <button
                onClick={() => {
                  const commit = pendingZeroWarning;
                  setPendingZeroWarning(null);
                  commit();
                }}
                type="button"
                style={{ width: '100%', padding: '14px', borderRadius: 8, background: 'transparent', color: 'var(--text-inactive)', border: '1px solid #333', fontWeight: 500, cursor: 'pointer' }}
              >
                Lançar assim mesmo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav only on new gasto screen */}
      {!isEditMode && <BottomNav active="main" onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
