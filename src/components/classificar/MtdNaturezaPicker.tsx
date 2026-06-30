import React, { useMemo } from 'react';
import type { NaturezaMtdRaiz } from '../../lib/mtdTaxonomia';
import {
  NATUREZA_MTD_RAIZ_OPCOES,
  avisoCoerenciaMtdClassificacaoNatureza,
  listarCaminhosNaturezaSelecionaveis,
  mtdCaminhoExibicao,
  raizFromCaminho,
  raizMtdSugeridaPorClassificacaoGeral,
} from '../../lib/mtdTaxonomia';

interface MtdNaturezaPickerProps {
  classificacaoGeral: string;
  caminho: string[];
  onSelect: (caminho: string[]) => void;
}

function caminhoCompletoSelecionado(caminho: string[]): boolean {
  if (caminho.length < 2) return false;
  const raiz = raizFromCaminho(caminho);
  if (!raiz) return false;
  const paths = listarCaminhosNaturezaSelecionaveis(raiz);
  const key = caminho.join('/');
  return paths.some((p) => p.join('/') === key);
}

export const MtdNaturezaPicker: React.FC<MtdNaturezaPickerProps> = ({
  classificacaoGeral,
  caminho,
  onSelect,
}) => {
  const raizSugerida = raizMtdSugeridaPorClassificacaoGeral(classificacaoGeral);
  const raizSelecionada = raizFromCaminho(caminho) ?? raizSugerida ?? '';

  const caminhosDisponiveis = useMemo(() => {
    if (!raizSelecionada) return [];
    return listarCaminhosNaturezaSelecionaveis(raizSelecionada);
  }, [raizSelecionada]);

  const avisoCoerencia = avisoCoerenciaMtdClassificacaoNatureza(
    classificacaoGeral,
    raizSelecionada || null
  );

  const handleRaiz = (r: NaturezaMtdRaiz) => {
    onSelect([r]);
  };

  const caminhoKey = (path: string[]) => path.join('/');

  const caminhoValido = caminhoCompletoSelecionado(caminho);

  return (
    <div className="mtd-natureza-picker">
      <p className="mtd-natureza-picker__section-label">Raiz</p>
      {classificacaoGeral === 'compra_material_servico' && (
        <p className="mtd-natureza-picker__hint">
          Classificação mista — escolha a raiz que melhor descreve este gasto.
        </p>
      )}
      {raizSugerida && classificacaoGeral !== 'compra_material_servico' && (
        <p className="mtd-natureza-picker__hint">
          Sugerido com base na classificação geral:{' '}
          <strong>{NATUREZA_MTD_RAIZ_OPCOES.find((o) => o.slug === raizSugerida)?.label}</strong>
        </p>
      )}

      <div className="mtd-natureza-picker__raiz" role="group" aria-label="Raiz da natureza">
        {NATUREZA_MTD_RAIZ_OPCOES.map((o) => (
          <button
            key={o.slug}
            type="button"
            className={`classificar-mtd-sheet__chip ${raizSelecionada === o.slug ? 'classificar-mtd-sheet__chip--selected' : ''}`}
            onClick={() => handleRaiz(o.slug)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {avisoCoerencia && (
        <p className="mtd-natureza-picker__aviso" role="status">
          {avisoCoerencia}
        </p>
      )}

      {raizSelecionada && caminhosDisponiveis.length > 0 && (
        <div className="mtd-natureza-picker__nivel">
          <p className="mtd-natureza-picker__section-label">Caminho</p>
          <div className="mtd-natureza-picker__lista">
            {caminhosDisponiveis.map((path) => {
              const selected = caminhoKey(caminho) === caminhoKey(path);
              return (
                <button
                  key={caminhoKey(path)}
                  type="button"
                  className={`classificar-mtd-sheet__opcao ${selected ? 'classificar-mtd-sheet__opcao--selected' : ''}`}
                  onClick={() => onSelect(path)}
                >
                  <span className="classificar-mtd-sheet__opcao-title">{mtdCaminhoExibicao(path)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {caminhoValido ? (
        <p className="mtd-natureza-picker__preview">
          Selecionado: <strong>{mtdCaminhoExibicao(caminho)}</strong>
        </p>
      ) : raizSelecionada ? (
        <p className="mtd-natureza-picker__preview mtd-natureza-picker__preview--muted">
          Escolha um caminho completo na lista acima.
        </p>
      ) : null}
    </div>
  );
};
