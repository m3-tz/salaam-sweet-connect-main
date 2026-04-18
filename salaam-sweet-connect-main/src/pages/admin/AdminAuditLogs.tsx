import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Clock, FileText, CheckCircle, Trash2, PlusCircle,
  Edit, Search, RefreshCcw, ShieldAlert, LogIn, LogOut, Ban,
  FilterX, Download, ChevronRight, ChevronLeft, Users, TrendingUp,
  Calendar, Wifi, WifiOff, Monitor, Smartphone, User, Shield,
  GraduationCap, Wrench, Eye, Globe, Lock, Unlock, AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { apiUrl } from '@/lib/api';

interface AuditLog {
  id: number;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
  created_at: string;
  ip_address?: string;
}

interface BlockedIp {
  ip: string;
  attempts: number;
  blocked_until: string;
  seconds_remaining: number;
}

interface FailedAttempt {
  ip: string;
  attempts: number;
  first_attempt: string;
  is_blocked: boolean;
  blocked_until: string | null;
}

interface OnlineUser {
  universityId: string;
  name: string;
  role: string;
  last_seen: string;
  last_page: string;
  phone: string;
  email: string;
}

// ── مساعد: صور المسارات إلى تسميات عربية ─────────────────────────────────
const pageLabel = (path: string, lang: string): string => {
  if (!path) return lang === 'ar' ? 'غير معروف' : 'Unknown';
  if (path.includes('/admin')) return lang === 'ar' ? 'لوحة الأدمن' : 'Admin Panel';
  if (path.includes('/student')) return lang === 'ar' ? 'بوابة الطلاب' : 'Student Portal';
  if (path.includes('/login')) return lang === 'ar' ? 'صفحة الدخول' : 'Login Page';
  if (path === '/') return lang === 'ar' ? 'الرئيسية' : 'Home';
  return path;
};

