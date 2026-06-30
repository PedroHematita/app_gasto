/** Taxonomia MTD — slugs estáveis no banco, labels na interface. */

export const MTD_STATUS_NAO_CLASSIFICADO = 'nao_classificado';
export const MTD_STATUS_PARCIALMENTE_CLASSIFICADO = 'parcialmente_classificado';
export const MTD_STATUS_CLASSIFICADO = 'classificado';

export const TIPO_GASTO_EMPRESARIAL = 'Empresarial';

export const DIRECIONAMENTO_MTD_OPCOES = [
  {
    slug: 'CP',
    label: 'Departamento Operacional (CP)',
    descricao: 'Custo de Produção / Custo Operacional',
  },
  {
    slug: 'DC',
    label: 'Departamento Comercial (DC)',
    descricao: 'Despesa Comercial',
  },
  {
    slug: 'DS',
    label: 'Departamento de Serviços (DS)',
    descricao: 'Despesa Estrutural',
  },
] as const;

export type DirecionamentoMtd = (typeof DIRECIONAMENTO_MTD_OPCOES)[number]['slug'];

export const CLASSIFICACAO_GERAL_MTD_OPCOES = [
  { slug: 'compra_material', label: 'Compra de Material' },
  { slug: 'servico', label: 'Serviço' },
  { slug: 'compra_material_servico', label: 'Compra de Material e Serviço' },
  { slug: 'mao_obra', label: 'Mão de Obra' },
] as const;

/** Slug legado — não aparece na UI; mantido só para exibição de registros antigos. */
export const CLASSIFICACAO_GERAL_MTD_SLUG_LEGADO_GASTO = 'gasto';

export type ClassificacaoGeralMtd = (typeof CLASSIFICACAO_GERAL_MTD_OPCOES)[number]['slug'];

export const NATUREZA_MTD_RAIZ_OPCOES = [
  { slug: 'material', label: 'Material' },
  { slug: 'mao_obra', label: 'Mão de Obra' },
  { slug: 'servico', label: 'Serviço' },
] as const;

export type NaturezaMtdRaiz = (typeof NATUREZA_MTD_RAIZ_OPCOES)[number]['slug'];

export interface MtdTreeNode {
  slug: string;
  label: string;
  filhos?: MtdTreeNode[];
}

export const NATUREZA_MTD_ARVORE: MtdTreeNode[] = [
  {
    slug: 'material',
    label: 'Material',
    filhos: [
      { slug: 'material_consumo', label: 'Material de Consumo' },
      { slug: 'material_revenda', label: 'Material de Revenda' },
      {
        slug: 'material_permanente',
        label: 'Material Permanente',
        filhos: [
          {
            slug: 'ativo_capital_capex',
            label: 'Ativo de Capital (CAPEX)',
            filhos: [
              { slug: 'terreno', label: 'Terreno' },
              { slug: 'edificacao', label: 'Edificação' },
              { slug: 'equipamento', label: 'Equipamento' },
            ],
          },
          { slug: 'ativo_capital_biologico', label: 'Ativo de Capital Biológico' },
          { slug: 'bens_duraveis', label: 'Bens Duráveis' },
        ],
      },
    ],
  },
  {
    slug: 'mao_obra',
    label: 'Mão de Obra',
    filhos: [
      { slug: 'mao_obra_direta', label: 'Mão de Obra Direta' },
      { slug: 'mao_obra_operacional_indireta', label: 'Mão de Obra Operacional Indireta' },
      { slug: 'mao_obra_tecnica', label: 'Mão de Obra Técnica' },
      { slug: 'mao_obra_comercial', label: 'Mão de Obra Comercial' },
      { slug: 'mao_obra_administrativa', label: 'Mão de Obra Administrativa' },
      {
        slug: 'encargos_obrigacoes_mao_obra',
        label: 'Encargos e Obrigações de Mão de Obra',
      },
    ],
  },
  {
    slug: 'servico',
    label: 'Serviço',
    filhos: [
      { slug: 'servicos_basicos_producao', label: 'Serviços Básicos à Produção' },
      {
        slug: 'servicos_regulatorios_indispensaveis',
        label: 'Serviços Regulatórios Indispensáveis',
      },
      { slug: 'servicos_geracao_valor', label: 'Serviços de Geração de Valor' },
      { slug: 'servicos_humanos_indiretos', label: 'Serviços Humanos Indiretos' },
    ],
  },
];

const slugLabelMap = new Map<string, string>();

function indexTree(nodes: MtdTreeNode[]) {
  for (const node of nodes) {
    slugLabelMap.set(node.slug, node.label);
    if (node.filhos) indexTree(node.filhos);
  }
}

for (const o of DIRECIONAMENTO_MTD_OPCOES) slugLabelMap.set(o.slug, o.label);
for (const o of CLASSIFICACAO_GERAL_MTD_OPCOES) slugLabelMap.set(o.slug, o.label);
slugLabelMap.set(CLASSIFICACAO_GERAL_MTD_SLUG_LEGADO_GASTO, 'Gasto');
indexTree(NATUREZA_MTD_ARVORE);

export function mtdSlugParaLabel(slug: string): string {
  return slugLabelMap.get(slug) ?? slug;
}

export function mtdCaminhoParaLabels(caminho: string[]): string[] {
  return caminho.map(mtdSlugParaLabel);
}

export function mtdCaminhoExibicao(caminho: string[] | null | undefined): string {
  if (!caminho?.length) return '';
  return mtdCaminhoParaLabels(caminho).join(' → ');
}

