const FOCUS_SCROLL_DELAY_MS = 80;

/** Mobile / touch: evita scroll agressivo em desktop com mouse. */
export function isMobileLikeViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768
  );
}

function keyboardAvoidanceActive(): boolean {
  const root = document.documentElement;
  if (root.classList.contains('keyboard-open')) return true;
  const inset =
    parseFloat(getComputedStyle(root).getPropertyValue('--keyboard-inset')) || 0;
  return inset > 0;
}

/**
 * Rola o campo para a área visível quando o teclado está aberto (cadastro principal).
 * Usa `nearest` para não “pular” a tela; só em viewport mobile-like.
 */
export function scheduleScrollFieldIntoView(element: HTMLElement | null): void {
  if (!element || typeof window === 'undefined') return;
  if (!isMobileLikeViewport()) return;

  const run = () => {
    if (!keyboardAvoidanceActive()) return;
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  window.setTimeout(run, FOCUS_SCROLL_DELAY_MS);
  window.setTimeout(run, 200);
}
