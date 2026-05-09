-- Cotações de preços por organização (independente de gastos)
-- Normalização: trim + lower + colapsar espaços (alinhada ao app / normalizeDescricao).

CREATE OR REPLACE FUNCTION public.normalize_cotacao_descricao(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(input, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.trg_cotacoes_set_descricao_normalizada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.descricao_normalizada := public.normalize_cotacao_descricao(NEW.descricao);
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  descricao_normalizada text NOT NULL,
  quantidade numeric NOT NULL,
  unidade_medida text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotacoes_quantidade_positiva CHECK (quantidade > 0)
);

-- Um produto (descrição normalizada) por organização — unidade faz parte do cadastro único.
CREATE UNIQUE INDEX IF NOT EXISTS cotacoes_org_desc_norm_uidx
  ON public.cotacoes (org_id, descricao_normalizada);

CREATE INDEX IF NOT EXISTS cotacoes_org_id_idx ON public.cotacoes (org_id);
CREATE INDEX IF NOT EXISTS cotacoes_org_desc_norm_idx ON public.cotacoes (org_id, descricao_normalizada);

DROP TRIGGER IF EXISTS trg_cotacoes_descricao_normalizada ON public.cotacoes;
CREATE TRIGGER trg_cotacoes_descricao_normalizada
  BEFORE INSERT OR UPDATE OF descricao ON public.cotacoes
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_cotacoes_set_descricao_normalizada();

CREATE TABLE IF NOT EXISTS public.cotacao_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  valor numeric NOT NULL,
  data_registro date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotacao_precos_valor_positivo CHECK (valor > 0)
);

CREATE INDEX IF NOT EXISTS cotacao_precos_cotacao_id_idx ON public.cotacao_precos (cotacao_id);
CREATE INDEX IF NOT EXISTS cotacao_precos_data_idx ON public.cotacao_precos (cotacao_id, data_registro);

ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage cotacoes" ON public.cotacoes;
CREATE POLICY "Org members manage cotacoes"
  ON public.cotacoes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = cotacoes.org_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = cotacoes.org_id AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage cotacao_precos" ON public.cotacao_precos;
CREATE POLICY "Org members manage cotacao_precos"
  ON public.cotacao_precos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cotacoes c
      JOIN public.organizacao_membros om ON om.org_id = c.org_id
      WHERE c.id = cotacao_precos.cotacao_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cotacoes c
      JOIN public.organizacao_membros om ON om.org_id = c.org_id
      WHERE c.id = cotacao_precos.cotacao_id AND om.user_id = auth.uid()
    )
  );
