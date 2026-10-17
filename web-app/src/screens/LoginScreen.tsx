import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { signInWithGoogle } from '../services/auth';
import { Church, ShieldCheck, Sun, Moon, Languages } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { language, setLanguage, theme, toggleTheme, translate } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async (useRedirect: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      if (useRedirect) {
        await signInWithGoogle({ useRedirect: true });
      } else {
        await login(false);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      let msg = err.message || 'Sign in failed. Please try again.';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in popup was closed before completing. If your browser blocks popups, use the redirect sign-in option below.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = `The domain (localhost) is not authorized in Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 transition-colors">
      {/* Top Controls */}
      <div className="flex justify-end gap-2">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition shadow-xs"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Moon className="w-4 h-4 text-teal-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
        </button>

        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition shadow-xs"
        >
          <Languages className="w-4 h-4 text-teal-600" />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-10 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center animate-in zoom-in-95 duration-200">
        {/* Brand Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/30">
          <Church className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          Oikonomos
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
          {translate('subtitle')}
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 text-start leading-relaxed">
            {error}
          </div>
        )}

        {/* Google Sign-in Button (Popup) */}
        <button
          onClick={() => handleGoogleLogin(false)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold text-sm bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 transition active:scale-98 shadow-md disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {/* Alternative: Redirect sign in */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => handleGoogleLogin(true)}
            className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 underline"
          >
            Having popup trouble? Sign in via redirect
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>OAuth 2.0 Protected Sunday School Portal</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-400 py-4">
        &copy; {new Date().getFullYear()} Oikonomos. All rights reserved.
      </footer>
    </div>
  );
};
