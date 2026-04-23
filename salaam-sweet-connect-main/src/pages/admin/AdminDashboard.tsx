import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutDashboard, Package, ClipboardList, Users, Tent,
  LogOut, Menu, AlertTriangle, Archive, Clock, ShoppingBag, KeyRound, Languages, BarChart3, RotateCcw,
  Activity, Sun, Moon, Map, RefreshCw, BookOpen, Bell, Wrench, X, ChevronRight, Shield, Sparkles, Box as BoxIcon, Mail
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

import { useLanguage } from '../../LanguageContext';
import { apiUrl } from '@/lib/api';
import AdminInventory from './AdminInventory';
import AdminLoans from './AdminLoans';
import AdminStudents from './AdminStudents.tsx';
import AdminCamps from './AdminCamps';
import AdminRequests from './AdminRequests';
import AdminAuditLogs from './AdminAuditLogs';
import AdminBatches from './Adminbatches';
import AdminLocations from './AdminLocations';
import AdminPermissions from './AdminPermissions';
import AdminItemRequests from './AdminItemRequests';
import AdminBoxes from './AdminBoxes';
import DeveloperFooter from '@/components/DeveloperFooter';

const ACADEMY_LOGO_URL = "https://tuwaiq.edu.sa/img/logo-v2/logo.webp";
type Tab = 'dashboard' | 'inventory' | 'locations' | 'loans' | 'students' | 'camps' | 'requests' | 'audit' | 'batches' | 'permissions' | 'item-requests' | 'boxes';

export interface RecentActivity {
  id: number;
  studentName: string;
  componentName: string;
  borrowDate: string;
  status: string;
}

export interface TopItem {
  name: string;
  count: number;
}

interface DashboardHomeProps {
  totalComponents: number;
  activeLoans: number;
  overdueLoans: number;
  activeCamps: number;
  pendingRequests: number;
  recentActivity: RecentActivity[];
  topItems: TopItem[];
  t: (ar: string, en: string) => string;
  onResetStats: () => void;
  onNavigate: (tab: Tab) => void;
  onRefresh: () => void;
  loading: boolean;
  lang: string;
  userName?: string;
  userRole?: string;
  notifications: AppNotification[];
}

