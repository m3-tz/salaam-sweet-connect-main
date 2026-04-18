import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Package, ClipboardList, Users, Tent, Shield, Activity, Bell, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

const ACADEMY_LOGO_URL = "https://tuwaiq.edu.sa/img/logo-v2/logo.webp";

interface NavItem {
  id: string;
  label: string;
  labelEn: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

interface AdminSidebarProps {
  pendingCount?: number;
  onNavigate?: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ pendingCount = 0, onNavigate, isOpen = true, onClose }: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useLanguage();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(isOpen);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'لوحة التحكم', labelEn: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
    { id: 'requests', label: 'الطلبات', labelEn: 'Requests', path: '/admin/requests', icon: <ClipboardList size={18} />, badge: pendingCount },
    { id: 'inventory', label: 'المخزون', labelEn: 'Inventory', path: '/admin/inventory', icon: <Package size={18} /> },
    { id: 'loans', label: 'الاستعارات', labelEn: 'Loans', path: '/admin/loans', icon: <Activity size={18} /> },
    { id: 'camps', label: 'المعسكرات', labelEn: 'Camps', path: '/admin/camps', icon: <Tent size={18} /> },
    { id: 'users', label: 'المستخدمون', labelEn: 'Users', path: '/admin/students', icon: <Users size={18} /> },
    { id: 'permissions', label: 'الصلاحيات', labelEn: 'Permissions', path: '/admin/permissions', icon: <Shield size={18} /> },
    { id: 'audit', label: 'السجل', labelEn: 'Audit Log', path: '/admin/audit', icon: <Activity size={18} /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
    onNavigate?.(path);
    if (onClose) onClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const SidebarContent = () => (
    <>
      {/* Logo & Title */}
      <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-700">
        <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <img src={ACADEMY_LOGO_URL} alt="Tuwaiq" className="w-full h-full object-contain filter brightness-0 invert" />
        </div>
        <div>
          <div className="font-black text-white text-sm">{t('أكاديمية طويق', 'Tuwaiq Academy')}</div>
          <div className="text-xs font-bold text-blue-400 tracking-widest">{t('إدارة', 'ADMIN')}</div>
        </div>
      </div>

      {/* Menu Label */}
      <div className="text-xs font-black text-slate-500 uppercase tracking-widest px-3 py-2 mb-3">
        {t('القائمة الرئيسية', 'Main Menu')}
      </div>

      {/* Nav Items */}
      <nav className="space-y-1 px-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isActive(item.path)
                ? 'bg-blue-500/20 text-white border-r-4 border-blue-500'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border-r-4 border-transparent'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={isActive(item.path) ? 'text-blue-400' : 'text-slate-500'}>{item.icon}</span>
              <span>{lang === 'ar' ? item.label : item.labelEn}</span>
            </span>
            {item.badge && item.badge > 0 && (
              <span className="min-w-max h-5 px-2 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="my-4 border-t border-slate-700" />

      {/* User Profile Card */}
      <div className="mx-2 p-3 bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center flex-shrink-0">
            {user?.name?.charAt(0) || 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm truncate">{user?.name || 'Admin'}</div>
            <div className="text-xs text-slate-400">{t('مشرف معمل', 'Lab Manager')}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-bold transition-colors"
        >
          <LogOut size={14} />
          {t('خروج', 'Logout')}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-white hover:bg-slate-700"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:sticky top-0 left-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-l border-slate-800 text-slate-300 flex flex-col gap-2 p-4 overflow-y-auto transition-transform duration-300 z-40 lg:z-0`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
