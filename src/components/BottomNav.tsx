import { PlusCircle, List, Scale } from 'lucide-react';
import type { Screen } from '../types';

interface BottomNavProps {
  active: 'main' | 'meus_gastos' | 'cotacoes';
  onNavigate: (screen: Screen) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate }) => {
  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav__item ${active === 'main' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('main')}
        type="button"
      >
        <PlusCircle size={20} />
        <span>Novo Gasto</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'meus_gastos' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('meus_gastos')}
        type="button"
      >
        <List size={20} />
        <span>Meus Gastos</span>
      </button>
      <button
        className={`bottom-nav__item ${active === 'cotacoes' ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onNavigate('cotacoes')}
        type="button"
      >
        <Scale size={20} />
        <span>Cotações</span>
      </button>
    </nav>
  );
};
