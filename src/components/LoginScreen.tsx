import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { FloatingInput } from './FloatingInput';
import { supabase } from '../lib/supabase';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !senha) {
      setError('Preencha email e senha');
      return;
    }
    if (!supabase) {
      setError('Supabase não configurado');
      return;
    }

    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setLoading(false);

    if (authError) {
      setError('Email ou senha incorretos');
    } else {
      onLogin();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-dark)', border: '1.5px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <LogIn size={24} color="var(--accent)" />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Sistema Madrigal Mineira
        </h1>
      </div>

      <div onKeyDown={handleKeyDown}>
        <FloatingInput
          id="input-email"
          name="username"
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          bgVariant="main"
          autoComplete="email"
          autoCorrect="on"
          spellCheck
        />
        <FloatingInput
          id="input-senha"
          name="password"
          label="Senha"
          value={senha}
          onChange={setSenha}
          type="password"
          bgVariant="main"
          autoComplete="current-password"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {error && (
        <p style={{
          fontSize: 11, color: '#ff6666', textAlign: 'center',
          marginBottom: 12, marginTop: -4,
        }}>
          {error}
        </p>
      )}

      <button
        className="btn-save-main"
        onClick={handleLogin}
        disabled={loading}
        style={{ margin: '0', width: '100%' }}
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </div>
  );
};
