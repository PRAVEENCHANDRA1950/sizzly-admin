import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChartColumn, Eye, EyeOff, Lock, Mail, QrCode, UtensilsCrossed } from 'lucide-react';
import { authErrorMessage, useAuth } from '../context/AuthContext';
import { Button, inputClass } from '../components/ui';

export function LoginPage() {
  const { user, loading, login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!loading && user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await login(email, password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Enter your email above, then click "Forgot password?" again.');
      return;
    }
    try {
      await resetPassword(email);
      setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 to-accent p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.png" alt="" className="h-12 w-12 rounded-2xl bg-white/90 p-1" />
          <span className="font-display text-xl font-bold">Sizzly Chicken</span>
        </div>
        <div className="relative">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Run the restaurant
            <br />
            from one place.
          </h1>
          <ul className="mt-8 space-y-4 text-white/90">
            <li className="flex items-center gap-3">
              <UtensilsCrossed className="h-5 w-5" /> Update menu, prices, stock and add-ons
            </li>
            <li className="flex items-center gap-3">
              <QrCode className="h-5 w-5" /> Manage tables and print table QR codes
            </li>
            <li className="flex items-center gap-3">
              <ChartColumn className="h-5 w-5" /> Track live orders, sales and reports
            </li>
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Powered by CKBTECH</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-[#F5F5F4] px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/favicon.png" alt="" className="h-10 w-10 rounded-xl" />
            <span className="font-display text-lg font-bold text-ink">Sizzly Chicken</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">Admin sign in</h2>
          <p className="mt-1 text-sm text-gray-500">Use your admin email and password.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} h-11 pl-9`}
                  placeholder="admin@sizzly.in"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} h-11 pl-9 pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-brand-500"
                />
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
            )}

            <Button
              type="submit"
              loading={submitting}
              disabled={!email || !password}
              className="h-11 w-full"
            >
              Sign in {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
