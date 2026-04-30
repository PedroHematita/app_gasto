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
import { formatDateBR, generateId } from './utils';
import { supabase, saveGasto, updateGasto } from './lib/supabase';
import type { GastoItem, PaymentData, Screen, GastoRecord } from './types';

const defaultPayment: PaymentData = {
  fornecedor: '',
  formaPagamento: 'a_vista',
  meioPagamento: 'PIX',
  instituicaoFinanceira: 'Nubank',
  observacoes: '',
  comprovanteFile: null,
  comprovanteUrl: '',
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

  // Add or update item
  const handleSubmitItem = useCallback(() => {
    if (!descricao.trim()) return;
    const qty = parseFloat(quantidade) || 1;

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
  }, [descricao, quantidade, unidade, valorCentavos, editingItem, nextOrdem, resetForm]);

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
        />
      )}

      {/* Bottom nav only on new gasto screen */}
      {!isEditMode && <BottomNav active="main" onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
