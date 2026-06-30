-- Classificação MTD em gastos realizados (empresariais)

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS direcionamento_mtd text
    CHECK (direcionamento_mtd IS NULL OR direcionamento_mtd IN ('CP', 'DC', 'DS')),
  ADD COLUMN IF NOT EXISTS classificacao_geral_mtd text,
  ADD COLUMN IF NOT EXISTS natureza_mtd_raiz text
    CHECK (natureza_mtd_raiz IS NULL OR natureza_mtd_raiz IN ('material', 'mao_obra', 'servico')),
  ADD COLUMN IF NOT EXISTS natureza_mtd_caminho text[],
  ADD COLUMN IF NOT EXISTS mtd_status text NOT NULL DEFAULT 'nao_classificado'
    CHECK (mtd_status IN ('nao_classificado', 'classificado')),
  ADD COLUMN IF NOT EXISTS mtd_classificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS mtd_classificado_por uuid;

CREATE INDEX IF NOT EXISTS gastos_org_mtd_status_idx
  ON public.gastos (org_id, mtd_status)
  WHERE tipo_gasto = 'Empresarial';

CREATE INDEX IF NOT EXISTS gastos_org_direcionamento_mtd_idx
  ON public.gastos (org_id, direcionamento_mtd)
  WHERE mtd_status = 'classificado';

CREATE INDEX IF NOT EXISTS gastos_org_data_compra_mtd_idx
  ON public.gastos (org_id, data_compra)
  WHERE tipo_gasto = 'Empresarial' AND mtd_status = 'classificado';

COMMENT ON COLUMN public.gastos.direcionamento_mtd IS 'CP/DC/DS — direcionamento MTD empresarial.';
COMMENT ON COLUMN public.gastos.classificacao_geral_mtd IS 'Slug da classificação geral MTD.';
COMMENT ON COLUMN public.gastos.natureza_mtd_raiz IS 'Raiz da natureza MTD: material, mao_obra, servico.';
COMMENT ON COLUMN public.gastos.natureza_mtd_caminho IS 'Slugs do caminho na árvore MTD, raiz → folha.';
COMMENT ON COLUMN public.gastos.mtd_status IS 'nao_classificado | classificado';

UPDATE public.gastos
SET mtd_status = 'nao_classificado'
WHERE tipo_gasto = 'Empresarial'
  AND mtd_status IS DISTINCT FROM 'classificado';
