-- MTD por item do gasto (fonte principal) + status consolidado em gastos
-- Idempotente: colunas e constraints em passos separados (compatível com SQL Editor).

-- =============================================================================
-- 1. Colunas MTD em public.itens_gasto
-- =============================================================================

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS direcionamento_mtd text;

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS classificacao_geral_mtd text;

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS natureza_mtd_raiz text;

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS natureza_mtd_caminho text[];

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS mtd_classificado_em timestamptz;

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS mtd_classificado_por uuid;

ALTER TABLE public.itens_gasto
  ADD COLUMN IF NOT EXISTS mtd_status text;

UPDATE public.itens_gasto
SET mtd_status = 'nao_classificado'
WHERE mtd_status IS NULL;

ALTER TABLE public.itens_gasto
  ALTER COLUMN mtd_status SET DEFAULT 'nao_classificado';

ALTER TABLE public.itens_gasto
  ALTER COLUMN mtd_status SET NOT NULL;

-- CHECK constraints (nome explícito; só cria se ainda não existir)
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

CREATE INDEX IF NOT EXISTS itens_gasto_gasto_mtd_status_idx
  ON public.itens_gasto (gasto_id, mtd_status);

COMMENT ON COLUMN public.itens_gasto.direcionamento_mtd IS 'CP/DC/DS — direcionamento MTD do item.';
COMMENT ON COLUMN public.itens_gasto.classificacao_geral_mtd IS 'Slug da classificação geral MTD do item.';
COMMENT ON COLUMN public.itens_gasto.natureza_mtd_raiz IS 'Raiz da natureza MTD do item.';
COMMENT ON COLUMN public.itens_gasto.natureza_mtd_caminho IS 'Slugs do caminho MTD do item, raiz → folha.';
COMMENT ON COLUMN public.itens_gasto.mtd_status IS 'nao_classificado | classificado — fonte principal MTD.';

-- =============================================================================
-- 2. gastos.mtd_status — aceitar parcialmente_classificado (resumo consolidado)
-- =============================================================================

ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_mtd_status_check;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'gastos'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%mtd_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_mtd_status_check
  CHECK (mtd_status IN ('nao_classificado', 'parcialmente_classificado', 'classificado'));

COMMENT ON COLUMN public.gastos.mtd_status IS 'Resumo consolidado dos itens: nao_classificado | parcialmente_classificado | classificado.';

-- =============================================================================
-- 3. Reset — campos MTD detalhados em gastos deixam de ser fonte (Opção A)
-- =============================================================================

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
