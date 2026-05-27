import { useEffect } from 'react';

export const KEYBOARD_OPEN_CLASS = 'keyboard-open';
export const CSS_VAR_KEYBOARD_INSET = '--keyboard-inset';
export const CSS_VAR_VISUAL_VH = '--visual-vh';

/** Espaço ocupado pelo teclado (px), com base no Visual Viewport API. */
export function computeKeyboardInset(): number {
  if (typeof window === 'undefined') return 0;

  const vv = window.visualViewport;
  if (!vv) return 0;

  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function getVisualVhCSSValue(): string {
  if (typeof window === 'undefined') return '100vh';

  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  return `${Math.round(height)}px`;
}

function applyKeyboardInsetToDocument(): void {
  const root = document.documentElement;
  const inset = computeKeyboardInset();

  root.style.setProperty(CSS_VAR_KEYBOARD_INSET, `${inset}px`);
  root.style.setProperty(CSS_VAR_VISUAL_VH, getVisualVhCSSValue());

  if (inset > 0) {
    root.classList.add(KEYBOARD_OPEN_CLASS);
  } else {
    root.classList.remove(KEYBOARD_OPEN_CLASS);
  }
}

function clearKeyboardInsetFromDocument(): void {
  const root = document.documentElement;
  root.style.removeProperty(CSS_VAR_KEYBOARD_INSET);
  root.style.removeProperty(CSS_VAR_VISUAL_VH);
  root.classList.remove(KEYBOARD_OPEN_CLASS);
}

/**
 * Infra global de keyboard avoidance (Etapa 1).
 * Atualiza `--keyboard-inset`, `--visual-vh` e a classe `keyboard-open` no `<html>`.
 * Classificar, PaymentModal, modal-sheet--form, cadastro e login usam o inset; BottomNav não sobe.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    applyKeyboardInsetToDocument();

    const vv = window.visualViewport;

    if (vv) {
      vv.addEventListener('resize', applyKeyboardInsetToDocument);
      vv.addEventListener('scroll', applyKeyboardInsetToDocument);
    }

    window.addEventListener('resize', applyKeyboardInsetToDocument);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', applyKeyboardInsetToDocument);
        vv.removeEventListener('scroll', applyKeyboardInsetToDocument);
      }
      window.removeEventListener('resize', applyKeyboardInsetToDocument);
      clearKeyboardInsetFromDocument();
    };
  }, []);
}
