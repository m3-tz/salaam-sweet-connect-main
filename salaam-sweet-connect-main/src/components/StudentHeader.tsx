import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ShoppingCart, Home, Archive, LogOut, Languages, Moon, Sun, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface StudentHeaderProps {
  cartCount?: number;
  onCartClick?: () => void;
}

export default function StudentHeader({ cartCount = 0, onCartClick }: StudentHeaderProps) {
  const navigate = useNavigate();
  const { t, lang, toggleLang } = useLanguage();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { label: t('المتجر', 'Store'), labelEn: 'Store', icon: Home, path: '/student' },
    { label: t('استعاراتي', 'My Loans'), labelEn: 'My Loans', icon: Archive, path: '/student/loans' },
  ];

  return (
    <header className="header-backdrop sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo/Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-center flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded text-white font-black text-sm flex items-center justify-center">
              {user?.name?.charAt(0) || 'ط'}
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-black text-slate-900 dark:text-white text-lg">{t('معمل الابتكار', 'Innovation Lab')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.name}</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <item.icon size={18} />
              <span>{lang === 'ar' ? item.label : item.labelEn}</span>
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Cart Button */}
          <button
            onClick={onCartClick}
            className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ShoppingCart size={20} className="text-slate-700 dark:text-slate-300" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
          >
            <Languages size={20} />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-sm transition-colors"
          >
            <LogOut size={16} />
            {t('خروج', 'Logout')}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors"
            >
              <item.icon size={18} />
              <span>{lang === 'ar' ? item.label : item.labelEn}</span>
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-bold text-sm transition-colors"
          >
            <LogOut size={18} />
            {t('خروج', 'Logout')}
          </button>
        </div>
      )}
    </header>
  );
}
