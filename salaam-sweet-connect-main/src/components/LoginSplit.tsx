import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { LogIn, UserPlus, Lock, IdCard, Languages, Moon, Sun, Sparkles, Mail, KeyRound, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { apiUrl } from '@/lib/api';

const ACADEMY_LOGO_URL = "https://tuwaiq.edu.sa/img/logo-v2/logo.webp";

type View = 'login' | 'register' | 'forgot-id' | 'forgot-otp' | 'forgot-newpass';

export default function LoginSplit() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const { lang, toggleLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>('login');
  const [logoutReason, setLogoutReason] = useState<'session_expired' | 'inactivity' | null>(null);

  // Login State
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regBatchId, setRegBatchId] = useState('');
  const [activeBatches, setActiveBatches] = useState<{id: number; name: string; code: string; department: string}[]>([]);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);

  // Forgot Password State
  const [forgotId, setForgotId] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');

  useEffect(() => {
    const reason = localStorage.getItem('logout_reason') as 'session_expired' | 'inactivity' | null;
    if (reason) {
      setLogoutReason(reason);
      localStorage.removeItem('logout_reason');
    }
    fetch(apiUrl('/api/batches/active'))
      .then(r => r.json())
      .then(d => { if (d.status === 'success') setActiveBatches(d.data || []); })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPassword) {
      toast({ title: t('خطأ', 'Error'), description: t('الرجاء إدخال البيانات', 'Please enter credentials'), variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const result = await login(loginId, loginPassword);
      if (result.success) {
        toast({ title: t('تم تسجيل الدخول بنجاح', 'Login Successful') });
        const stored = localStorage.getItem('lab_user');
        if (stored) {
          const user = JSON.parse(stored);
          const userRole = user.role?.toString().trim().toLowerCase();
          const isAdminOrEng = userRole === 'admin' || userRole === 'مشرف' || userRole === 'engineer' || userRole === 'مهندس';
          navigate(isAdminOrEng ? '/admin' : '/student');
        }
      } else {
        toast({ title: t('فشل تسجيل الدخول', 'Login Failed'), description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), description: t('فشل الاتصال بالخادم', 'Server connection failed'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleSendOtp = async () => {
    if (!regEmail) return;
    setEmailOtpLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail })
      });
      if (res.ok) {
        setEmailOtpSent(true);
        toast({ title: t('تم إرسال الكود', 'Code Sent'), description: t('تحقق من بريدك الإلكتروني', 'Check your email') });
      }
    } catch (e) {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally { setEmailOtpLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!emailOtpCode) return;
    try {
      const res = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, code: emailOtpCode })
      });
      if (res.ok) {
        setEmailVerified(true);
        toast({ title: t('تم التحقق', 'Verified'), description: t('تم التحقق من بريدك بنجاح', 'Email verified successfully') });
      }
    } catch (e) {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword || !emailVerified) {
      toast({ title: t('خطأ', 'Error'), description: t('الرجاء إكمال جميع الحقول', 'Please complete all fields'), variant: 'destructive' });
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast({ title: t('خطأ', 'Error'), description: t('كلمات المرور غير متطابقة', 'Passwords do not match'), variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName, email: regEmail, phone: regPhone, password: regPassword,
          role: 'طالب', batchId: regBatchId || null
        })
      });
      if (res.ok) {
        toast({ title: t('تم التسجيل', 'Registered'), description: t('يمكنك تسجيل الدخول الآن', 'You can now login') });
        setView('login');
      }
    } catch (e) {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  // ─── Forgot Password Handlers ───────────────────────────────────────────
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotId) return;
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: forgotId })
      });
      if (res.ok) {
        toast({ title: t('تم الإرسال', 'Code Sent'), description: t('تم إرسال رمز التحقق إلى بريدك المسجل', 'Verification code sent to your registered email') });
        setView('forgot-otp');
      } else {
        const data = await res.json();
        toast({ title: t('خطأ', 'Error'), description: data.message || t('الرقم غير موجود', 'ID not found'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), description: t('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp) return;
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: forgotId, otp: forgotOtp })
      });
      if (res.ok) {
        toast({ title: t('تم التحقق', 'Verified'), description: t('أدخل كلمة المرور الجديدة', 'Enter your new password') });
        setView('forgot-newpass');
      } else {
        toast({ title: t('خطأ', 'Error'), description: t('الكود غير صحيح', 'Invalid code'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleForgotResetPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotNewPass || forgotNewPass !== forgotConfirmPass) {
      toast({ title: t('خطأ', 'Error'), description: t('كلمات المرور غير متطابقة', 'Passwords do not match'), variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/reset-password-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: forgotId, otp: forgotOtp, newPassword: forgotNewPass })
      });
      if (res.ok) {
        toast({ title: t('تم تغيير كلمة المرور 🎉', 'Password Changed 🎉'), description: t('يمكنك تسجيل الدخول الآن', 'You can now login') });
        setForgotId(''); setForgotOtp(''); setForgotNewPass(''); setForgotConfirmPass('');
        setView('login');
      } else {
        toast({ title: t('خطأ', 'Error'), description: t('فشل تحديث كلمة المرور', 'Failed to update password'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const isForgotView = view === 'forgot-id' || view === 'forgot-otp' || view === 'forgot-newpass';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Hero Panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center bg-gradient-to-br from-blue-950 via-indigo-900 to-blue-800 p-12">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-40 mix-blend-multiply animate-pulse" style={{animationDelay: '0s'}} />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-40 mix-blend-multiply animate-pulse" style={{animationDelay: '2s'}} />

        <div className="relative z-10 text-center text-white max-w-md">
          <div className="w-28 h-28 mx-auto mb-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 shadow-2xl flex items-center justify-center">
            <img src={ACADEMY_LOGO_URL} alt="Tuwaiq" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-4xl font-black mb-4 tracking-tight leading-tight">
            {t('معمل الابتكار الهندسي', 'Innovation Lab')}
          </h1>
          <p className="text-lg text-blue-200 leading-relaxed mb-8">
            {t('منصتك المتكاملة لإدارة القطع، استعارة المعدات، وتنفيذ مشاريعك التقنية بكل احترافية.', 'Your integrated platform for managing components, borrowing equipment, and executing technical projects professionally.')}
          </p>

          <div className="inline-flex items-center gap-2 font-bold text-sm bg-white/10 px-4 py-2 rounded-full border border-white/10">
            <Sparkles size={14} className="text-blue-300" />
            {t('أكاديمية طويق — نصنع المستقبل', 'Tuwaiq Academy - Shaping the Future')}
          </div>

          {logoutReason && (
            <div className="mt-8 p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-red-100 text-sm">
              {logoutReason === 'session_expired' ? t('انتهت جلستك', 'Your session expired') : t('تم تسجيل خروجك بسبب الخمول', 'You were logged out due to inactivity')}
            </div>
          )}
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              {isForgotView ? (
                <>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    {t('استعادة كلمة المرور', 'Reset Password')}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                    {view === 'forgot-id' && t('أدخل رقمك الأكاديمي', 'Enter your university ID')}
                    {view === 'forgot-otp' && t('أدخل رمز التحقق المرسل لبريدك', 'Enter the code sent to your email')}
                    {view === 'forgot-newpass' && t('أدخل كلمة مرور جديدة', 'Enter your new password')}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                    {t('مرحباً بك', 'Welcome')}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                    {t('يرجى تسجيل الدخول للوصول إلى حسابك', 'Please sign in to your account')}
                  </p>
                </>
              )}
            </div>
            <button onClick={toggleTheme} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          {/* Tabs (only for login/register) */}
          {!isForgotView && (
            <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
              {[
                { id: 'login', label: t('تسجيل دخول', 'Sign In'), icon: LogIn },
                { id: 'register', label: t('إنشاء حساب', 'Sign Up'), icon: UserPlus }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setView(id as View)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                    view === id
                      ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Back button for forgot password views */}
          {isForgotView && (
            <button
              onClick={() => setView('login')}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              {lang === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
              {t('رجوع لتسجيل الدخول', 'Back to login')}
            </button>
          )}

          {/* ─── Login Form ──────────────────────────────────────────────── */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('الرقم الأكاديمي / الوظيفي', 'University ID')}
                </label>
                <div className="relative">
                  <IdCard size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" dir="ltr" placeholder={t('أدخل رقمك', 'Enter your ID')}
                    value={loginId} onChange={(e) => setLoginId(e.target.value)}
                    className="w-full py-3 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t('كلمة المرور', 'Password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setView('forgot-id')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    {t('نسيت كلمة المرور؟', 'Forgot password?')}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password" dir="ltr" placeholder="••••••••"
                    value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full py-3 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit" disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all active:scale-95 shadow-cta"
              >
                {isLoading ? t('جاري الدخول...', 'Signing in...') : t('دخول', 'Sign In')}
              </button>

              <button
                type="button" onClick={toggleLang}
                className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <Languages size={16} />
                {lang === 'ar' ? 'English' : 'العربية'}
              </button>
            </form>
          )}

          {/* ─── Register Form ───────────────────────────────────────────── */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('الاسم الكامل', 'Full Name')}
                </label>
                <input type="text" placeholder={t('أدخل اسمك', 'Enter your name')}
                  value={regName} onChange={(e) => setRegName(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('البريد الإلكتروني', 'Email')} {emailVerified && <span className="text-green-600">✓</span>}
                </label>
                <div className="flex gap-2 mb-2">
                  <input type="email" placeholder={t('بريدك الإلكتروني', 'Your email')}
                    value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                    className="flex-1 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {!emailOtpSent && (
                    <button type="button" onClick={handleSendOtp} disabled={emailOtpLoading || !regEmail}
                      className="px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-60">
                      {t('إرسال', 'Send')}
                    </button>
                  )}
                </div>
                {emailOtpSent && !emailVerified && (
                  <div className="flex gap-2">
                    <input type="text" placeholder={t('الكود', 'Code')} value={emailOtpCode}
                      onChange={(e) => setEmailOtpCode(e.target.value)} maxLength={6}
                      className="flex-1 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={handleVerifyOtp}
                      className="px-3 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">
                      {t('تحقق', 'Verify')}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{t('الهاتف', 'Phone')}</label>
                <input type="tel" dir="ltr" placeholder="+966..." value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{t('كلمة المرور', 'Password')}</label>
                <input type="password" dir="ltr" placeholder="••••••••" value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{t('تأكيد كلمة المرور', 'Confirm Password')}</label>
                <input type="password" dir="ltr" placeholder="••••••••" value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {activeBatches.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{t('المعسكر', 'Batch')}</label>
                  <select value={regBatchId} onChange={(e) => setRegBatchId(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">{t('اختر معسكراً', 'Select a batch')}</option>
                    {activeBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <button type="submit" disabled={isLoading || !emailVerified}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-all active:scale-95">
                {isLoading ? t('جاري التسجيل...', 'Registering...') : t('تسجيل', 'Register')}
              </button>
            </form>
          )}

          {/* ─── Forgot Password: Step 1 - Enter ID ──────────────────────── */}
          {view === 'forgot-id' && (
            <form onSubmit={handleForgotSendOtp} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('الرقم الأكاديمي / الوظيفي', 'University ID')}
                </label>
                <div className="relative">
                  <IdCard size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" dir="ltr" placeholder={t('أدخل رقمك', 'Enter your ID')}
                    value={forgotId} onChange={(e) => setForgotId(e.target.value)}
                    className="w-full py-3 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {t('سيتم إرسال رمز التحقق إلى بريدك الإلكتروني المسجل', 'Verification code will be sent to your registered email')}
                </p>
              </div>
              <button type="submit" disabled={isLoading || !forgotId}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl active:scale-95 shadow-cta">
                {isLoading ? t('جاري الإرسال...', 'Sending...') : t('إرسال رمز التحقق', 'Send Verification Code')}
              </button>
            </form>
          )}

          {/* ─── Forgot Password: Step 2 - OTP ───────────────────────────── */}
          {view === 'forgot-otp' && (
            <form onSubmit={handleForgotVerifyOtp} className="space-y-5">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Mail size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    {t('تم إرسال رمز التحقق إلى بريدك الإلكتروني المسجل. الرمز صالح لمدة 10 دقائق.', 'Verification code sent to your registered email. Valid for 10 minutes.')}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('رمز التحقق', 'Verification Code')}
                </label>
                <div className="relative">
                  <KeyRound size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" dir="ltr" placeholder="000000" maxLength={6}
                    value={forgotOtp} onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-3 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold text-lg tracking-widest"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading || forgotOtp.length !== 6}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl active:scale-95 shadow-cta">
                {isLoading ? t('جاري التحقق...', 'Verifying...') : t('تحقق', 'Verify')}
              </button>

              <button type="button" onClick={handleForgotSendOtp as any}
                className="w-full text-sm font-bold text-blue-600 hover:text-blue-700">
                {t('إعادة إرسال الرمز', 'Resend Code')}
              </button>
            </form>
          )}

          {/* ─── Forgot Password: Step 3 - New Password ──────────────────── */}
          {view === 'forgot-newpass' && (
            <form onSubmit={handleForgotResetPass} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('كلمة المرور الجديدة', 'New Password')}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password" dir="ltr" placeholder="••••••••"
                    value={forgotNewPass} onChange={(e) => setForgotNewPass(e.target.value)}
                    className="w-full py-3 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {t('تأكيد كلمة المرور', 'Confirm Password')}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password" dir="ltr" placeholder="••••••••"
                    value={forgotConfirmPass} onChange={(e) => setForgotConfirmPass(e.target.value)}
                    className="w-full py-3 pr-12 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading || !forgotNewPass || forgotNewPass !== forgotConfirmPass}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl active:scale-95 shadow-cta">
                {isLoading ? t('جاري التحديث...', 'Updating...') : t('تحديث كلمة المرور', 'Update Password')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
