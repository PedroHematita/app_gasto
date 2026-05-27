## Dívida técnica registrada

### Design System — Etapa 8 (limpeza + acessibilidade)

**Aliases a manter (migração gradual, sem remoção nesta etapa):**
- Botões: `btn-save-main`, `btn-save-modal`, `btn-save-draft`, `btn-launch`, `btn-compromisso-*` → mapeados a `button-finance` em `index.css`.
- Inputs: `floating-field`, variantes `--main-bg` / `--surface-bg` / `--edit-bg` → mapeados a `input-finance`.
- Cards: `gasto-card`, `meus-gastos-month-card` → mapeados a `card-finance`.
- Modais: `modal-overlay`, `modal-sheet`, `ph-title` → convivem com `modal-finance` / `bottom-sheet-finance` (sheets de cotação e fluxos legados ainda usam classes antigas).

**Corrigido na Etapa 8 (sem commit ainda):**
- Token `--bg-screen` para fundo `#0a0a0a` das telas lista (Classificar, Meus Gastos, Cotações).
- Escala `--z-*` documentada em `tokens.css` (valores legados numéricos em `index.css` preservados).
- `:focus-visible` global para controles do design system (botões, nav, chips, TH da tabela Classificar, cards clicáveis).
- `BottomNav`: `aria-current="page"`, ícones com `aria-hidden`.
- Botões voltar (`detail-header__back`): `aria-label="Voltar"`.
- Tendência no detalhe de cotação: classes CSS com `--status-danger` / `--status-success` (sem hex inline).
- Loading auth/org: `role="status"` + `aria-live="polite"`.

**Dívida técnica — corrigir em etapa futura (fora do escopo sensível):**
- Dezenas de `style={{}}` inline em Admin, Login, OrgSelector, `SalvarCompromissoModal`, sheets Nova/Edit/AddPreco, `CotacaoPrecosTable` (swipe/delete), `PaymentModal`, `GastoPereneFormModal`.
- Hardcodes de cor em TSX (`#ffcc00`, `#333`, `#f87171`, etc.) e SVG dos gráficos (`CotacaoLineChart`, `PriceHistorySheet`).
- `z-index` numéricos soltos em componentes (`style={{ zIndex: 1100 }}`) — alinhar à escala `--z-*` quando migrar modais restantes.
- `paddingBottom: 70` / `72` inline em telas — unificar com `--layout-bottom-nav-offset` e classe `app-container--with-bottom-nav`.
- Migrar sheets de cotação (`NovaCotacaoSheet`, `EditCotacaoSheet`, `AddPrecoSheet`) e tabela com swipe para `modal-finance` sem tocar em CRUD/swipe.
- Camada semântica de spacing (`--space-xs` … `--space-xl`) e refino estético da paleta (Etapa 1 hardening).
- `scrollFieldIntoView.ts` órfão se `CurrencyInput` for simplificado (ver Etapa 4).

### Cotações
- Adicionar testes de borda em `valorUnitarioCentavos` (quantidade = 0, quantidade negativa).
- Adicionar teste de integração para `fetchCotacoesList` validando agregados (`precoMedioCentavos`, `menorPrecoUnitarioCentavos`).
- Revisitar tokenização visual de Cotações para reduzir estilos inline e consolidar uso de tokens semânticos (incluindo `--font-tabular` e cores de estado).

### Banco de dados
- Tabela `gasto_parcelas` existe no Supabase mas aparentemente é resquício de migration do fluxo obsoleto de parcelas a pagar. Avaliar se pode ser dropada com segurança (ver Parte 2 desta tarefa).
- Não há vínculo formal entre parcela quitada e o gasto gerado. Considerar adicionar `gasto_id` em `compromisso_parcelas` (ou `compromisso_parcela_id` em `gastos`) para rastreabilidade. Necessário para futuras features de estorno/edição de quitação.

### Etapa 4 do Design System
- Revisitar `src/hooks/scrollFieldIntoView.ts` — atualmente é dependência exclusiva do `CurrencyInput`. Pode virar órfão se o CurrencyInput for simplificado na Etapa 4.

### Hardening de Design Tokens
- Camada semântica de spacing (`--space-xs/sm/md/lg/xl`) proposta durante auditoria da Etapa 1. Avaliar criação em etapa de hardening de spacing.
- Revisão de tons da paleta (`--bg-base`, `--text-primary`, `--status-danger` etc.) com os valores do diagnóstico original. Aplicar em etapa de refino estético após estrutura semântica consolidada.
