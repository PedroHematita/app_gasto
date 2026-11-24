import {
  FORNECEDOR_REQUIRED_MSG,
  isDataPagamentoQuitacaoValida,
  normalizeDescricao,
  parseDateBR,
} from '../../utils';
import {
  classificarItemLinha,
  itemLinhaCompleta,
  itemLinhaVazia,
  ordenarGastosNaTela,
  parseQuantidadeItem,
  totalGastoCentavos,
  type GastoRascunhoLote,
  type ItemRascunhoLote,
} from './modelo';
import { conflitosUnidadeLote, listarItensOrdemCriacao } from './unidadeTrava';

export type CampoErroLote =
  | 'data'
  | 'fornecedor'
  | 'parcelas'
  | 'descricao'
  | 'quantidade'
  | 'valor'
  | 'unidade'
  | 'itens'
  | 'pagamento';

export interface ErroCampoLote {
  gastoId: string;
  itemId?: string;
  campo: CampoErroLote;
  mensagem: string;
  /** Posição 1-based na ordem de envio (Gasto N). */
  posicaoGasto: number;
}

export type TipoAvisoLote =
  | 'possivel_duplicidade'
  | 'item_duplicado'
  | 'lote_grande'
  | 'preco_fora_media';

export interface AvisoLote {
  tipo: TipoAvisoLote;
  gastoId: string;
  itemId?: string;
  mensagem: string;
  posicaoGasto: number;
}

export interface ResultadoValidacaoLote {
  ok: boolean;
  erros: ErroCampoLote[];
  avisos: AvisoLote[];
  /** gastoId → posição 1-based. */
  posicaoPorGastoId: Record<string, number>;
}

/** Acima disso só avisa (não bloqueia). */
export const AVISO_LOTE_GRANDE_GASTOS = 40;

function validarItem(
  item: ItemRascunhoLote,
  gastoId: string,
  posicaoGasto: number,
  erros: ErroCampoLote[]
): void {
  const desc = item.descricao.trim().replace(/\s+/g, ' ');
  if (desc.length < 3) {
    erros.push({
      gastoId,
      itemId: item.id,
      campo: 'descricao',
      mensagem: 'A descrição do item é muito curta.',
      posicaoGasto,
    });
  }

  const qtd = parseQuantidadeItem(item.quantidade);
  if (qtd === null || qtd <= 0) {
    erros.push({
      gastoId,
      itemId: item.id,
      campo: 'quantidade',
      mensagem: 'A quantidade informada é inválida.',
      posicaoGasto,
    });
  }

  if (!item.unidade.trim()) {
    erros.push({
      gastoId,
      itemId: item.id,
      campo: 'unidade',
      mensagem: 'Informe a unidade de medida.',
      posicaoGasto,
    });
  }

  if (item.valorCentavos === null) {
    erros.push({
      gastoId,
      itemId: item.id,
      campo: 'valor',
      mensagem: 'Informe o valor total do item.',
      posicaoGasto,
    });
  } else if (item.valorCentavos <= 0) {
    erros.push({
      gastoId,
      itemId: item.id,
      campo: 'valor',
      mensagem: 'O valor do item não pode ser zero.',
      posicaoGasto,
    });
  }
}

/**
 * Matriz aplicada (cliente):
 * BLOQUEAR — data inválida/futura; data herdada pendente; fornecedor vazio;
 *   parcelas 2–48; gasto sem item completo; linha incompleta; descrição curta;
 *   qtd ≤0; unidade vazia; valor null/≤0; total do gasto ≤0; conflito/falha de
 *   unidade; lote sem gastos. Linhas vazias devem ser removidas antes de chamar.
 * AVISAR — possível duplicidade de gasto (data+fornecedor+total);
 *   item duplicado no mesmo gasto (mesma descrição normalizada);
 *   lote grande (≥40 gastos);
 *   preço unitário fora da média histórica (±10%) — anexado no salvar via
 *   precoHistoricoLote (não bloqueia).
 * IGNORAR (por enquanto) — fornecedor novo; quase-duplicata fuzzy; meio/instituição
 *   (já vêm com padrão do formulário).
 */
