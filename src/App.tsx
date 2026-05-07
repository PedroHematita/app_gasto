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
import { CompromissoDetail } from './components/CompromissoDetail';
import { GastoPereneDetail } from './components/GastoPereneDetail';
import { GastoPereneFormModal } from './components/GastoPereneFormModal';
import { SalvarCompromissoModal } from './components/SalvarCompromissoModal';
import { CompromissosSummaryStrip } from './components/CompromissosSummaryStrip';
import { PriceWarningModal } from './components/PriceWarningModal';
import { OrgSelector } from './components/OrgSelector';
import { AdminGateway } from './components/admin/AdminGateway';
import { AdminPanel } from './components/admin/AdminPanel';
import { LogoutButton } from './components/LogoutButton';
import { OrgProvider, useOrg } from './contexts/OrgContext';
import { formatDateBR, generateId } from './utils';
import {
  supabase,
  saveGasto,
  updateGasto,
  fetchPriceHistory,
  saveCompromisso,
  fetchCompromissoIndicatorCounts,
  fetchCompromissoById,
  linkCompromissoQuitado,
  uploadComprovante,
  ensureCompromissosFromGastosPerenes,
} from './lib/supabase';
import type { GastoItem, PaymentData, Screen, GastoRecord, CompromissoRecord, GastoPereneRecord } from './types';

const defaultPayment: PaymentData = {
  fornecedor: '',
  formaPagamento: 'a_vista',
  meioPagamento: 'PIX',
  instituicaoFinanceira: 'Nubank',
  observacoes: '',
  comprovanteFile: null,
  comprovanteUrl: '',
  parcelas: 1,
};

