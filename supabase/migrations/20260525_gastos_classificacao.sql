-- Classificação contábil/operacional na própria linha de gasto
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS quem_gastou text,
  ADD COLUMN IF NOT EXISTS tipo_gasto text DEFAULT 'Não Classificado',
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS data_classificacao timestamptz,
  ADD COLUMN IF NOT EXISTS responsavel_classificacao uuid;

COMMENT ON COLUMN public.gastos.quem_gastou IS 'Quem realizou o gasto (classificação).';
COMMENT ON COLUMN public.gastos.tipo_gasto IS 'Tipo do gasto; padrão Não Classificado até classificar.';
COMMENT ON COLUMN public.gastos.setor IS 'Setor do gasto (classificação).';
COMMENT ON COLUMN public.gastos.data_classificacao IS 'Momento em que o gasto foi classificado.';
COMMENT ON COLUMN public.gastos.responsavel_classificacao IS 'auth.users.id de quem classificou.';