// ── لون + أيقونة الدور ──────────────────────────────────────────────────
const roleConfig = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r === 'مشرف' || r === 'admin')
    return { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', Icon: Shield, label: 'مشرف' };
  if (r === 'مهندس' || r === 'engineer')
    return { color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800', Icon: Wrench, label: 'مهندس' };
  return { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800', Icon: GraduationCap, label: 'طالب' };
};

const AdminAuditLogs = () => {
  const { lang, t } = useLanguage();
  const { toast } = useToast();

  // ── Audit logs ─────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // ── Online users ───────────────────────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(true);
  const [selectedOnlineUser, setSelectedOnlineUser] = useState<OnlineUser | null>(null);

  // ── Security ───────────────────────────────────────────────────────────
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([]);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null);

  // ── Fetchers ───────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(apiUrl('/api/admin/audit-logs?limit=500'));
      const data = await res.json();
      if (res.ok) setLogs(data.data);
    } catch {
      if (!silent) toast({ title: t('خطأ', 'Error'), description: t('فشل في جلب السجلات', 'Failed to fetch logs'), variant: 'destructive' });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/online-users'));
      const data = await res.json();
      if (res.ok) setOnlineUsers(data.data);
    } catch {} finally {
      setOnlineLoading(false);
    }
  }, []);

  const fetchSecurity = useCallback(async () => {
    try {
      const [blockedRes, failedRes] = await Promise.all([
        fetch(apiUrl('/api/admin/blocked-ips')),
        fetch(apiUrl('/api/admin/failed-attempts')),
      ]);
      const blockedData = await blockedRes.json();
      const failedData  = await failedRes.json();
      if (blockedRes.ok) setBlockedIps(blockedData.data || []);
      if (failedRes.ok)  setFailedAttempts(failedData.data || []);
    } catch {} finally {
      setSecurityLoading(false);
    }
  }, []);

  const handleUnblock = async (ip: string) => {
    setUnblockingIp(ip);
    try {
      const res  = await fetch(apiUrl('/api/admin/unblock-ip'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: t('تم إلغاء الحجب', 'Unblocked'), description: ip });
        fetchSecurity();
      } else {
        toast({ title: t('خطأ', 'Error'), description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), description: t('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally {
      setUnblockingIp(null);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchOnlineUsers();
    fetchSecurity();
    // تحديث المتصلين كل 30 ثانية
    const interval = setInterval(() => {
      fetchOnlineUsers();
      fetchLogs(true);
      fetchSecurity();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedUser, selectedAction]);

  // ── Derived ────────────────────────────────────────────────────────────
  const uniqueUsers   = useMemo(() => Array.from(new Set(logs.map(l => l.user_name))), [logs]);
  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))), [logs]);

  const stats = useMemo(() => {
    const today       = new Date().toDateString();
    const todayLogs   = logs.filter(l => new Date(l.created_at).toDateString() === today);
    const userCounts  = logs.reduce((acc, l) => { acc[l.user_name] = (acc[l.user_name] || 0) + 1; return acc; }, {} as Record<string, number>);
    const topUser     = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: logs.length,
      today: todayLogs.length,
      topUser: topUser ? topUser[0] : '—',
      topUserCount: topUser ? topUser[1] : 0,
    };
  }, [logs]);

  const getActionConfig = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('حذف') || act.includes('delete'))    return { icon: Trash2,      dot: 'bg-red-500',     badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' };
    if (act.includes('إضافة') || act.includes('add') || act.includes('جديد')) return { icon: PlusCircle, dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
    if (act.includes('تعديل') || act.includes('edit') || act.includes('تحديث')) return { icon: Edit,       dot: 'bg-blue-500',    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' };
    if (act.includes('موافقة') || act.includes('قبول') || act.includes('approve')) return { icon: CheckCircle, dot: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
    if (act.includes('رفض') || act.includes('reject'))   return { icon: Ban,          dot: 'bg-red-500',     badge: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' };
    if (act.includes('حظر') || act.includes('ban'))       return { icon: ShieldAlert,  dot: 'bg-orange-500',  badge: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' };
    if (act.includes('دخول') || act.includes('login'))    return { icon: LogIn,        dot: 'bg-indigo-500',  badge: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' };
    if (act.includes('خروج') || act.includes('logout'))   return { icon: LogOut,       dot: 'bg-slate-400',   badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    if (act.includes('إرسال') || act.includes('تذكير'))   return { icon: Activity,     dot: 'bg-amber-500',   badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' };
    return { icon: Activity, dot: 'bg-slate-400', badge: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
  };

  const formatTime = (dateStr: string) => {
    const date  = new Date(dateStr);
    const now   = new Date();
    const diffMs   = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs  = Math.floor(diffMs / 3600000);
    const isToday  = date.toDateString() === now.toDateString();
    const isYest   = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
    const timeStr  = date.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffMins < 1)  return { label: t('الآن', 'Now'), time: timeStr, isRecent: true };
    if (diffMins < 60) return { label: `${diffMins} ${t('د', 'm')}`, time: timeStr, isRecent: true };
    if (diffHrs < 24 && isToday) return { label: t('اليوم', 'Today'), time: timeStr, isRecent: false };
    if (isYest)        return { label: t('أمس', 'Yesterday'), time: timeStr, isRecent: false };
    return { label: date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }), time: timeStr, isRecent: false };
  };

  const sinceOnline = (dateStr: string) => {
    if (!dateStr) return '';
    const diffMs   = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)  return t('الآن', 'just now');
    if (diffMins < 60) return `${diffMins} ${t('د', 'min')}`;
    return `${Math.floor(diffMins / 60)} ${t('س', 'hr')}`;
  };

  const filteredLogs = useMemo(() => logs.filter(log => {
    const searchMatch = searchTerm === '' ||
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id.includes(searchTerm) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const userMatch   = selectedUser === 'all' || log.user_name === selectedUser;
    const actionMatch = selectedAction === 'all' || log.action === selectedAction;
    return searchMatch && userMatch && actionMatch;
  }), [logs, searchTerm, selectedUser, selectedAction]);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, AuditLog[]> = {};
    filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).forEach(log => {
      const date  = new Date(log.created_at);
      const today = new Date();
      const yest  = new Date(today.getTime() - 86400000);
      let key: string;
      if (date.toDateString() === today.toDateString())  key = t('اليوم', 'Today');
      else if (date.toDateString() === yest.toDateString()) key = t('أمس', 'Yesterday');
      else key = date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return groups;
  }, [filteredLogs, currentPage, lang]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const clearFilters = () => { setSearchTerm(''); setSelectedUser('all'); setSelectedAction('all'); };

  const exportToCSV = () => {
    const headers = ['المستخدم', 'الرقم الوظيفي', 'الإجراء', 'التفاصيل', 'التاريخ والوقت'];
    const rows    = filteredLogs.map(l => [l.user_name, l.user_id, l.action, `"${l.details}"`, new Date(l.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')]);
    const csv     = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const link    = document.createElement('a');
    link.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `سجل_العمليات_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: t('تم التصدير', 'Exported') });
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans pb-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800 dark:bg-blue-600 text-white rounded-xl shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">{t('المراقبة وسجل الحركات', 'Audit & Activity Logs')}</h2>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('تتبع دقيق لجميع الأنشطة · تحديث تلقائي كل 30 ثانية', 'Full activity tracking · Auto-refresh every 30s')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button onClick={exportToCSV} variant="outline" className="gap-2 font-bold flex-1 md:flex-none text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:bg-slate-900 dark:border-slate-700 dark:text-emerald-400 shadow-sm h-10">
            <Download className="w-4 h-4"/> {t('تصدير', 'Export')}
          </Button>
          <Button onClick={() => { fetchLogs(); fetchOnlineUsers(); fetchSecurity(); }} disabled={isRefreshing} className="gap-2 font-bold flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md h-10">
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          إحصائيات سريعة
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('إجمالي العمليات', 'Total Operations')}</p>
            <p className="text-3xl font-black text-slate-800 dark:text-white">{logs.length.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('عمليات اليوم', "Today's Operations")}</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.today}</p>
          </div>
        </div>

        <div
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:-translate-y-0.5 transition-transform"
          onClick={() => setSelectedUser(stats.topUser)}
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('الأكثر نشاطاً', 'Most Active')}</p>
            <p className="text-lg font-black text-slate-800 dark:text-white truncate">{stats.topUser}</p>
            <p className="text-xs font-bold text-purple-500">{stats.topUserCount} {t('عملية', 'ops')}</p>
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm flex items-center gap-4 ${blockedIps.length > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${blockedIps.length > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
            <Shield className={`w-6 h-6 ${blockedIps.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('IPs محجوبة', 'Blocked IPs')}</p>
            <p className={`text-3xl font-black ${blockedIps.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{blockedIps.length}</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          🔒 الأمان — IPs المحجوبة والمحاولات الفاشلة
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <span className="font-black text-slate-800 dark:text-white text-sm">{t('الأمان وحماية النظام', 'Security & Protection')}</span>
            {blockedIps.length > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse">
                {blockedIps.length} {t('محجوب دائم', 'permanently blocked')}
              </span>
            )}
          </div>
          <Button onClick={fetchSecurity} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <RefreshCcw className={`w-3.5 h-3.5 ${securityLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── IPs المحجوبة ── */}
          <div className="space-y-2">
            <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> {t('IPs محجوبة بشكل دائم', 'Permanently Blocked IPs')}
            </p>
            {securityLoading ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCcw className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : blockedIps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Unlock className="w-8 h-8 text-emerald-300 dark:text-emerald-700" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('لا توجد IPs محجوبة', 'No blocked IPs')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blockedIps.map(b => (
                  <div key={b.ip} className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-mono font-black text-sm text-red-700 dark:text-red-400">{b.ip}</p>
                        <p className="text-[10px] text-red-500 dark:text-red-400 font-bold">
                          {b.attempts} {t('محاولة', 'attempts')} · {t('محجوب دائماً — يفكه الأدمن فقط', 'Permanent — admin only')}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleUnblock(b.ip)}
                      disabled={unblockingIp === b.ip}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-bold border-red-300 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 shrink-0"
                    >
                      {unblockingIp === b.ip ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                      <span className="mr-1">{t('إلغاء الحجب', 'Unblock')}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── محاولات فاشلة ── */}
          <div className="space-y-2">
            <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {t('محاولات دخول مشبوهة', 'Suspicious Login Attempts')}
            </p>
            {securityLoading ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCcw className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : failedAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <CheckCircle className="w-8 h-8 text-emerald-300 dark:text-emerald-700" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{t('لا توجد محاولات مشبوهة', 'No suspicious attempts')}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {failedAttempts.map(f => (
                  <div key={f.ip} className={`flex items-center justify-between p-3 rounded-xl border ${
                    f.is_blocked
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className={`w-4 h-4 shrink-0 ${f.is_blocked ? 'text-red-500' : 'text-orange-500'}`} />
                      <div className="min-w-0">
                        <p className={`font-mono font-black text-sm ${f.is_blocked ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>{f.ip}</p>
                        <p className={`text-[10px] ${f.is_blocked ? 'text-red-500' : 'text-orange-500'}`}>
                          {f.attempts} {t('محاولة', 'attempts')}
                          {f.is_blocked && <span className="mr-1 font-black">· {t('محجوب دائماً', 'PERMANENTLY BLOCKED')}</span>}
                        </p>
                      </div>
                    </div>
                    {f.is_blocked && (
                      <Button
                        onClick={() => handleUnblock(f.ip)}
                        disabled={unblockingIp === f.ip}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-bold border-red-300 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 shrink-0"
                      >
                        {unblockingIp === f.ip ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                        <span className="mr-1">{t('فك', 'Unblock')}</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ✅ المتصلون الآن (Online Users)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Wifi className="w-5 h-5 text-emerald-500" />
              {onlineUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              )}
            </div>
            <span className="font-black text-slate-800 dark:text-white text-sm">{t('المتصلون الآن', 'Online Now')}</span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${onlineUsers.length > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {onlineLoading ? '…' : onlineUsers.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{t('نشط خلال آخر 5 دقائق', 'Active within last 5 min')}</p>
        </div>

        {/* Users grid */}
        {onlineLoading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <WifiOff className="w-10 h-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{t('لا يوجد أحد متصل حالياً', 'Nobody is online right now')}</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {onlineUsers.map(u => {
              const rc = roleConfig(u.role);
              const RoleIcon = rc.Icon;
              const isSelected = selectedOnlineUser?.universityId === u.universityId;
              return (
                <button
                  key={u.universityId}
                  onClick={() => setSelectedOnlineUser(isSelected ? null : u)}
                  className={`text-start p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black text-sm">
                        {u.name.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-white truncate">{u.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{u.universityId}</p>
                    </div>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border flex items-center gap-0.5 shrink-0 ${rc.color}`}>
                      <RoleIcon className="w-2.5 h-2.5" /> {rc.label}
                    </span>
                  </div>
                  {/* Bottom row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{pageLabel(u.last_page, lang)}</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {sinceOnline(u.last_seen)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── بطاقة تفاصيل المستخدم المختار ─────────────────────────── */}
        {selectedOnlineUser && (() => {
          const rc = roleConfig(selectedOnlineUser.role);
          const RoleIcon = rc.Icon;
          const userLogs = logs.filter(l => l.user_id === selectedOnlineUser.universityId).slice(0, 5);
          return (
            <div className="mx-4 mb-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-black text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> {t('تفاصيل المستخدم', 'User Details')}
                </p>
                <button onClick={() => setSelectedOnlineUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold">✕</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('الاسم', 'Name')}</p>
                  <p className="font-black text-slate-800 dark:text-white">{selectedOnlineUser.name}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('الرقم', 'ID')}</p>
                  <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedOnlineUser.universityId}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('الدور', 'Role')}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black ${rc.color}`}>
                    <RoleIcon className="w-3 h-3" /> {rc.label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('الصفحة الحالية', 'Current Page')}</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{pageLabel(selectedOnlineUser.last_page, lang)}</p>
                </div>
                {selectedOnlineUser.phone && (
                  <div className="space-y-0.5">
                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('الجوال', 'Phone')}</p>
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-300" dir="ltr">{selectedOnlineUser.phone}</p>
                  </div>
                )}
                {selectedOnlineUser.email && (
                  <div className="space-y-0.5 col-span-2">
                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('البريد', 'Email')}</p>
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedOnlineUser.email}</p>
                  </div>
                )}
                <div className="space-y-0.5">
                  <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px]">{t('آخر نشاط', 'Last Seen')}</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">{sinceOnline(selectedOnlineUser.last_seen)} {t('مضت', 'ago')}</p>
                </div>
              </div>

              {userLogs.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('آخر عمليات هذا المستخدم', 'Recent actions')}</p>
                  <div className="space-y-1">
                    {userLogs.map(l => {
                      const { icon: Icon, badge } = getActionConfig(l.action);
                      return (
                        <div key={l.id} className="flex items-center gap-2 text-xs">
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black border ${badge}`}><Icon className="w-2.5 h-2.5"/>{l.action}</span>
                          <span className="text-slate-600 dark:text-slate-300 truncate">{l.details}</span>
                          <span className="text-slate-400 dark:text-slate-500 shrink-0 font-mono">{formatTime(l.created_at).label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => { setSelectedUser(selectedOnlineUser.user_name || selectedOnlineUser.name); setSelectedOnlineUser(null); }}
                    className="mt-2 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('عرض جميع سجلات هذا المستخدم ←', 'View all logs for this user →')}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          فلاتر
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('بحث حر', 'Global Search')}</Label>
            <div className="relative">
              <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('ابحث بالاسم، الحركة، أو التفاصيل...', 'Search name, action, details...')}
                className={`h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white font-medium ${lang === 'ar' ? 'pr-9' : 'pl-9'}`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('تتبع مستخدم', 'Track User')}</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold dark:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <SelectValue placeholder={t('كل المستخدمين', 'All Users')} />
              </SelectTrigger>
              <SelectContent dir={lang === 'ar' ? 'rtl' : 'ltr'} className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all" className="font-bold dark:text-white">{t('الكل', 'All')}</SelectItem>
                {uniqueUsers.map(u => <SelectItem key={u} value={u} className="dark:text-white">{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('تتبع إجراء', 'Track Action')}</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold dark:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  <SelectValue placeholder={t('كل الإجراءات', 'All Actions')} />
                </SelectTrigger>
                <SelectContent dir={lang === 'ar' ? 'rtl' : 'ltr'} className="dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="all" className="font-bold dark:text-white">{t('الكل', 'All')}</SelectItem>
                  {uniqueActions.map(a => <SelectItem key={a} value={a} className="dark:text-white">{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(searchTerm || selectedUser !== 'all' || selectedAction !== 'all') && (
              <Button onClick={clearFilters} variant="ghost" className="h-11 px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" title={t('مسح الفلاتر', 'Clear Filters')}>
                <FilterX className="w-5 h-5"/>
              </Button>
            )}
          </div>
        </div>

        {/* نتيجة الفلتر */}
        {(searchTerm || selectedUser !== 'all' || selectedAction !== 'all') && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('النتائج:', 'Results:')}</span>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400">{filteredLogs.length.toLocaleString()} {t('سجل', 'logs')}</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Timeline
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-bold text-slate-400">{t('جاري تحميل السجلات...', 'Loading logs...')}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <FileText className="w-12 h-12 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-400">{t('لا توجد سجلات مطابقة', 'No matching logs found')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(groupedLogs).map(([dateLabel, dateLogs]) => (
              <div key={dateLabel}>
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">{dateLabel}</span>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                    {dateLogs.length} {t('حركة', 'ops')}
                  </span>
                </div>

                <div className="relative">
                  <div className={`absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800 ${lang === 'ar' ? 'right-[5.5rem]' : 'left-[5.5rem]'}`} />

                  {dateLogs.map(log => {
                    const { icon: Icon, dot, badge } = getActionConfig(log.action);
                    const timeInfo = formatTime(log.created_at);
                    return (
                      <div key={log.id} className="flex gap-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className={`w-24 flex-shrink-0 flex flex-col items-end justify-start pt-5 ${lang === 'ar' ? 'pl-4' : 'pr-4'}`}>
                          <span className={`text-xs font-black ${timeInfo.isRecent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {timeInfo.label}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5" dir="ltr">
                            {timeInfo.time}
                          </span>
                        </div>

                        <div className="flex-shrink-0 flex flex-col items-center pt-5">
                          <div className={`w-3 h-3 rounded-full ${dot} ring-4 ring-white dark:ring-slate-900 z-10 relative`} />
                        </div>

                        <div className={`flex-1 pb-4 pt-3.5 ${lang === 'ar' ? 'pr-5' : 'pl-5'} min-w-0`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <button
                              onClick={() => setSelectedAction(log.action)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-transform hover:scale-105 ${badge}`}
                            >
                              <Icon className="w-3 h-3" /> {log.action}
                            </button>
                            <button
                              onClick={() => setSelectedUser(log.user_name)}
                              className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-200 dark:border-blue-800">
                                {log.user_name.charAt(0)}
                              </div>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{log.user_name}</span>
                              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{log.user_id}</span>
                            </button>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{log.details}</p>
                          {log.ip_address && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              <Globe className="w-2.5 h-2.5" /> {log.ip_address}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('صفحة', 'Page')} {currentPage} {t('من', 'of')} {totalPages}
              <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
              {t('إجمالي:', 'Total:')} {filteredLogs.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="h-8 px-2 text-xs border-slate-300 dark:border-slate-700 dark:bg-slate-800">
                {lang === 'ar' ? '»' : '«'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 dark:bg-slate-800">
                <ChevronRight className={`w-4 h-4 ${lang === 'en' ? 'rotate-180' : ''}`}/>
              </Button>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 px-1">{currentPage}/{totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700 dark:bg-slate-800">
                <ChevronLeft className={`w-4 h-4 ${lang === 'en' ? 'rotate-180' : ''}`}/>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="h-8 px-2 text-xs border-slate-300 dark:border-slate-700 dark:bg-slate-800">
                {lang === 'ar' ? '«' : '»'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogs;
