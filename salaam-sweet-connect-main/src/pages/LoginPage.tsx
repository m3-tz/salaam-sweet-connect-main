import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, UserPlus, Lock, IdCard, User, Languages, ShieldCheck, Sparkles, Phone, Moon, Sun, Mail, KeyRound, BookOpen, ShieldOff } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import DeveloperFooter from '@/components/DeveloperFooter';

const ACADEMY_LOGO_URL = "https://tuwaiq.edu.sa/img/logo-v2/logo.webp";
const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const { lang, toggleLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [logoutReason, setLogoutReason] = useState<'session_expired' | 'inactivity' | null>(null);

  // اقرأ سبب تسجيل الخروج القسري إن وُجد
  useEffect(() => {
    const reason = localStorage.getItem('logout_reason') as 'session_expired' | 'inactivity' | null;
    if (reason) {
      setLogoutReason(reason);
      localStorage.removeItem('logout_reason');
    }
  }, []);

  // ===== Login =====
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // ===== Register =====
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('طالب');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);

  // ===== Batches =====
  const [regBatchId, setRegBatchId] = useState('');
  const [activeBatches, setActiveBatches] = useState<{id: number; name: string; code: string; department: string}[]>([]);

  // ===== Forgot Password =====
  const [showForgot, setShowForgot] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotStep, setForgotStep] = useState<'id' | 'otp' | 'newpass'>('id');
  const [otpCode, setOtpCode] = useState('');
  const [newPass, setNewPass] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/batches/active'))
      .then(r => r.json())
      .then(d => { if (d.status === 'success') setActiveBatches(d.data || []); })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPassword) {
      toast({ title: t('خطأ', 'Error'), description: t('الرجاء إدخال الرقم الاكاديمي وكلمة المرور', 'Please enter University ID and Password'), variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const result = await login(loginId, loginPassword);
      if (result.success) {
        setIsBlocked(false);
        toast({ title: t('تم تسجيل الدخول بنجاح', 'Login Successful') });
        const stored = localStorage.getItem('lab_user');
        if (stored) {
          const user = JSON.parse(stored);
          const userRole = user.role?.toString().trim().toLowerCase();
          const isAdminOrEng = userRole === 'admin' || userRole === 'مشرف' || userRole === 'engineer' || userRole === 'مهندس';
          navigate(isAdminOrEng ? '/admin' : '/student');
        } else { navigate('/'); }
      } else {
        if (result.blocked) {
          setIsBlocked(true);
        }
        toast({ title: t('فشل تسجيل الدخول', 'Login Failed'), description: result.error || t('بيانات غير صحيحة', 'Invalid credentials'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), description: t('تعذر الاتصال بالخادم.', 'Could not connect to the server.'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone || !regPassword || !regEmail) {
      toast({ title: t('خطأ', 'Error'), description: t('الرجاء تعبئة جميع الحقول بما فيها الإيميل', 'Please fill all fields including email'), variant: 'destructive' }); return;
    }
    if (!emailVerified) {
      toast({ title: t('خطأ', 'Error'), description: t('الرجاء التحقق من إيميلك أولاً', 'Please verify your email first'), variant: 'destructive' }); return;
    }
    if (regPassword !== regConfirmPassword) {
      toast({ title: t('خطأ', 'Error'), description: t('كلمتا المرور غير متطابقتين', 'Passwords do not match'), variant: 'destructive' }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      toast({ title: t('خطأ', 'Error'), description: t('صيغة الإيميل غير صحيحة', 'Invalid email format'), variant: 'destructive' }); return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/register'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, phone: regPhone, password: regPassword, role: regRole, email: regEmail, batch_id: regBatchId && regBatchId !== 'none' ? regBatchId : null })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        toast({ title: t('تم إرسال الطلب بنجاح', 'Request Sent Successfully'), description: data.message });
        setRegName(''); setRegPhone(''); setRegPassword(''); setRegConfirmPassword('');
        setRegEmail(''); setEmailVerified(false); setEmailOtpSent(false); setEmailOtpCode(''); setRegBatchId('');
      } else { toast({ title: t('فشل التسجيل', 'Registration Failed'), description: data.message, variant: 'destructive' }); }
    } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const openForgot = () => { setShowForgot(true); setForgotStep('id'); setForgotId(''); setOtpCode(''); setNewPass(''); };

  return (
    <div className={`min-h-screen flex font-sans ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="hidden lg:flex flex-1 relative bg-blue-950 overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-900 to-blue-800 opacity-90"></div>
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="relative z-10 flex flex-col items-center text-white text-center p-12 max-w-lg">
          <div className="w-28 h-28 bg-white/10 backdrop-blur-md rounded-3xl p-4 mb-8 shadow-2xl border border-white/20">
            <img src={ACADEMY_LOGO_URL} alt="Tuwaiq Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight leading-tight">{lang === 'ar' ? 'معمل الابتكار الهندسي' : 'Innovation Engineering Lab'}</h1>
          <p className="text-blue-100 text-lg leading-relaxed mb-8">{lang === 'ar' ? 'منصتك المتكاملة لإدارة القطع، استعارة المعدات، وتنفيذ مشاريعك التقنية بكل احترافية.' : 'Your integrated platform for managing components, borrowing equipment, and executing your technical projects professionally.'}</p>
          <div className="flex items-center gap-2 text-sm font-bold bg-white/10 px-4 py-2 rounded-full border border-white/10">
            <Sparkles className="w-4 h-4 text-blue-300" />
            {lang === 'ar' ? 'أكاديمية طويق - نصنع المستقبل' : 'Tuwaiq Academy - Shaping the Future'}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden transition-colors">
        <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-200/50 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 backdrop-blur-sm transition-colors shadow-sm">
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
          <Button onClick={toggleLang} variant="ghost" className="font-bold gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30">
            <Languages className="w-5 h-5" /><span>{lang === 'ar' ? 'English' : 'عربي'}</span>
          </Button>
        </div>

        <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-4 sm:p-8 relative z-10 transition-colors">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-2xl p-3 mb-4 shadow-sm border border-blue-100 dark:border-slate-700">
              <img src={ACADEMY_LOGO_URL} alt="Tuwaiq Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">{lang === 'ar' ? 'معمل الابتكار' : 'Innovation Lab'}</h2>
          </div>
          <div className="hidden lg:block mb-8 text-center">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">{t('مرحباً بك', 'Welcome Back')}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('يرجى تسجيل الدخول للوصول إلى حسابك', 'Please login to access your account')}</p>
          </div>

          <Tabs defaultValue="login" className="w-full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
              <TabsTrigger value="login" className="font-bold rounded-lg py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm">
                <LogIn className="w-4 h-4 mr-2 ml-2" />{t('تسجيل دخول', 'Login')}
              </TabsTrigger>
              <TabsTrigger value="register" className="font-bold rounded-lg py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm">
                <UserPlus className="w-4 h-4 mr-2 ml-2" />{t('إنشاء حساب', 'Register')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('الرقم الاكاديمي / الوظيفي', 'University ID')}</Label>
                  <div className="relative">
                    <IdCard className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
                    <Input placeholder={t('أدخل رقمك الأكاديمي', 'Enter your Academic ID')} className={`h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white focus-visible:ring-blue-500 font-medium ${lang === 'ar' ? 'pr-12' : 'pl-12'} text-left`} dir="ltr" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('كلمة المرور', 'Password')}</Label>
                  <div className="relative">
                    <Lock className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
                    <Input type="password" placeholder="••••••••" className={`h-12 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white focus-visible:ring-blue-500 font-medium tracking-widest ${lang === 'ar' ? 'pr-12' : 'pl-12'} text-left`} dir="ltr" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  </div>
                </div>
                {/* بانر سبب تسجيل الخروج القسري */}
                {logoutReason && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                    logoutReason === 'session_expired'
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}>
                    <ShieldOff className={`w-5 h-5 shrink-0 mt-0.5 ${
                      logoutReason === 'session_expired' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-black ${
                        logoutReason === 'session_expired' ? 'text-orange-700 dark:text-orange-400' : 'text-blue-700 dark:text-blue-400'
                      }`}>
                        {logoutReason === 'session_expired'
                          ? t('تم تسجيل خروجك', 'You were signed out')
                          : t('انتهت جلستك', 'Session expired')}
                      </p>
                      <p className={`text-xs mt-0.5 font-medium ${
                        logoutReason === 'session_expired' ? 'text-orange-600 dark:text-orange-500' : 'text-blue-600 dark:text-blue-500'
                      }`}>
                        {logoutReason === 'session_expired'
                          ? t('تم تسجيل دخول بنفس حسابك من جهاز آخر.', 'Your account was signed in from another device.')
                          : t('تم تسجيل خروجك بسبب عدم النشاط لمدة 20 دقيقة.', 'You were signed out due to 20 minutes of inactivity.')}
                      </p>
                    </div>
                  </div>
                )}

                {/* بانر الحجب */}
                {isBlocked && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-red-700 dark:text-red-400">{t('تم حجب هذا الجهاز', 'Device Blocked')}</p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-0.5 font-medium">
                        {t('بسبب محاولات دخول متكررة. تواصل مع الإدارة لإلغاء الحجب.', 'Due to repeated login attempts. Contact admin to unblock.')}
                      </p>
                    </div>
                  </div>
                )}
                <Button type="submit" disabled={isLoading || isBlocked} className="w-full h-12 mt-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-bold text-lg shadow-md transition-transform active:scale-95 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed">
                  {isLoading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : isBlocked ? t('محجوب', 'Blocked') : t('دخول', 'Sign In')}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={openForgot} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('نسيت كلمة المرور؟', 'Forgot password?')}</button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <form onSubmit={handleRegister} className="space-y-4">

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('الاسم الثلاثي', 'Full Name')}</Label>
                  <div className="relative">
                    <User className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                    <Input placeholder={t('مثال: أحمد محمد', 'e.g., Ahmed Mohammed')} className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white focus-visible:ring-blue-500 font-medium ${lang === 'ar' ? 'pr-10' : 'pl-10'}`} value={regName} onChange={(e) => setRegName(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('رقم الجوال', 'Phone Number')}</Label>
                  <div className="relative">
                    <Phone className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                    <Input placeholder="05xxxxxxxx" type="tel" className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white focus-visible:ring-blue-500 font-medium tracking-wide ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left`} dir="ltr" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                  </div>
                </div>

                {/* ✅ اختيار الدفعة */}
                {activeBatches.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-500"/>
                      {t('الدفعة', 'Batch')} <span className="text-red-500">*</span>
                    </Label>
                    <Select value={regBatchId} onValueChange={setRegBatchId} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white font-bold">
                        <SelectValue placeholder={t('اختر دفعتك...', 'Select your batch...')} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-900 dark:border-slate-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                        <SelectItem value="none" className="dark:text-white">{t('بدون دفعة', 'No batch')}</SelectItem>
                        {activeBatches.map(b => (
                          <SelectItem key={b.id} value={b.id.toString()} className="dark:text-white">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{b.code}</span>
                              {b.name}
                              {b.department && <span className="text-slate-400 text-xs">· {b.department}</span>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-blue-500 dark:text-blue-400 font-medium flex items-center gap-1">
                      <BookOpen className="w-3 h-3"/>
                      {t('سيُرسل رقمك الأكاديمي لإيميلك بعد موافقة المشرف', 'Your academic ID will be sent to your email after admin approval')}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('نوع الحساب', 'Account Type')}</Label>
                  <Select value={regRole} onValueChange={setRegRole}>
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white font-bold" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                      <ShieldCheck className={`w-5 h-5 text-slate-400 dark:text-slate-500 ${lang === 'ar' ? 'ml-2' : 'mr-2'}`} />
                      <SelectValue placeholder={t('اختر الرتبة', 'Select Role')} />
                    </SelectTrigger>
                    <SelectContent dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                      <SelectItem value="طالب" className="font-bold text-blue-700 dark:text-blue-400">{t('طالب (متدرب)', 'Student')}</SelectItem>
                      <SelectItem value="مهندس" className="font-bold text-slate-700 dark:text-slate-300">{t('مهندس', 'Engineer')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('كلمة المرور', 'Password')}</Label>
                  <div className="relative">
                    <Lock className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                    <Input type="password" placeholder="••••••••" className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white focus-visible:ring-blue-500 font-medium tracking-widest ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left`} dir="ltr" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">{t('تأكيد كلمة المرور', 'Confirm Password')}</Label>
                  <div className="relative">
                    <Lock className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${regConfirmPassword && regPassword !== regConfirmPassword ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'} ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                    <Input type="password" placeholder="••••••••"
                      className={`h-11 focus-visible:ring-blue-500 font-medium tracking-widest ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left transition-colors ${regConfirmPassword && regPassword !== regConfirmPassword ? 'border-red-400 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white'}`}
                      dir="ltr" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} />
                  </div>
                  {regConfirmPassword && regPassword !== regConfirmPassword && (
                    <p className="text-[11px] text-red-500 font-medium">{t('كلمتا المرور غير متطابقتين', 'Passwords do not match')}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700 dark:text-slate-300">
                    {t('الإيميل', 'Email')}{' '}<span className="text-red-500 font-bold">*</span>
                    {emailVerified && <span className="text-emerald-500 text-xs font-bold mr-1 ml-1">✅ {t('تم التحقق', 'Verified')}</span>}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${emailVerified ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'} ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                      <Input type="email" placeholder="example@email.com"
                        className={`h-11 focus-visible:ring-blue-500 font-medium ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left transition-colors ${emailVerified ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:text-white' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white'}`}
                        dir="ltr" disabled={emailVerified} value={regEmail}
                        onChange={(e) => { setRegEmail(e.target.value); setEmailVerified(false); setEmailOtpSent(false); setEmailOtpCode(''); }} />
                    </div>
                    {!emailVerified && (
                      <Button type="button" disabled={emailOtpLoading || !regEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)}
                        onClick={async () => {
                          setEmailOtpLoading(true);
                          try {
                            const res = await fetch(apiUrl('/api/send-email-otp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: regEmail }) });
                            const data = await res.json();
                            if (data.status === 'success') { toast({ title: t('تم الإرسال ✅', 'Sent ✅'), description: data.message }); setEmailOtpSent(true); }
                            else { toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' }); }
                          } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
                          finally { setEmailOtpLoading(false); }
                        }}
                        className="h-11 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap rounded-xl">
                        {emailOtpLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : emailOtpSent ? t('إعادة إرسال', 'Resend') : t('إرسال رمز', 'Send Code')}
                      </Button>
                    )}
                  </div>
                  {emailOtpSent && !emailVerified && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Input placeholder="• • • • • •" className="h-11 text-center tracking-[0.4em] font-mono text-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white flex-1" dir="ltr" maxLength={6} value={emailOtpCode} onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))} />
                      <Button type="button" disabled={emailOtpLoading || emailOtpCode.length !== 6}
                        onClick={async () => {
                          setEmailOtpLoading(true);
                          try {
                            const res = await fetch(apiUrl('/api/verify-email-otp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: regEmail, otp: emailOtpCode }) });
                            const data = await res.json();
                            if (data.status === 'success') { toast({ title: t('تم التحقق ✅', 'Verified ✅') }); setEmailVerified(true); setEmailOtpSent(false); }
                            else { toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' }); }
                          } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
                          finally { setEmailOtpLoading(false); }
                        }}
                        className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                        {emailOtpLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('تحقق', 'Verify')}
                      </Button>
                    </div>
                  )}
                  {!emailVerified && (
                    <p className="text-[11px] text-blue-500 dark:text-blue-400 font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3" />{t('سيُرسل رمز تحقق لتأكيد إيميلك', 'A verification code will be sent to confirm your email')}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-11 mt-4 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold shadow-md rounded-xl transition-transform active:scale-95">
                  {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('إرسال طلب التسجيل', 'Send Registration Request')}
                </Button>
                <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 font-medium mt-2">{t('* سيتم تفعيل حسابك بعد موافقة المشرف', '* Your account will be activated after admin approval')}</p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        </div>{/* end flex-1 center area */}

        {/* Developer Footer — داخل الـ right panel حتى لا تكسر الـ flex layout */}
        <DeveloperFooter variant="compact" />
      </div>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForgot(false); }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-7 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">{t('استعادة كلمة المرور', 'Password Recovery')}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {forgotStep === 'id' && t('أدخل رقمك الأكاديمي', 'Enter your academic ID')}
                  {forgotStep === 'otp' && t('تحقق من إيميلك وأدخل الرمز', 'Check your email for the code')}
                  {forgotStep === 'newpass' && t('اختر كلمة مرور جديدة', 'Choose a new password')}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 mb-5">
              {['id','otp','newpass'].map((step, i) => {
                const current = ['id','otp','newpass'].indexOf(forgotStep);
                return <div key={step} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i < current ? 'bg-blue-400' : i === current ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />;
              })}
            </div>
            {forgotStep === 'id' && (
              <div className="space-y-4">
                <div className="relative">
                  <IdCard className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                  <Input placeholder={t('الرقم الأكاديمي', 'Academic ID')} className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left`} dir="ltr" value={forgotId} onChange={(e) => setForgotId(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowForgot(false)} className="flex-1 h-11 font-bold dark:border-slate-700 dark:text-slate-300">{t('إلغاء', 'Cancel')}</Button>
                  <Button disabled={isLoading || !forgotId} onClick={async () => {
                    setIsLoading(true);
                    try {
                      const res = await fetch(apiUrl('/api/forgot-password'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ universityId: forgotId }) });
                      const data = await res.json();
                      if (data.status === 'success') { toast({ title: t('تم الإرسال ✅', 'Sent ✅'), description: data.message }); setForgotStep('otp'); }
                      else toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' });
                    } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
                    finally { setIsLoading(false); }
                  }} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('إرسال الرمز', 'Send Code')}
                  </Button>
                </div>
              </div>
            )}
            {forgotStep === 'otp' && (
              <div className="space-y-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('أرسلنا رمزاً مكوناً من 6 أرقام لإيميلك', 'We sent a 6-digit code to your email')}</p>
                </div>
                <Input placeholder="• • • • • •" className="h-14 text-center tracking-[0.6em] font-mono text-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white" dir="ltr" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setForgotStep('id')} className="flex-1 h-11 font-bold dark:border-slate-700 dark:text-slate-300">{t('رجوع', 'Back')}</Button>
                  <Button disabled={isLoading || otpCode.length !== 6} onClick={async () => {
                    setIsLoading(true);
                    try {
                      const res = await fetch(apiUrl('/api/verify-otp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ universityId: forgotId, otp: otpCode }) });
                      const data = await res.json();
                      if (data.status === 'success') { toast({ title: t('الرمز صحيح ✅', 'Code Verified ✅') }); setForgotStep('newpass'); }
                      else toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' });
                    } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
                    finally { setIsLoading(false); }
                  }} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('تحقق', 'Verify')}
                  </Button>
                </div>
              </div>
            )}
            {forgotStep === 'newpass' && (
              <div className="space-y-4">
                <div className="relative">
                  <Lock className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 ${lang === 'ar' ? 'right-3' : 'left-3'}`} />
                  <Input type="password" placeholder={t('كلمة المرور الجديدة (6 أحرف+)', 'New password (6+ chars)')} className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white tracking-widest ${lang === 'ar' ? 'pr-10' : 'pl-10'} text-left`} dir="ltr" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setForgotStep('otp')} className="flex-1 h-11 font-bold dark:border-slate-700 dark:text-slate-300">{t('رجوع', 'Back')}</Button>
                  <Button disabled={isLoading || newPass.length < 6} onClick={async () => {
                    setIsLoading(true);
                    try {
                      const res = await fetch(apiUrl('/api/reset-password-otp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ universityId: forgotId, otp: otpCode, newPassword: newPass }) });
                      const data = await res.json();
                      if (data.status === 'success') { toast({ title: t('تم تغيير كلمة المرور 🎉', 'Password changed 🎉'), description: data.message }); setShowForgot(false); setForgotStep('id'); setForgotId(''); setOtpCode(''); setNewPass(''); }
                      else toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' });
                    } catch { toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' }); }
                    finally { setIsLoading(false); }
                  }} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('حفظ كلمة المرور', 'Save Password')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default LoginPage;