interface AppNotification {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  tab: Tab;
  icon: React.ElementType;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
  warning?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

const AdminDashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lang, toggleLang, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '' });
  const [statsLoading, setStatsLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [stats, setStats] = useState({
    totalComponents: 0,
    activeLoans: 0,
    overdueLoans: 0,
    activeCamps: 0,
    pendingRequests: 0,
    recentActivity: [] as RecentActivity[],
    topItems: [] as TopItem[]
  });

  // إضافية للـ sidebar badges
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiredBatchCount, setExpiredBatchCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [pendingItemReqs, setPendingItemReqs] = useState(0);

  const isSuperAdmin = user?.role === 'مشرف' || user?.role?.toLowerCase() === 'admin';

  const navItems = [
    { id: 'dashboard' as Tab, label: t('لوحة التحكم', 'Dashboard'), icon: LayoutDashboard, perm: 'dashboard:view' },
    { id: 'inventory' as Tab, label: t('المخزون', 'Inventory'), icon: Package, perm: 'inventory:view' },
    { id: 'locations' as Tab, label: t('خريطة المعمل', 'Lab Map'), icon: Map, perm: 'locations:view' },
    { id: 'loans' as Tab, label: t('العهد', 'Loans'), icon: ClipboardList, perm: 'loans:view' },
    { id: 'boxes' as Tab, label: t('البوكسات', 'Boxes'), icon: BoxIcon, perm: 'loans:view' },
    { id: 'requests' as Tab, label: t('الطلبات', 'Requests'), icon: ShoppingBag, perm: 'requests:view' },
    { id: 'item-requests' as Tab, label: t('طلبات قطع جديدة', 'Item Requests'), icon: Sparkles, perm: 'requests:view' },
    ...(hasPermission('camps:view') ? [
      { id: 'camps' as Tab, label: t('المعسكرات', 'Camps'), icon: Tent, perm: 'camps:view' },
    ] : []),
    ...(hasPermission('students:view') ? [
      { id: 'students' as Tab, label: t('المستخدمون', 'Users'), icon: Users, perm: 'students:view' },
    ] : []),
    ...(hasPermission('batches:view') ? [
      { id: 'batches' as Tab, label: t('الدفعات', 'Batches'), icon: BookOpen, perm: 'batches:view' },
    ] : []),
    ...(hasPermission('permissions:manage') ? [
      { id: 'permissions' as Tab, label: t('الصلاحيات', 'Permissions'), icon: Shield, perm: 'permissions:manage' },
    ] : []),
    ...(hasPermission('audit:view') ? [
      { id: 'audit' as Tab, label: t('سجل النظام', 'Audit Logs'), icon: Activity, perm: 'audit:view' },
    ] : []),
  ];

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [statsRes, lowStockRes, batchesRes, maintenanceRes, itemReqsRes] = await Promise.allSettled([
        fetch(apiUrl('/api/stats')),
        fetch(apiUrl('/api/admin/low-stock')),
        fetch(apiUrl('/api/admin/batches')),
        fetch(apiUrl('/api/maintenance')),
        fetch(apiUrl('/api/item-requests?status=pending')),
      ]);

      let newStats = { totalComponents: 0, activeLoans: 0, overdueLoans: 0, activeCamps: 0, pendingRequests: 0, recentActivity: [] as RecentActivity[], topItems: [] as TopItem[] };
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const d = await statsRes.value.json();
        if (d.status === 'success') newStats = { ...d.data, topItems: d.data.topItems || [] };
      }
      setStats(newStats);

      // قطع المخزون المنخفض / المنتهي
      let lowStock = 0;
      if (lowStockRes.status === 'fulfilled' && lowStockRes.value.ok) {
        const d = await lowStockRes.value.json();
        lowStock = (d.data || []).length;
        setLowStockCount(lowStock);
      }

      // دفعات منتهية الصلاحية
      let expiredBatches = 0;
      if (batchesRes.status === 'fulfilled' && batchesRes.value.ok) {
        const d = await batchesRes.value.json();
        expiredBatches = (d.data || []).filter((b: { expires_at: string | null }) =>
          b.expires_at && new Date(b.expires_at) < new Date()
        ).length;
        setExpiredBatchCount(expiredBatches);
      }

      // قطع تحت الصيانة
      let maintenance = 0;
      if (maintenanceRes.status === 'fulfilled' && maintenanceRes.value.ok) {
        const d = await maintenanceRes.value.json();
        maintenance = (d.data || []).length;
        setMaintenanceCount(maintenance);
      }

      // طلبات القطع الجديدة المعلّقة
      let pendingItemRequests = 0;
      if (itemReqsRes.status === 'fulfilled' && itemReqsRes.value.ok) {
        const d = await itemReqsRes.value.json();
        pendingItemRequests = (d.data || []).length;
        setPendingItemReqs(pendingItemRequests);
      }

      // بناء قائمة التنبيهات
      const built: AppNotification[] = [];
      if (newStats.overdueLoans > 0)
        built.push({ id: 'overdue', type: 'critical', icon: AlertTriangle, title: t('عهود متأخرة', 'Overdue Loans'), description: t(`${newStats.overdueLoans} عهدة تجاوزت موعد الإرجاع`, `${newStats.overdueLoans} loan(s) past due date`), count: newStats.overdueLoans, tab: 'loans' });
      if (newStats.pendingRequests > 0)
        built.push({ id: 'requests', type: 'warning', icon: ShoppingBag, title: t('طلبات معلقة', 'Pending Requests'), description: t(`${newStats.pendingRequests} طلب ينتظر المراجعة`, `${newStats.pendingRequests} request(s) awaiting review`), count: newStats.pendingRequests, tab: 'requests' });
      if (lowStock > 0)
        built.push({ id: 'lowstock', type: 'warning', icon: Package, title: t('مخزون منخفض', 'Low Stock'), description: t(`${lowStock} قطعة وصلت لحد التنبيه`, `${lowStock} item(s) below threshold`), count: lowStock, tab: 'inventory' });
      if (expiredBatches > 0)
        built.push({ id: 'batches', type: 'warning', icon: BookOpen, title: t('دفعات منتهية', 'Expired Batches'), description: t(`${expiredBatches} دفعة انتهت صلاحيتها`, `${expiredBatches} batch(es) have expired`), count: expiredBatches, tab: 'batches' });
      if (maintenance > 0)
        built.push({ id: 'maintenance', type: 'info', icon: Wrench, title: t('قطع تحت الصيانة', 'Under Maintenance'), description: t(`${maintenance} قطعة قيد الصيانة`, `${maintenance} item(s) under maintenance`), count: maintenance, tab: 'inventory' });
      if (pendingItemRequests > 0)
        built.push({ id: 'item-requests', type: 'warning', icon: Sparkles, title: t('طلبات قطع جديدة', 'New Item Requests'), description: t(`${pendingItemRequests} طلب قطعة جديدة ينتظر`, `${pendingItemRequests} new item request(s) pending`), count: pendingItemRequests, tab: 'item-requests' });

      setNotifications(built);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // جلب الإحصائيات عند تحميل الصفحة وعند العودة للـ Dashboard
  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { if (activeTab === 'dashboard') fetchStats(); }, [activeTab]);

  const handleResetTopItems = async () => {
    if (!confirm(t('هل أنت متأكد من تصفير إحصائيات "القطع الأكثر طلباً"؟ لا يمكن التراجع عن هذا الإجراء.', 'Are you sure you want to reset the "Top Requested Items" stats? This cannot be undone.'))) return;
    try {
      const res = await fetch(apiUrl('/api/stats/reset-top-items'), { method: 'POST' });
      if (res.ok) {
        toast({ title: t('تم التصفير بنجاح 🔄', 'Reset Successful 🔄') });
        setStats(prev => ({ ...prev, topItems: [] }));
      }
    } catch {
      toast({ title: t('خطأ في الاتصال', 'Connection Error'), variant: 'destructive' });
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const handleChangePassword = async () => {
    if (!passwords.old || !passwords.new) return;
    try {
      const res = await fetch(apiUrl('/api/users/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: user?.id, oldPassword: passwords.old, newPassword: passwords.new })
      });
      if (res.ok) {
        toast({ title: t('تم التغيير بنجاح ✅', 'Changed Successfully ✅') });
        setPasswordOpen(false); setPasswords({ old: '', new: '' });
      } else {
        toast({ title: t('تنبيه', 'Warning'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Error'), variant: 'destructive' });
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'inventory': return <AdminInventory />;
      case 'locations': return <AdminLocations />;
      case 'loans': return <AdminLoans />;
      case 'students': return <AdminStudents />;
      case 'camps': return <AdminCamps />;
      case 'requests': return <AdminRequests />;
      case 'audit': return <AdminAuditLogs />;
      case 'batches': return <AdminBatches />;
      case 'permissions': return <AdminPermissions />;
      case 'item-requests': return <AdminItemRequests />;
      case 'boxes': return <AdminBoxes />;
      default: return (
        <DashboardHome
          {...stats}
          t={t}
          lang={lang}
          userName={user?.name}
          userRole={user?.role}
          onResetStats={handleResetTopItems}
          onNavigate={setActiveTab}
          onRefresh={fetchStats}
          loading={statsLoading}
          notifications={notifications}
        />
      );
    }
  };

  return (
    <div className={`flex min-h-screen font-sans ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed top-0 ${lang === 'ar' ? 'right-0 border-l' : 'left-0 border-r'} h-full w-64 bg-slate-900 text-white z-30 transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')
      } lg:relative lg:translate-x-0 lg:z-auto flex flex-col`}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl p-4 mb-1 shadow-2xl border border-white/20">
              <img src={ACADEMY_LOGO_URL} alt="Tuwaiq Logo" className="w-full h-full object-contain"/>
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none">{t('ادارة المعمل', 'Engineering Lab')}</h2>
              <p className="text-slate-400 text-xs mt-0.5">{t('لوحة المشرف', 'Admin Panel')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <Button onClick={toggleLang} className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
            <Languages className="w-4 h-4" /> {lang === 'ar' ? 'English' : 'عربي'}
          </Button>

          {navItems.map(item => {
            const Icon = item.icon;
            // ✅ الـ badge للعهد المتأخرة + الطلبات المعلقة
            const badge = item.id === 'loans'          ? stats.overdueLoans
              : item.id === 'requests'      ? stats.pendingRequests
              : item.id === 'inventory'     ? lowStockCount + maintenanceCount
              : item.id === 'batches'       ? expiredBatchCount
              : item.id === 'item-requests' ? pendingItemReqs
              : 0;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white font-bold shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
                {badge > 0 && (
                  <span className={`${lang === 'ar' ? 'mr-auto' : 'ml-auto'} bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-sm animate-pulse`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-slate-700 flex items-center justify-center text-white text-sm font-bold shadow-inner">
              {user?.name?.charAt(0) || 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white break-words leading-tight">{user?.name || t('مشرف النظام', 'System Admin')}</p>
              <p className="text-slate-400 text-[10px] font-mono mt-0.5">{user?.id}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <button onClick={() => setPasswordOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-blue-600/20 hover:text-blue-400 transition-colors">
              <KeyRound className="w-4 h-4" /> {t('تغيير كلمة المرور', 'Change Password')}
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" /> {t('تسجيل الخروج', 'Logout')}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm transition-colors">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-md transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-black text-2xl text-slate-800 dark:text-white">
              {navItems.find(n => n.id === activeTab)?.label || t('لوحة التحكم', 'Dashboard')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* زر تحديث */}
            {activeTab === 'dashboard' && (
              <button onClick={fetchStats} disabled={statsLoading}
                className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                title={t('تحديث الإحصائيات', 'Refresh Stats')}>
                <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-300 ${statsLoading ? 'animate-spin' : ''}`}/>
              </button>
            )}

            {/* الوضع الليلي */}
            <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400"/> : <Moon className="w-5 h-5 text-slate-600"/>}
            </button>

            {/* 🔔 جرس التنبيهات */}
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)}
                className={`relative p-2.5 rounded-full transition-colors ${notifications.length > 0 ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'}`}>
                <Bell className={`w-5 h-5 ${notifications.length > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}/>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-md">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* قائمة التنبيهات */}
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}/>
                  <div className={`absolute top-12 ${lang === 'ar' ? 'left-0' : 'right-0'} z-50 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden`}>
                    {/* رأس القائمة */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300"/>
                        <span className="font-black text-sm text-slate-800 dark:text-white">{t('التنبيهات', 'Notifications')}</span>
                        {notifications.length > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{notifications.length}</span>
                        )}
                      </div>
                      <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X className="w-4 h-4"/>
                      </button>
                    </div>

                    {/* قائمة التنبيهات */}
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                          <Bell className="w-10 h-10 opacity-20 mb-2"/>
                          <p className="text-sm font-bold">{t('لا توجد تنبيهات', 'No notifications')}</p>
                          <p className="text-xs mt-1 opacity-70">{t('كل شيء يسير بشكل طبيعي ✅', 'Everything is running smoothly ✅')}</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {notifications.map(n => {
                            const NIcon = n.icon;
                            const colors = n.type === 'critical'
                              ? { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-500', badge: 'bg-red-500', border: 'border-r-4 border-red-400', hover: 'hover:bg-red-50/80 dark:hover:bg-red-900/30' }
                              : n.type === 'warning'
                              ? { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-500', badge: 'bg-orange-500', border: 'border-r-4 border-orange-400', hover: 'hover:bg-orange-50/80 dark:hover:bg-orange-900/30' }
                              : { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-500', badge: 'bg-blue-500', border: 'border-r-4 border-blue-400', hover: 'hover:bg-blue-50/80 dark:hover:bg-blue-900/30' };
                            return (
                              <button key={n.id} onClick={() => { setActiveTab(n.tab); setNotifOpen(false); }}
                                className={`w-full text-start flex items-center gap-3 px-4 py-3.5 transition-colors ${colors.hover} ${colors.border}`}>
                                <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
                                  <NIcon className={`w-4.5 h-4.5 ${colors.icon}`}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-black text-slate-800 dark:text-slate-200">{n.title}</p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.description}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`${colors.badge} text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center`}>{n.count}</span>
                                  <ChevronRight className={`w-3.5 h-3.5 text-slate-300 ${lang === 'ar' ? 'rotate-180' : ''}`}/>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(apiUrl('/api/admin/send-daily-digest'), {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'admin-id': user?.id || '', 'admin-name': user?.name || '' },
                              body: JSON.stringify({ target: 'self' }),
                            });
                            const data = await res.json();
                            toast({ title: res.ok ? (data.message || t('تم الإرسال', 'Sent')) : (data.message || t('فشل الإرسال', 'Failed')), variant: res.ok ? 'default' : 'destructive' });
                          } catch {
                            toast({ title: t('خطأ في الاتصال', 'Connection error'), variant: 'destructive' });
                          }
                          setNotifOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        <Mail className="w-3 h-3"/>
                        {t('أرسل الملخص اليومي الآن', 'Send daily digest now')}
                      </button>
                      {notifications.length > 0 && (
                        <button onClick={() => { fetchStats(); setNotifOpen(false); }}
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          <RefreshCw className="w-3 h-3"/>
                          {t('تحديث التنبيهات', 'Refresh notifications')}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-slate-50/50 dark:bg-slate-950 transition-colors">
          {renderContent()}
        </main>
      </div>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="max-w-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-blue-600 flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> {t('تغيير كلمة المرور', 'Change Password')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-slate-600 dark:text-slate-300 font-bold">{t('كلمة المرور الحالية', 'Current Password')}</Label>
              <Input type="password" value={passwords.old} onChange={e => setPasswords(p => ({ ...p, old: e.target.value }))} className="font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-600 dark:text-slate-300 font-bold">{t('كلمة المرور الجديدة', 'New Password')}</Label>
              <Input type="password" value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} className="font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white" dir="ltr" />
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setPasswordOpen(false)} className="w-full sm:w-auto font-bold dark:border-slate-700 dark:text-slate-300">{t('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleChangePassword} disabled={!passwords.old || !passwords.new} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-bold shadow-sm">
              {t('حفظ التغييرات', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DashboardHome = ({ totalComponents, activeLoans, overdueLoans, activeCamps, pendingRequests, recentActivity, topItems, t, onResetStats, onNavigate, onRefresh, loading, lang, userName, userRole, notifications }: DashboardHomeProps) => {
  const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1'];

  const hour = new Date().getHours();
  const greeting = lang === 'ar'
    ? hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور'
    : hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const hasAlerts = notifications.length > 0;

  return (
    <div className="space-y-5">

      {/* ===== لافتة الترحيب ===== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        {/* خلفية زخرفية */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full bg-blue-400"/>
          <div className="absolute bottom-[-30px] left-[20%] w-32 h-32 rounded-full bg-purple-400"/>
        </div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-blue-300 text-sm font-bold mb-1">👋 {greeting}</p>
            <h2 className="text-2xl font-black text-white">{userName || t('مشرف النظام', 'System Admin')}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs font-bold bg-blue-500/30 text-blue-200 px-2.5 py-1 rounded-full border border-blue-500/30">{userRole}</span>
              <span className="text-slate-400 text-xs">{dateStr}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${hasAlerts ? 'bg-red-500/20 border border-red-500/30 text-red-300' : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'}`}>
              <span className={`w-2 h-2 rounded-full ${hasAlerts ? 'bg-red-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`}/>
              {hasAlerts ? t('يوجد تنبيهات تحتاج مراجعة', 'Alerts need attention') : t('النظام يعمل بشكل طبيعي', 'System running normally')}
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}
              className="h-8 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/>
              {t('تحديث', 'Refresh')} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== بطاقات الإحصائيات ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Archive}       label={t('إجمالي القطع', 'Total Items')}      value={totalComponents} color="text-blue-600"   bg="bg-blue-50 dark:bg-blue-900/20"   border="border-blue-100 dark:border-blue-900"   loading={loading} onClick={() => onNavigate('inventory')} />
        <StatCard icon={ClipboardList} label={t('العهد النشطة', 'Active Loans')}     value={activeLoans}     color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" border="border-emerald-100 dark:border-emerald-900" loading={loading} onClick={() => onNavigate('loans')} />
        <StatCard icon={AlertTriangle} label={t('عهود متأخرة', 'Overdue Loans')}     value={overdueLoans}    color="text-red-600"     bg="bg-red-50 dark:bg-red-900/20"     border="border-red-100 dark:border-red-900"     loading={loading} warning={overdueLoans > 0} onClick={() => onNavigate('loans')} />
        <StatCard icon={Tent}          label={t('معسكرات', 'Camps')}                 value={activeCamps}     color="text-purple-600"  bg="bg-purple-50 dark:bg-purple-900/20"  border="border-purple-100 dark:border-purple-900"  loading={loading} onClick={() => onNavigate('camps')} />
        <StatCard icon={ShoppingBag}   label={t('طلبات معلقة', 'Pending Requests')}  value={pendingRequests} color="text-orange-600"  bg="bg-orange-50 dark:bg-orange-900/20"  border="border-orange-100 dark:border-orange-900"  loading={loading} warning={pendingRequests > 0} onClick={() => onNavigate('requests')} />
      </div>

      {/* ===== شريط التنبيهات الذكي ===== */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {notifications.map(n => {
            const NIcon = n.icon;
            const styles = n.type === 'critical'
              ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : n.type === 'warning'
              ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
              : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
            return (
              <button key={n.id} onClick={() => onNavigate(n.tab)}
                className={`flex items-center gap-2 border px-3.5 py-2 rounded-xl text-xs font-black transition-all hover:shadow-sm group ${styles}`}>
                <NIcon className="w-3.5 h-3.5"/>
                {n.title}
                <span className="bg-current/20 text-current font-black text-[10px] px-1.5 py-0.5 rounded-full opacity-80">{n.count}</span>
                <ChevronRight className={`w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity ${lang === 'ar' ? 'rotate-180' : ''}`}/>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== الرسم البياني + سجل الأنشطة ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* الرسم البياني */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900 rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="pb-3 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
              <BarChart3 className="w-5 h-5 text-blue-600"/>
              {t('القطع الأكثر طلباً', 'Most Requested Items')}
              <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Top 5</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onResetStats}
              className="h-8 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5"/>
              {t('تصفير', 'Reset')}
            </Button>
          </CardHeader>
          <CardContent className="pt-6 flex-1 min-h-[300px] bg-slate-50/30 dark:bg-slate-900/50">
            {loading ? (
              <div className="h-full flex flex-col gap-3 justify-center px-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }}/>
                  </div>
                ))}
              </div>
            ) : topItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 className="w-12 h-12 mb-2 opacity-20"/>
                <p className="text-sm font-bold">{t('لا توجد بيانات كافية للرسم', 'Not enough data for chart')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                  <Tooltip
                    cursor={{ fill: '#f1f5f9', radius: 8 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)', padding: '10px 14px' }}
                    labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '4px', fontSize: '13px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} name={t('عدد الطلبات', 'Requests')}>
                    {topItems.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* سجل الأنشطة */}
        <Card className="col-span-1 shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900 rounded-2xl overflow-hidden flex flex-col h-[420px]">
          <CardHeader className="pb-3 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
              <Clock className="w-5 h-5 text-blue-600"/>
              {t('سجل الأنشطة', 'Activity Log')}
              {!loading && recentActivity.length > 0 && (
                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{recentActivity.length}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-0 flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0"/>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4"/>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2"/>
                    </div>
                    <div className="w-12 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Clock className="w-10 h-10 opacity-20 mb-2"/>
                <p className="text-sm font-bold">{t('لا توجد نشاطات حديثة', 'No recent activities')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentActivity.map((loan, idx) => {
                  const isOverdue = loan.status === 'متأخر' || loan.status === 'Overdue';
                  const isActive  = loan.status === 'نشط'   || loan.status === 'Active';
                  const initial   = loan.studentName?.charAt(0) || '?';
                  return (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-r-4 ${
                      isOverdue ? 'border-red-400' : isActive ? 'border-emerald-400' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                          : isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>{initial}</div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{loan.studentName}</p>
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 truncate mt-0.5">
                          <Package className="w-3 h-3 text-blue-400 shrink-0"/>
                          <span className="truncate">{loan.componentName}</span>
                        </p>
                      </div>

                      {/* Status + Date */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border ${
                          isOverdue  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                            : isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>{loan.status}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{loan.borrowDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Developer Footer */}
      <div className="mt-16">
        <DeveloperFooter variant="full" />
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, bg, border, warning, loading, onClick }: StatCardProps) => (
  <Card
    onClick={onClick}
    className={`shadow-sm rounded-2xl transition-all duration-300 dark:bg-slate-900 border ${
      onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md active:scale-95' : ''
    } ${warning ? 'border-red-300 ring-2 ring-red-100 dark:ring-red-900/50 dark:border-red-800' : border}`}
  >
    <CardContent className="p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0 shadow-inner`}>
        <Icon className={`w-6 h-6 ${color}`}/>
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <>
            <div className="h-7 w-14 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse mb-1"/>
            <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"/>
          </>
        ) : (
          <>
            <p className={`text-3xl font-black tracking-tight leading-none ${color} ${warning ? 'animate-pulse' : ''}`}>{value}</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{label}</p>
          </>
        )}
      </div>
      {warning && !loading && (
        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0"/>
      )}
    </CardContent>
  </Card>
);

export default AdminDashboard;