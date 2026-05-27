## Dívida técnica registrada

### Cotações
- Adicionar testes de borda em `valorUnitarioCentavos` (quantidade = 0, quantidade negativa).
- Adicionar teste de integração para `fetchCotacoesList` validando agregados (`precoMedioCentavos`, `menorPrecoUnitarioCentavos`).

### Banco de dados
- Tabela `gasto_parcelas` existe no Supabase mas aparentemente é resquício de migration do fluxo obsoleto de parcelas a pagar. Avaliar se pode ser dropada com segurança (ver Parte 2 desta tarefa).
- Não há vínculo formal entre parcela quitada e o gasto gerado. Considerar adicionar `gasto_id` em `compromisso_parcelas` (ou `compromisso_parcela_id` em `gastos`) para rastreabilidade. Necessário para futuras features de estorno/edição de quitação.

### Etapa 4 do Design System
- Revisitar `src/hooks/scrollFieldIntoView.ts` — atualmente é dependência exclusiva do `CurrencyInput`. Pode virar órfão se o CurrencyInput for simplificado na Etapa 4.