function AppInner() {
  const { currentOrg, orgs, switchOrg, loading: orgLoading, isSuperAdmin } = useOrg();
  const orgId = currentOrg?.id || '';

  // AppInner is only rendered when authenticated
  const authenticated = true;

  // --- DIAGNOSTICS ---
  useEffect(() => {
    async function runDiagnostics() {
      console.log('--- DIAGNOSTICS START ---');
      console.log('1. Active orgId:', orgId);
      console.log('2. currentOrg object:', currentOrg);
      
      if (!orgId) {
        console.log('3. orgId is empty, skipping DB check');
        return;
      }

      console.log('3. Testing fetchGastos with orgId:', orgId);
      const { data, error } = await supabase!
        .from('gastos')
        .select('id, fornecedor, total, org_id')
        .eq('org_id', orgId)
        .limit(5);
        
      if (error) {
        console.error('4. ERROR fetching gastos:', error);
      } else {
        console.log(`4. SUCCESS! Found ${data?.length} gastos:`, data);
      }
      console.log('--- DIAGNOSTICS END ---');
    }
    
    if (currentOrg) {
      runDiagnostics();
    }
  }, [currentOrg, orgId]);
  // -------------------

  // Screen state
  const [screen, setScreen] = useState<Screen>('main');
  const [adminChoice, setAdminChoice] = useState<'admin' | 'user' | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showClearDraftWarning, setShowClearDraftWarning] = useState(false);

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

  const [selectedCompromisso, setSelectedCompromisso] = useState<CompromissoRecord | null>(null);
  const [showSalvarCompromissoModal, setShowSalvarCompromissoModal] = useState(false);
  const [showQuitPaymentModal, setShowQuitPaymentModal] = useState(false);
  const [compromissoIndicatorCounts, setCompromissoIndicatorCounts] = useState({
    vencidos: 0,
    pendentes: 0,
  });
  const [focusCompromissosNonce, setFocusCompromissosNonce] = useState(0);

  const [showGastoPereneModal, setShowGastoPereneModal] = useState(false);
  const [selectedGastoPereneId, setSelectedGastoPereneId] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated || !supabase || !orgId) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureCompromissosFromGastosPerenes(orgId);
        if (!cancelled) setRefreshKey((k) => k + 1);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, orgId]);

  useEffect(() => {
    if (!authenticated || !supabase || !orgId) return;
    if (screen !== 'main' && screen !== 'gasto_edit') return;
    fetchCompromissoIndicatorCounts(orgId)
      .then(setCompromissoIndicatorCounts)
      .catch(() => {});
  }, [authenticated, screen, refreshKey, orgId]);

  // Computed total
  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.valorCentavos, 0),
    [items]
  );

  const hasDraft = useMemo(() => {
    if (editingGastoId) return false;
    return items.length > 0 || descricao.trim() !== '' || valorCentavos > 0;
  }, [items, descricao, valorCentavos, editingGastoId]);

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
      const dbUnit = await checkUnidadeForDescricao(orgId, descricao);
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

    const normalizedDesc = descricao.trim().replace(/\s+/g, ' ');
    if (normalizedDesc.length < 3) {
      alert("A descrição do item é muito curta.\nUse ao menos 3 caracteres para identificar \no produto ou serviço.");
      setTimeout(() => document.getElementById('input-descricao')?.focus(), 10);
      return;
    }

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
    const unidadeNoBanco = await checkUnidadeForDescricao(orgId, descricao);
    
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
        const history = await fetchPriceHistory(orgId, descricao.trim(), unidade);

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
      const parcelasFinal = payment.formaPagamento === 'a_vista' ? 1 : payment.parcelas;
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
          parcelasFinal,
          itemsPayload
        );
      } else {
        // INSERT mode
        await saveGasto(
          orgId,
          dataCompra,
          payment.fornecedor,
          forma,
          payment.meioPagamento,
          payment.instituicaoFinanceira,
          payment.observacoes,
          totalCents,
          payment.comprovanteUrl,
          parcelasFinal,
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
    setScreen(target);
  }, []);

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
      parcelas: g.formaPagamento === 'À Vista' ? 1 : (g.parcelas || 2),
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

  const handleSalvarRascunhoClick = useCallback(() => {
    if (items.length === 0) return;
    setShowSalvarCompromissoModal(true);
  }, [items.length]);

  const handleConfirmSalvarCompromisso = useCallback(
    async (fornecedor: string, dataPrevistaBR: string) => {
      try {
        const payload = items.map((item) => ({
          ordem: item.ordem,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          valorCentavos: item.valorCentavos,
        }));
        await saveCompromisso(orgId, dataCompra, dataPrevistaBR, fornecedor, payload);
        setShowSalvarCompromissoModal(false);
        resetAll();
        setRefreshKey((k) => k + 1);
        const c = await fetchCompromissoIndicatorCounts(orgId);
        setCompromissoIndicatorCounts(c);
      } catch (error) {
        console.error(error);
        alert('Erro ao salvar compromisso. Verifique o console.');
      }
    },
    [dataCompra, items, resetAll]
  );

  const handleOpenCompromissosFromStrip = useCallback(() => {
    setFocusCompromissosNonce((n) => n + 1);
    setScreen('meus_gastos');
  }, []);

  const handleSelectCompromisso = useCallback(async (c: CompromissoRecord) => {
    const fresh = await fetchCompromissoById(c.id);
    setSelectedCompromisso(fresh ?? c);
    setScreen('compromisso_detail');
  }, []);

  const handleSelectGastoPerene = useCallback((gp: GastoPereneRecord) => {
    setSelectedGastoPereneId(gp.id);
    setScreen('gasto_perene_detail');
  }, []);

  const handleSavedGastoPereneModal = useCallback(async () => {
    try {
      await ensureCompromissosFromGastosPerenes(orgId);
    } catch {
      /* ignore */
    }
    setRefreshKey((k) => k + 1);
    const c = await fetchCompromissoIndicatorCounts(orgId);
    setCompromissoIndicatorCounts(c);
  }, [orgId]);

  const handleQuitCompromissoSave = useCallback(async () => {
    if (!selectedCompromisso) return;
    setSaving(true);
    try {
      const forma = payment.formaPagamento === 'a_vista' ? 'À Vista' : 'Parcelado';
      const parcelasFinal = payment.formaPagamento === 'a_vista' ? 1 : payment.parcelas;
      const itemsPayload = selectedCompromisso.items.map((item) => ({
        ordem: item.ordem,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        valorCentavos: item.valorCentavos,
      }));

      const gastoResult = await saveGasto(
        orgId,
        selectedCompromisso.dataCompra,
        payment.fornecedor,
        forma,
        payment.meioPagamento,
        payment.instituicaoFinanceira,
        payment.observacoes,
        selectedCompromisso.total,
        payment.comprovanteUrl,
        parcelasFinal,
        itemsPayload
      );

      const inserted = gastoResult as { id?: string } | null;
      if (!inserted?.id) throw new Error('Falha ao criar gasto');

      if (payment.comprovanteFile && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const url = await uploadComprovante(user.id, inserted.id, payment.comprovanteFile);
          await supabase.from('gastos').update({ comprovante_url: url }).eq('id', inserted.id);
        }
      }

      await linkCompromissoQuitado(selectedCompromisso.id, inserted.id);

      setShowQuitPaymentModal(false);
      setPayment({ ...defaultPayment });
      setSelectedCompromisso(null);
      setScreen('meus_gastos');
      setRefreshKey((k) => k + 1);
      const counts = await fetchCompromissoIndicatorCounts(orgId);
      setCompromissoIndicatorCounts(counts);
    } catch (error) {
      console.error('Error quitting compromisso:', error);
      alert('Erro ao quitar. Verifique o console.');
    } finally {
      setSaving(false);
    }
  }, [selectedCompromisso, payment]);

  // Org loading
  if (orgLoading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-inactive)', fontSize: 13 }}>Carregando organizações...</p>
      </div>
    );
  }

  // Admin Gateway
  if (isSuperAdmin && !adminChoice) {
    return (
      <AdminGateway
        onSelect={(choice) => {
          setAdminChoice(choice);
          if (choice === 'admin') {
            setScreen('admin_panel');
          }
        }}
      />
    );
  }

  // Org selection (multiple orgs, none selected)
  if (!currentOrg && adminChoice !== 'admin') {
    return <OrgSelector orgs={orgs} onSelect={switchOrg} />;
  }

  // Admin Panel
  if (screen === 'admin_panel' && isSuperAdmin) {
    return <AdminPanel onClose={() => setScreen('main')} />;
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
          orgId={orgId}
          onSelectGasto={handleSelectGasto}
          onSelectCompromisso={handleSelectCompromisso}
          onSelectGastoPerene={handleSelectGastoPerene}
          onNewGasto={() => handleNavigate('main')}
          onNovoGastoPerene={() => setShowGastoPereneModal(true)}
          refreshKey={refreshKey}
          focusCompromissosNonce={focusCompromissosNonce}
        />
        {showGastoPereneModal && (
          <GastoPereneFormModal
            orgId={orgId}
            onClose={() => setShowGastoPereneModal(false)}
            onSaved={handleSavedGastoPereneModal}
          />
        )}
        <BottomNav active="meus_gastos" onNavigate={handleNavigate} />
      </>
    );
  }

  if (screen === 'gasto_perene_detail' && selectedGastoPereneId) {
    return (
      <GastoPereneDetail
        orgId={orgId}
        gastoPereneId={selectedGastoPereneId}
        onBack={() => {
          setSelectedGastoPereneId(null);
          setScreen('meus_gastos');
        }}
        onEncerrado={() => {
          setRefreshKey((k) => k + 1);
          setSelectedGastoPereneId(null);
          setScreen('meus_gastos');
        }}
        onSelectCompromisso={async (c) => {
          const fresh = await fetchCompromissoById(c.id);
          setSelectedCompromisso(fresh ?? c);
          setSelectedGastoPereneId(null);
          setScreen('compromisso_detail');
        }}
        refreshNonce={refreshKey}
      />
    );
  }

  // Detalhe compromisso
  if (screen === 'compromisso_detail' && selectedCompromisso) {
    return (
      <>
        <CompromissoDetail
          compromisso={selectedCompromisso}
          onBack={() => {
            setSelectedCompromisso(null);
            setScreen('meus_gastos');
          }}
          onRequestQuit={() => {
            setPayment({ ...defaultPayment });
            setShowQuitPaymentModal(true);
          }}
          onCancelled={() => {
            setRefreshKey((k) => k + 1);
            setSelectedCompromisso(null);
            setScreen('meus_gastos');
          }}
        />
        {showQuitPaymentModal && (
          <PaymentModal
            orgId={orgId}
            payment={payment}
            onChange={handlePaymentChange}
            onSave={handleQuitCompromissoSave}
            onClose={() => setShowQuitPaymentModal(false)}
            saving={saving}
            totalCents={selectedCompromisso.total}
            modalTitle="Quitar compromisso"
            saveButtonLabel="Confirmar quitação"
          />
        )}
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

      {/* Draft Clear Button */}
      {!isEditMode && hasDraft && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 0', position: 'relative', zIndex: 11 }}>
          <button
            onClick={() => setShowClearDraftWarning(true)}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff4444',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            Limpar rascunho
          </button>
        </div>
      )}

      {/* Date header & Logout */}
      <div className="date-header" style={{ paddingTop: (!isEditMode && hasDraft) ? 8 : 16, position: 'relative' }}>
        {!isEditMode && (
          <div style={{ position: 'absolute', top: (!isEditMode && hasDraft) ? 8 : 16, right: 16, zIndex: 10 }}>
            <LogoutButton onLogoutComplete={() => window.location.reload()} />
          </div>
        )}
        <div className="date-header__row" style={{ paddingRight: !isEditMode ? 40 : 0 }}>
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
            autoComplete="off"
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

      {!isEditMode && (
        <CompromissosSummaryStrip
          vencidos={compromissoIndicatorCounts.vencidos}
          pendentes={compromissoIndicatorCounts.pendentes}
          onOpenMeusGastosCompromissos={handleOpenCompromissosFromStrip}
        />
      )}

      <ItemForm
        orgId={orgId}
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

      {!isEditMode ? (
        <div className="btn-save-actions-row">
          <button
            className="btn-save-main"
            disabled={items.length === 0}
            onClick={handleOpenPayment}
            type="button"
          >
            Salvar gasto
          </button>
          <button
            className="btn-save-draft"
            disabled={items.length === 0}
            onClick={handleSalvarRascunhoClick}
            type="button"
          >
            Salvar rascunho
          </button>
        </div>
      ) : (
        <button
          className="btn-save-main"
          disabled={items.length === 0}
          onClick={handleOpenPayment}
          type="button"
        >
          Salvar alterações
        </button>
      )}

      {showSalvarCompromissoModal && (
        <SalvarCompromissoModal
          orgId={orgId}
          dataCompraBR={dataCompra}
          onClose={() => setShowSalvarCompromissoModal(false)}
          onConfirm={handleConfirmSalvarCompromisso}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          orgId={orgId}
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

      {showClearDraftWarning && (
        <div className="modal-overlay" onClick={() => setShowClearDraftWarning(false)} style={{ zIndex: 1000 }}>
          <div className="modal-sheet price-history-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="ph-title" style={{ color: '#ff4444', marginBottom: 12 }}>Atenção</div>
            
            <div style={{ padding: '10px 20px 20px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <p>Deseja descartar o rascunho atual?</p>
              <p style={{ marginTop: 8 }}>Todos os dados preenchidos serão perdidos.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
              <button
                onClick={() => {
                  setShowClearDraftWarning(false);
                  resetAll();
                }}
                type="button"
                style={{ width: '100%', padding: '14px', borderRadius: 8, background: '#333', color: '#ff4444', border: 'none', fontWeight: 500, cursor: 'pointer' }}
              >
                Descartar rascunho
              </button>
              <button
                onClick={() => setShowClearDraftWarning(false)}
                type="button"
                style={{ width: '100%', padding: '14px', borderRadius: 8, background: 'transparent', color: 'var(--text-inactive)', border: '1px solid #333', fontWeight: 500, cursor: 'pointer' }}
              >
                Cancelar
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

function App() {
  return <AppContent />;
}

function AppContent() {
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

  if (checkingAuth) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-inactive)', fontSize: 13 }}>Carregando...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <OrgProvider authenticated={authenticated}>
      <AppInner />
    </OrgProvider>
  );
}

export default App;

