-- Parcelas de compromissos + vínculo opcional com gasto de quitação
-- Idempotente: seguro em bancos que já tinham a tabela sem gasto_id.

CREATE TABLE IF NOT EXISTS public.compromisso_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compromisso_id uuid NOT NULL REFERENCES public.compromissos (id) ON DELETE CASCADE,
  numero_parcela integer NOT NULL,
  total_parcelas integer NOT NULL,
  valor_centavos integer NOT NULL,
  data_vencimento date NOT NULL,
  status text NOT NULL CHECK (status IN ('pendente', 'vencido', 'quitado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compromisso_parcelas
  ADD COLUMN IF NOT EXISTS gasto_id uuid REFERENCES public.gastos (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS compromisso_parcelas_compromisso_idx
  ON public.compromisso_parcelas (compromisso_id);

ALTER TABLE public.compromisso_parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage compromisso_parcelas" ON public.compromisso_parcelas;
CREATE POLICY "Org members manage compromisso_parcelas"
  ON public.compromisso_parcelas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.compromissos c
      JOIN public.organizacao_membros om ON om.org_id = c.org_id
      WHERE c.id = compromisso_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.compromissos c
      JOIN public.organizacao_membros om ON om.org_id = c.org_id
      WHERE c.id = compromisso_id AND om.user_id = auth.uid()
    )
  );
