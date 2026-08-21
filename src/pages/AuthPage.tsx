import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import dhMonogram from '@/assets/dh-monogram.png';
import { getAndClearIntendedDestination } from '@/lib/share';
import { lovable } from '@/integrations/lovable';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    const redirect = getAndClearIntendedDestination();
    return <Navigate to={redirect || '/dashboard'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const redirect = getAndClearIntendedDestination();
        navigate(redirect || '/dashboard');
        return;
      }

      // mode === 'signup' — create the account only. New members don't pick a
      // club: there is exactly one, and access is granted by admin approval.
      // After signup the app funnels them to /club/request to ask for access.
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (signUpData.session) {
        navigate('/club/request', { replace: true });
      } else {
        toast.success('Account created! Verify your email, then sign in to request access.');
        setMode('signin');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
    >
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(152, 72%, 46%, 0.06), transparent)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-6">
          <motion.img
            src={dhMonogram}
            alt="DH"
            className="w-20 h-20 object-contain mx-auto mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring', damping: 18 }}
            style={{ filter: 'drop-shadow(0 0 16px hsl(var(--primary) / 0.2))' }}
          />
          <p className="text-xs text-muted-foreground font-semibold">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="form-label">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="form-input"
                />
              </div>
              <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-relaxed">
                Create your account, then request access. An admin approves each new
                member before they can enter.
              </p>
            </>
          )}

          <div>
            <label className="form-label">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          <Button type="submit" className="w-full h-11 font-bold rounded-xl btn-press" disabled={loading}>
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {mode === 'signin' && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">or</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 font-semibold rounded-xl btn-press gap-2"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const result = await lovable.auth.signInWithOAuth('google', {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) throw result.error;
                  if (result.redirected) return;
                  const redirect = getAndClearIntendedDestination();
                  navigate(redirect || '/dashboard');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
                  setLoading(false);
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5L18.6 5C16.9 3.4 14.6 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12s4.2 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"/>
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 font-semibold rounded-xl btn-press gap-2 mt-2"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const result = await lovable.auth.signInWithOAuth('apple', {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) throw result.error;
                  if (result.redirected) return;
                  const redirect = getAndClearIntendedDestination();
                  navigate(redirect || '/dashboard');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Apple sign-in failed');
                  setLoading(false);
                }
              }}
            >
              <svg width="16" height="18" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256.6 105.5c30.3-36 27.6-68.8 26.7-80.5-26.8 1.6-57.8 18.3-75.5 38.8-19.5 22-31 49.2-28.5 79.9 29 2.2 55.4-12.7 77.3-38.2z"/>
              </svg>
              Continue with Apple
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 font-semibold rounded-xl btn-press gap-2 mt-2"
              disabled={loading}
              onClick={async () => {
                if (!email) {
                  toast.error('Enter your email above first');
                  return;
                }
                setLoading(true);
                try {
                  const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                      emailRedirectTo: window.location.origin,
                      shouldCreateUser: false,
                    },
                  });
                  if (error) throw error;
                  toast.success('Sign-in link sent! Check your email.');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Could not send sign-in link');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Mail className="w-4 h-4" />
              Email me a sign-in link
            </Button>
          </>
        )}

        {mode === 'signin' && (
          <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
            <button
              onClick={async () => {
                if (!email) {
                  toast.error('Enter your email first');
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success('Password reset link sent! Check your email.');
              }}
              className="text-primary/85 hover:text-primary hover:underline font-semibold transition-colors"
            >
              Forgot password?
            </button>
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground mt-5">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button onClick={() => setMode('signup')} className="text-primary hover:underline font-bold">
                Create an account
              </button>
              .
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="text-primary hover:underline font-bold">
                Sign In
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
