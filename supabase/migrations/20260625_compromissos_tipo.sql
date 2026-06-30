-- Coluna tipo usada pelo app (unico | parcelado) — idempotente

ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'unico'
    CHECK (tipo IN ('unico', 'parcelado'));

COMMENT ON COLUMN public.compromissos.tipo IS 'unico = compromisso único; parcelado = N parcelas em compromisso_parcelas.';
