import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FiltroColunaLancamentoProps {
  rotulo: string;
  opcoes: readonly string[];
  selecionadas: readonly string[];
  onAlternar: (opcao: string) => void;
}

export function FiltroColunaLancamento({
  rotulo,
  opcoes,
  selecionadas,
  onAlternar,
}: FiltroColunaLancamentoProps) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const ativo = selecionadas.length > 0;

  useEffect(() => {
    if (!aberto) return;
    function posicionar() {
      const rect = botaoRef.current?.getBoundingClientRect();
      if (!rect) return;
      const largura = 220;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8));
      setPosicao({ top: rect.bottom + 4, left });
    }
    posicionar();
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    return () => {
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function fecharAoClicarFora(event: MouseEvent) {
      const alvo = event.target as Node;
      if (botaoRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    function fecharComEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setAberto(false);
      botaoRef.current?.focus();
    }
    document.addEventListener('mousedown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEscape);
    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEscape);
    };
  }, [aberto]);

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        className={ativo ? 'visao-lancamentos__titulo visao-lancamentos__titulo--ativo' : 'visao-lancamentos__titulo'}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-pressed={ativo}
        onClick={() => setAberto((atual) => !atual)}
      >
        {rotulo}
      </button>
      {aberto
        ? createPortal(
            <div
              ref={painelRef}
              className="visao-filtro"
              role="dialog"
              aria-label={`Filtrar ${rotulo}`}
              style={{ top: posicao.top, left: posicao.left }}
            >
              {opcoes.length === 0 ? (
                <p>Nenhuma opção neste mês.</p>
              ) : (
                opcoes.map((opcao) => {
                  const id = `${baseId}-${opcao}`;
                  const marcada = selecionadas.includes(opcao);
                  return (
                    <label key={opcao} htmlFor={id}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={marcada}
                        onChange={() => onAlternar(opcao)}
                      />
                      <span>{opcao === '—' ? 'Indisponível' : opcao}</span>
                    </label>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
