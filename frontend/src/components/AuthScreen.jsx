import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, Shield, Zap } from 'lucide-react';
import { 
  auth, 
  isFirebaseConfigured, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from '../firebase';

export default function AuthScreen({ onMockLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!isFirebaseConfigured) {
        onMockLogin({ uid: 'dev_user_uid', email: email || 'dev@mockstream.dev' });
        return;
      }

      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        onMockLogin({ uid: 'dev_user_uid', email: 'google.dev@mockstream.dev' });
        return;
      }
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleMockBypass = () => {
    onMockLogin({ uid: 'dev_user_uid', email: 'dev@mockstream.dev' });
  };

  return (
    <div className="auth-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      zIndex: 1,
      background: 'radial-gradient(circle at top, rgba(99, 102, 241, 0.15), transparent), #06060f'
    }}>
      {/* Background Orbs */}
      <div className="orb" style={{
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15), transparent 70%)',
        position: 'absolute',
        top: '10%',
        left: '20%',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }}></div>
      
      <div className="glass auth-card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px 32px',
        borderRadius: '24px',
        border: '1px solid var(--glass-border)',
        background: 'rgba(10, 10, 26, 0.75)',
        backdropFilter: 'blur(32px)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 1px rgba(99, 102, 241, 0.2)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--indigo), var(--violet))',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
            color: '#fff',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px'
          }}>
            ⚡
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>MockStream Auth</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Real-time webhook inspection gateway
          </p>
        </div>

        {/* Warning Badge for developer mock mode */}
        {!isFirebaseConfigured && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            color: '#fcd34d',
            fontSize: '11px',
            lineHeight: '1.45',
            marginBottom: '20px',
            display: 'flex',
            gap: '8px'
          }}>
            <Zap size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Developer Sandbox Mode:</strong> Firebase credentials are not set in your environment file. You can enter with any mock details.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '12px',
            color: '#fda4af',
            fontSize: '11.5px',
            marginBottom: '20px',
            fontFamily: 'var(--font-mono)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={12} className="code-blue" /> Email Address
            </label>
            <input
              type="email"
              className="form-input form-input-mono"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', height: '38px' }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} className="code-blue" /> Password
            </label>
            <input
              type="password"
              className="form-input form-input-mono"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', height: '38px' }}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', height: '40px', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner"></span>
            ) : isRegistering ? (
              <>
                <UserPlus size={16} /> Sign Up Account
              </>
            ) : (
              <>
                <LogIn size={16} /> Sign In Gateway
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>OR PROVIDERS</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={handleGoogleSignIn}
            className="btn-lg-ghost"
            style={{
              width: '100%',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '13px',
              borderRadius: '12px'
            }}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.67 0 3.17.58 4.35 1.7l3.25-3.25C17.64 1.7 15.02 1 12 1 7.37 1 3.4 3.65 1.5 7.5l3.86 3C6.27 7.72 8.9 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.5 12.25c0-.82-.07-1.6-.2-2.35H12v4.45h6.46c-.28 1.47-1.12 2.7-2.37 3.55l3.68 2.85c2.15-2 3.73-4.93 3.73-8.5z"/>
              <path fill="#FBBC05" d="M5.36 14.5c-.24-.72-.36-1.5-.36-2.5s.12-1.78.36-2.5L1.5 6.5C.54 8.43 0 10.64 0 13s.54 4.57 1.5 6.5l3.86-3z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.9l-3.68-2.85c-1.1.74-2.5 1.18-4.28 1.18-3.1 0-5.73-2.68-6.66-5.46L.48 15.93C2.38 19.8 6.35 22.5 12 23z"/>
            </svg>
            Sign In with Google
          </button>

          {!isFirebaseConfigured && (
            <button 
              onClick={handleMockBypass}
              className="btn-lg-ghost"
              style={{
                width: '100%',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                borderColor: 'rgba(16, 185, 129, 0.25)',
                color: 'var(--color-green)',
                borderRadius: '12px'
              }}
            >
              <Shield size={14} /> Bypass / Mock Sign In
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-purple)',
              fontSize: '12.5px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
