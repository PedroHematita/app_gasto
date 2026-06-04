import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LogoutButtonProps {
  onLogoutComplete?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({
  onLogoutComplete,
  style,
  className = '',
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      // Clear persistence
      localStorage.removeItem('app_gasto_last_org_id');
      localStorage.removeItem('app_gasto_draft');
      // Sign out
      await supabase?.auth.signOut();
      
      if (onLogoutComplete) {
        onLogoutComplete();
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        type="button"
        className={`logout-button ${className}`.trim()}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-inactive)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          ...style
        }}
        aria-label="Sair da aplicação"
      >
        <LogOut size={16} />
      </button>

      {showConfirm && (
        <div
          className="modal-overlay modal-finance modal-finance--z-elevated"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="modal-sheet bottom-sheet-finance modal-finance__container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sheet__handle modal-finance__handle" />
            <div className="modal-sheet__title modal-finance__title">Deseja sair da aplicação?</div>
            <div className="compromisso-cancel-confirm__body modal-finance__body">
              <p>Você será desconectado da sua conta atual.</p>
            </div>
            <div className="compromisso-cancel-confirm__actions modal-finance__actions modal-finance__footer">
              <button
                type="button"
                className="btn-compromisso-secondary"
                onClick={() => setShowConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-compromisso-secondary"
                style={{ color: 'var(--text-danger)' }}
                onClick={handleLogout}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
