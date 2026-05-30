## Design System — Paleta da empresa (60-30-10)

**Tokens base (commit `a4ca1b8`):**
- 60% fundo: `--bg-base` / `--bg-main` → `#1C1D1F`
- 30% superfícies: `--surface-1` / `--bg-surface` → `#2B2C2E`
- 10% accent: `--accent` → `#DC615C` (apenas ações primárias e nav ativo)
- Texto alto contraste: `--text-primary` → `#F0F0EB`
- Texto muted: `--text-muted` → `#ACACAC`
- Sem bordas em campos/cards — limites por delta de luminosidade

### Problemas críticos descobertos (pós `a4ca1b8`)

**Problema 1 — Fundo não propagou para todas as páginas**
`--bg-base: #1C1D1F` foi aplicado, mas telas de lista ainda usavam `--bg-screen: #0a0a0a`. **Resolvido no Commit 2** (`--bg-screen: var(--bg-base)`).

**Problema 2 — Modo Edição visualmente quebrado**
Estado de edição em Novo Gasto concentra ~10 pontos de coral (borda lateral, labels focados, badges, botões, item NOVO). Viola gravemente a regra 60-30-10. Causa raiz: regra global de floating label em foco (`color: var(--accent)`) + classes `.item-form--editing`, `.item-row--editing`, `.btn-save-main` primário.

**Problema 3 — Estados especiais não foram pensados**
Modo edição, foco, item recém-criado herdam accent automaticamente. Precisam de regras próprias (Opção A: discreta — ver plano Passo 2).

### Regras obrigatórias do design system

**Regra 8 — Análise de contraste antes de aplicar mudanças**

Antes de aplicar qualquer mudança de paleta em massa:
1. Inventariar todos os elementos que vão receber accent na tela afetada
2. Contar quantos pontos de accent vão aparecer na mesma tela
3. Alertar se passar de 3–4 pontos (viola 60-30-10)
4. Listar elementos competindo visualmente (dois botões preenchidos lado a lado, três cores em sequência, etc.)

Se passar de 3–4 pontos, **parar e reportar** antes de aplicar.

**Regra 9 — Estados especiais precisam de tratamento próprio**

Estados como modo edição, modo seleção, campo focado, estado vencido, item recém-criado **não podem herdar accent automaticamente**.

Cada estado especial deve:
1. Ser identificado antes da aplicação
2. Ter regra própria (discreta, médio destaque ou destaque forte)
3. Ser revisado quanto ao impacto visual total da tela

**Default:** `--accent-muted`, fundo levemente elevado, badge muted — **nunca** coral preenchido em vários elementos simultaneamente.

**Regra 10 — Floating Label nunca muda de cor por estado**

Em FloatingInput, FloatingSelect e CurrencyInput, o label permanece em `#ACACAC` (`--text-muted`) em todos os estados: normal, focado, preenchido, disabled (com opacidade reduzida).

Não usar accent no label. Foco indicado por outline externo, não por mudança de cor do label.

### Revisão de Tema — próximos passos

**Concluído:**
- **Passo 0** (`d8860b2`): propaga `--bg-base` para todas as telas; aliases `--card-bg`, `--bg-color`.
- **Passo 1** (`bb30998`): paleta completa em Meus Gastos (busca, cards status/histórico, botões secundários, resumo).

**Pendente:**
1. **Passo 2 — Modo Edição:** corrigir ~10 pontos de coral (Opção A discreta).
2. **Passo 3 — Ajustes menores:** bullet de pendências semântico, botões disabled sem borda residual.
3. **Hardcode `#151515`** em `SalvarCompromissoModal.tsx` (tabela de parcelas).
4. **Token `--border` undefined** em 14 lugares (Admin/OrgSelector) — commit futuro se necessário.
5. **Validação visual Admin/OrgSelector** em uso real (multi-org / Super Admin).

---

## Dívida técnica registrada

### Design System — Etapa 8 (limpeza + acessibilidade)

**Aliases a manter (migração gradual, sem remoção nesta etapa):**
- Botões: `btn-save-main`, `btn-save-modal`, `btn-save-draft`, `btn-launch`, `btn-compromisso-*` → mapeados a `button-finance` em `index.css`.
- Inputs: `floating-field`, variantes `--main-bg` / `--surface-bg` / `--edit-bg` → mapeados a `input-finance`.
- Cards: `gasto-card`, `meus-gastos-month-card` → mapeados a `card-finance`.
- Modais: `modal-overlay`, `modal-sheet`, `ph-title` → convivem com `modal-finance` / `bottom-sheet-finance` (sheets de cotação e fluxos legados ainda usam classes antigas).

**Corrigido na Etapa 8 (commits da revisão de tema):**
- Token `--bg-screen` alinhado a `--bg-base` (`#1C1D1F`) — `d8860b2`.
- Aliases legados Admin/Org: `--card-bg`, `--bg-color` definidos em `tokens.css` — `d8860b2`.
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