export function direcionamentoMtdLabel(slug: string | null | undefined): string {
  if (!slug) return '';
  return mtdSlugParaLabel(slug);
}

export function classificacaoGeralMtdLabel(slug: string | null | undefined): string {
  if (!slug) return '';
  return mtdSlugParaLabel(slug);
}

function findNode(nodes: MtdTreeNode[], slug: string): MtdTreeNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    if (node.filhos) {
      const found = findNode(node.filhos, slug);
      if (found) return found;
    }
  }
  return null;
}

export function naturezaMtdArvorePorRaiz(raiz: NaturezaMtdRaiz): MtdTreeNode | null {
  return findNode(NATUREZA_MTD_ARVORE, raiz);
}

/** Caminho válido: começa pela raiz, cada slug existe como filho do anterior, termina em folha ou nó intermediário. */
export function caminhoNaturezaMtdValido(caminho: string[]): boolean {
  if (caminho.length === 0) return false;
  const raiz = caminho[0];
  if (!NATUREZA_MTD_RAIZ_OPCOES.some((o) => o.slug === raiz)) return false;
  let nodes = NATUREZA_MTD_ARVORE;
  for (let i = 0; i < caminho.length; i++) {
    const node = findNode(nodes, caminho[i]);
    if (!node) return false;
    if (i < caminho.length - 1) {
      if (!node.filhos?.length) return false;
      nodes = node.filhos;
    }
  }
  return true;
}

export function raizFromCaminho(caminho: string[]): NaturezaMtdRaiz | null {
  const r = caminho[0];
  if (NATUREZA_MTD_RAIZ_OPCOES.some((o) => o.slug === r)) return r as NaturezaMtdRaiz;
  return null;
}

export function isDirecionamentoMtdValido(slug: string): slug is DirecionamentoMtd {
  return DIRECIONAMENTO_MTD_OPCOES.some((o) => o.slug === slug);
}

export function isClassificacaoGeralMtdValida(slug: string): slug is ClassificacaoGeralMtd {
  return CLASSIFICACAO_GERAL_MTD_OPCOES.some((o) => o.slug === slug);
}

/** Raiz sugerida a partir da classificação geral (v1). Caso misto exige escolha manual. */
export function raizMtdSugeridaPorClassificacaoGeral(
  slug: string | null | undefined
): NaturezaMtdRaiz | null {
  switch (slug) {
    case 'compra_material':
      return 'material';
    case 'servico':
      return 'servico';
    case 'mao_obra':
      return 'mao_obra';
    default:
      return null;
  }
}

/** Alerta quando classificação geral e raiz parecem incoerentes (não bloqueia). */
export function avisoCoerenciaMtdClassificacaoNatureza(
  classificacaoGeral: string | null | undefined,
  raiz: NaturezaMtdRaiz | null | undefined
): string | null {
  if (!classificacaoGeral || !raiz) return null;
  if (classificacaoGeral === 'compra_material_servico') return null;
  const sugerida = raizMtdSugeridaPorClassificacaoGeral(classificacaoGeral);
  if (!sugerida || sugerida === raiz) return null;
  return `A classificação "${classificacaoGeralMtdLabel(classificacaoGeral)}" costuma combinar com "${mtdSlugParaLabel(sugerida)}". Confirme se a raiz escolhida está correta.`;
}

export interface GastoMtdPayload {
  direcionamentoMtd: DirecionamentoMtd;
  classificacaoGeralMtd: ClassificacaoGeralMtd;
  naturezaMtdRaiz: NaturezaMtdRaiz;
  naturezaMtdCaminho: string[];
}

export function mtdPayloadEstaCompleto(payload: Partial<GastoMtdPayload>): payload is GastoMtdPayload {
  if (!payload.direcionamentoMtd || !isDirecionamentoMtdValido(payload.direcionamentoMtd)) {
    return false;
  }
  if (!payload.classificacaoGeralMtd || !isClassificacaoGeralMtdValida(payload.classificacaoGeralMtd)) {
    return false;
  }
  if (!payload.naturezaMtdCaminho?.length) return false;
  if (!caminhoNaturezaMtdValido(payload.naturezaMtdCaminho)) return false;
  const raiz = raizFromCaminho(payload.naturezaMtdCaminho);
  if (!raiz) return false;
  if (payload.naturezaMtdRaiz && payload.naturezaMtdRaiz !== raiz) return false;
  return true;
}

export function computarMtdStatus(payload: Partial<GastoMtdPayload>): typeof MTD_STATUS_NAO_CLASSIFICADO | typeof MTD_STATUS_CLASSIFICADO {
  return mtdPayloadEstaCompleto(payload) ? MTD_STATUS_CLASSIFICADO : MTD_STATUS_NAO_CLASSIFICADO;
}

/** Folhas selecionáveis na árvore (caminho completo até o nó escolhido). */
export function listarCaminhosNaturezaSelecionaveis(raiz: NaturezaMtdRaiz): string[][] {
  const node = naturezaMtdArvorePorRaiz(raiz);
  if (!node) return [];

  const paths: string[][] = [];

  function walk(n: MtdTreeNode, prefix: string[]) {
    const path = [...prefix, n.slug];
    if (!n.filhos?.length) {
      paths.push(path);
      return;
    }
    for (const child of n.filhos) walk(child, path);
  }

  walk(node, []);
  return paths;
}
