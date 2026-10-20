import { PlusCircle, List, Scale, Tags, BarChart3 } from 'lucide-react';
import type { Screen } from '../types';

interface BottomNavProps {
  active: 'main' | 'meus_gastos' | 'cotacoes' | 'classificar_gastos' | 'visao_financeira';
  onNavigate: (screen: Screen) => void;
  wide?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate, wide = false }) => {
  return (
    <nav className={wide ? 'bottom-nav bottom-nav--wide' : 'bottom-nav'}>
      <button
        className={`bottom-nav__item ${active === 'main' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('main')}
        type="button"
        aria-current={active === 'main' ? 'page' : undefined}
      >
        <PlusCircle size={20} aria-hidden />
        <span>Novo Gasto</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'meus_gastos' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('meus_gastos')}
        type="button"
        aria-current={active === 'meus_gastos' ? 'page' : undefined}
      >
        <List size={20} aria-hidden />
        <span>Meus Gastos</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'classificar_gastos' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('classificar_gastos')}
        type="button"
        aria-current={active === 'classificar_gastos' ? 'page' : undefined}
      >
        <Tags size={20} aria-hidden />
        <span>Classificar</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'cotacoes' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('cotacoes')}
        type="button"
        aria-current={active === 'cotacoes' ? 'page' : undefined}
      >
        <Scale size={20} aria-hidden />
        <span>Cotações</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'visao_financeira' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('visao_financeira')}
        type="button"
        aria-current={active === 'visao_financeira' ? 'page' : undefined}
      >
        <BarChart3 size={20} aria-hidden />
        <span>Visão</span>
      </button>
    </nav>
  );
};
