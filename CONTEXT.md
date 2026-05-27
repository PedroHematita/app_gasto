## Dívida técnica registrada

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