export function validarLote(
  gastos: GastoRascunhoLote[],
  hoje: Date = new Date(),
  unidadeBancoPorNorm: ReadonlyMap<string, string | null | undefined> = new Map(),
  normComFalhaConsulta: ReadonlySet<string> = new Set()
): ResultadoValidacaoLote {
  const ordenados = ordenarGastosNaTela(gastos);
  const erros: ErroCampoLote[] = [];
  const avisos: AvisoLote[] = [];
  const posicaoPorGastoId: Record<string, number> = {};

  if (ordenados.length === 0) {
    return {
      ok: false,
      erros: [
        {
          gastoId: '',
          campo: 'itens',
          mensagem: 'O lote precisa ter ao menos um gasto.',
          posicaoGasto: 0,
        },
      ],
      avisos: [],
      posicaoPorGastoId: {},
    };
  }

  if (ordenados.length >= AVISO_LOTE_GRANDE_GASTOS) {
    avisos.push({
      tipo: 'lote_grande',
      gastoId: ordenados[0].id,
      mensagem: `Lote grande (${ordenados.length} gastos). Confira antes de salvar.`,
      posicaoGasto: 1,
    });
  }

  ordenados.forEach((gasto, idx) => {
    const posicaoGasto = idx + 1;
    posicaoPorGastoId[gasto.id] = posicaoGasto;

    if (gasto.dataHerdadaPendente) {
      erros.push({
        gastoId: gasto.id,
        campo: 'data',
        mensagem: 'Confirme a data herdada antes de salvar.',
        posicaoGasto,
      });
    }

    if (!isDataPagamentoQuitacaoValida(gasto.dataCompraBR, hoje)) {
      erros.push({
        gastoId: gasto.id,
        campo: 'data',
        mensagem: 'Informe a data da compra. Ela não pode ser futura.',
        posicaoGasto,
      });
    } else if (!parseDateBR(gasto.dataCompraBR)) {
      erros.push({
        gastoId: gasto.id,
        campo: 'data',
        mensagem: 'Informe a data da compra. Ela não pode ser futura.',
        posicaoGasto,
      });
    }

    if (!gasto.fornecedor.trim()) {
      erros.push({
        gastoId: gasto.id,
        campo: 'fornecedor',
        mensagem: FORNECEDOR_REQUIRED_MSG,
        posicaoGasto,
      });
    }

    if (!gasto.pagamento.meioPagamento.trim() || !gasto.pagamento.instituicaoFinanceira.trim()) {
      erros.push({
        gastoId: gasto.id,
        campo: 'pagamento',
        mensagem: 'Informe meio de pagamento e instituição financeira.',
        posicaoGasto,
      });
    }

    if (gasto.pagamento.formaPagamento === 'parcelado') {
      const p = gasto.pagamento.parcelas;
      if (p < 2 || p > 48) {
        erros.push({
          gastoId: gasto.id,
          campo: 'parcelas',
          mensagem: 'A quantidade de parcelas deve estar entre 2 e 48.',
          posicaoGasto,
        });
      }
    }

    const itensNaoVazios = gasto.itens.filter((item) => !itemLinhaVazia(item));
    const itensCompletos = itensNaoVazios.filter(itemLinhaCompleta);
    const itensIncompletos = itensNaoVazios.filter(
      (item) => classificarItemLinha(item) === 'incompleta'
    );

    for (const item of itensIncompletos) {
      validarItem(item, gasto.id, posicaoGasto, erros);
    }

    if (itensCompletos.length === 0) {
      erros.push({
        gastoId: gasto.id,
        campo: 'itens',
        mensagem: 'Adicione pelo menos um item',
        posicaoGasto,
      });
    } else {
      if (totalGastoCentavos(gasto) <= 0) {
        erros.push({
          gastoId: gasto.id,
          campo: 'valor',
          mensagem: 'O total do gasto não pode ser zero.',
          posicaoGasto,
        });
      }

      const vistosDesc = new Map<string, string>();
      for (const item of itensCompletos) {
        const norm = normalizeDescricao(item.descricao);
        if (norm.length < 2) continue;
        const anteriorId = vistosDesc.get(norm);
        if (anteriorId) {
          avisos.push({
            tipo: 'item_duplicado',
            gastoId: gasto.id,
            itemId: item.id,
            mensagem: 'Há itens com a mesma descrição neste gasto.',
            posicaoGasto,
          });
        } else {
          vistosDesc.set(norm, item.id);
        }
      }
    }
  });

  const gastosComItensCompletos = gastos.map((g) => ({
    ...g,
    itens: g.itens.filter((item) => itemLinhaCompleta(item)),
  }));
  const itensOrdem = listarItensOrdemCriacao(gastosComItensCompletos);

  for (const item of itensOrdem) {
    const norm = normalizeDescricao(item.descricao);
    if (norm.length >= 2 && normComFalhaConsulta.has(norm)) {
      erros.push({
        gastoId: item.gastoId,
        itemId: item.itemId,
        campo: 'unidade',
        mensagem: 'Não foi possível consultar a unidade desta descrição. Tente de novo.',
        posicaoGasto: posicaoPorGastoId[item.gastoId] ?? 0,
      });
    }
  }

  for (const c of conflitosUnidadeLote(itensOrdem, unidadeBancoPorNorm, normComFalhaConsulta)) {
    erros.push({
      gastoId: c.gastoId,
      itemId: c.itemId,
      campo: 'unidade',
      mensagem: c.mensagem,
      posicaoGasto: posicaoPorGastoId[c.gastoId] ?? 0,
    });
  }

  const vistos = new Map<string, { gastoId: string; posicao: number }>();
  for (const gasto of ordenados) {
    const chave = [
      gasto.dataCompraBR,
      gasto.fornecedor.trim().toLowerCase(),
      String(totalGastoCentavos(gasto)),
    ].join('|');
    const anterior = vistos.get(chave);
    const posicao = posicaoPorGastoId[gasto.id];
    if (anterior && gasto.fornecedor.trim()) {
      avisos.push({
        tipo: 'possivel_duplicidade',
        gastoId: gasto.id,
        mensagem: `Possível duplicidade com o gasto ${anterior.posicao} (mesma data, fornecedor e total).`,
        posicaoGasto: posicao,
      });
    } else {
      vistos.set(chave, { gastoId: gasto.id, posicao });
    }
  }

  return {
    ok: erros.length === 0,
    erros,
    avisos,
    posicaoPorGastoId,
  };
}

export function resumoValidacao(resultado: ResultadoValidacaoLote): string[] {
  return [
    ...resultado.erros.map((e) =>
      e.posicaoGasto > 0 ? `Gasto ${e.posicaoGasto}: ${e.mensagem}` : e.mensagem
    ),
    ...resultado.avisos.map((a) => `Gasto ${a.posicaoGasto}: ${a.mensagem}`),
  ];
}
