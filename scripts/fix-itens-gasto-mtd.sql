-- =============================================================================
-- FIX: MTD em public.itens_gasto
-- Execute no Supabase → SQL Editor → Run (bloco inteiro ou passo a passo).
-- NÃO rode a query de conferência com ig.mtd_status ANTES deste script.
-- =============================================================================

-- PASSO 0 (opcional): ver colunas atuais
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'itens_gasto'
ORDER BY ordinal_position;

-- PASSO 1: adicionar colunas (uma por comando)
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS direcionamento_mtd text;
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS classificacao_geral_mtd text;
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS natureza_mtd_raiz text;
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS natureza_mtd_caminho text[];
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS mtd_classificado_em timestamptz;
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS mtd_classificado_por uuid;
ALTER TABLE public.itens_gasto ADD COLUMN IF NOT EXISTS mtd_status text;

-- PASSO 2: default + NOT NULL em mtd_status (só depois da coluna existir)
UPDATE public.itens_gasto SET mtd_status = 'nao_classificado' WHERE mtd_status IS NULL;
ALTER TABLE public.itens_gasto ALTER COLUMN mtd_status SET DEFAULT 'nao_classificado';
ALTER TABLE public.itens_gasto ALTER COLUMN mtd_status SET NOT NULL;

-- PASSO 3: CHECK constraints em itens_gasto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'itens_gasto_direcionamento_mtd_check'
      AND conrelid = 'public.itens_gasto'::regclass
  ) THEN
    ALTER TABLE public.itens_gasto
      ADD CONSTRAINT itens_gasto_direcionamento_mtd_check
      CHECK (direcionamento_mtd IS NULL OR direcionamento_mtd IN ('CP', 'DC', 'DS'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'itens_gasto_natureza_mtd_raiz_check'
      AND conrelid = 'public.itens_gasto'::regclass
  ) THEN
    ALTER TABLE public.itens_gasto
      ADD CONSTRAINT itens_gasto_natureza_mtd_raiz_check
      CHECK (natureza_mtd_raiz IS NULL OR natureza_mtd_raiz IN ('material', 'mao_obra', 'servico'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'itens_gasto_mtd_status_check'
      AND conrelid = 'public.itens_gasto'::regclass
  ) THEN
    ALTER TABLE public.itens_gasto
      ADD CONSTRAINT itens_gasto_mtd_status_check
      CHECK (mtd_status IN ('nao_classificado', 'classificado'));
  END IF;
END $$;

-- PASSO 4: índice
CREATE INDEX IF NOT EXISTS itens_gasto_gasto_mtd_status_idx
  ON public.itens_gasto (gasto_id, mtd_status);

-- PASSO 5: gastos.mtd_status aceita parcialmente_classificado
ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_mtd_status_check;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'gastos'
      AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%mtd_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_mtd_status_check
  CHECK (mtd_status IN ('nao_classificado', 'parcialmente_classificado', 'classificado'));

-- PASSO 6 (opcional): reset MTD detalhada em gastos empresariais
UPDATE public.gastos
SET
  direcionamento_mtd = NULL,
  classificacao_geral_mtd = NULL,
  natureza_mtd_raiz = NULL,
  natureza_mtd_caminho = NULL,
  mtd_classificado_em = NULL,
  mtd_classificado_por = NULL,
  mtd_status = 'nao_classificado'
WHERE tipo_gasto = 'Empresarial';

-- =============================================================================
-- CONFERÊNCIA — só rode DEPOIS dos passos acima
-- =============================================================================

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'itens_gasto'
  AND column_name LIKE '%mtd%'
ORDER BY column_name;

SELECT ig.mtd_status, count(*)
FROM public.itens_gasto ig
JOIN public.gastos g ON g.id = ig.gasto_id
WHERE g.tipo_gasto = 'Empresarial'
GROUP BY ig.mtd_status;
