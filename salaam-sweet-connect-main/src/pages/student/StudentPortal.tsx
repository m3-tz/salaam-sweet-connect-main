import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { apiUrl } from '@/lib/api';
import {
  Moon, Sun, Search, Package, LogOut, ShoppingCart, ClipboardList, Plus, Languages,
  Eye, AlertTriangle, Zap, Sparkles, Home, Archive, FileText, Menu, X, Bell,
  ChevronLeft, ChevronRight, User, Box as BoxIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import DeveloperFooter from '@/components/DeveloperFooter';
import MyLoansSection from './sections/MyLoansSection';
import ItemRequestsSection from './sections/ItemRequestsSection';
import BoxesSection from './sections/BoxesSection';

const ACADEMY_LOGO_URL = "https://tuwaiq.edu.sa/img/logo-v2/logo.webp";

type Section = 'catalog' | 'boxes' | 'activity' | 'request-item';

interface Device {
  name?: string;
  name_ar?: string;
  name_en?: string;
  quantity: number;
  location: string;
  category?: string;
  category_ar?: string;
  category_en?: string;
  imageUrl: string;
}

const StudentPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { cart, addToCart, updateCartQty, clearCart, totalCartItems } = useCart();

  const [activeSection, setActiveSection] = useState<Section>('catalog');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [user, setUser] = useState<{ name: string, id: string }>({ name: '', id: '' });
  const [cartOpen, setCartOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(() => localStorage.getItem('lab_student_return_date') || '');
  const [cartNote, setCartNote]     = useState(() => localStorage.getItem('lab_student_cart_note') || '');

  useEffect(() => { localStorage.setItem('lab_student_return_date', returnDate); }, [returnDate]);
  useEffect(() => { localStorage.setItem('lab_student_cart_note', cartNote); }, [cartNote]);
  const todayStr = new Date().toISOString().split('T')[0];

  const [hasNotification, setHasNotification] = useState(false);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [activitySig, setActivitySig] = useState('');

  const getNameAr = (c: Device) => c.name_ar || c.name || '';
  const getNameEn = (c: Device) => c.name_en || c.name_ar || c.name || '';
  const displayCompName = (c: Device) => lang === 'ar' ? getNameAr(c) : getNameEn(c);
  const getCatAr = (c: Device) => c.category_ar || c.category || 'عام';
  const getCatEn = (c: Device) => c.category_en || c.category_ar || c.category || 'General';

  useEffect(() => {
    const storedUser = localStorage.getItem('lab_user');
    if (!storedUser) {
      navigate('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    fetchItems();
    checkActivityNotification(parsedUser.id);
  }, [navigate]);

  const fetchItems = async () => {
    try {
      const response = await fetch(apiUrl('/api/items'));
      const data = await response.json();
      if (response.ok) setItems(data.data);
    } catch (err) {
      toast({ title: t('خطأ', 'Error'), description: t('تعذر الاتصال بالخادم', 'Cannot connect to server'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const checkActivityNotification = async (userId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/student/my-requests/${userId}`));
      if (!res.ok) return;
      const data = await res.json();
      const reqs: any[] = data.data.requests || [];
      const loans: any[] = data.data.loans || [];

      // Signature = id+status for every request/loan — changes whenever
      // anything is added, removed, or has its status updated.
      const sigParts = [
        ...reqs.map(r => `r${r.id}:${r.status}`),
        ...loans.map(l => `l${l.id}:${l.status}`),
      ].sort();
      const sig = sigParts.join('|');
      const seenSig = localStorage.getItem(`seen_activity_sig_${userId}`) || '';

      // Unread = items whose (id:status) string did not appear in the last-seen signature
      const seenSet = new Set(seenSig.split('|').filter(Boolean));
      const unread = sigParts.filter(p => !seenSet.has(p)).length;

      setActivitySig(sig);
      setUnreadActivity(unread);
      setHasNotification(unread > 0);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSectionChange = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
    if (section === 'activity' && user.id) {
      localStorage.setItem(`seen_activity_sig_${user.id}`, activitySig);
      setHasNotification(false);
      setUnreadActivity(0);
    }
  };

  const submitCart = async () => {
    if (cart.length === 0 || !returnDate) return;
    try {
      const res = await fetch(apiUrl('/api/student/cart'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          studentName: user.name,
          expectedReturnDate: returnDate,
          note: cartNote.trim() || null,
          items: cart.map(c => ({ name: getNameAr(c.component), qty: c.quantity }))
        })
      });
      const resData = await res.json();
      if (res.ok) {
        const autoApproved = resData.request_status === 'approved';
        toast({
          title: autoApproved ? t('تمت الموافقة التلقائية ✅', 'Auto-approved ✅') : t('تم إرسال الطلب ✅', 'Request submitted ✅'),
          description: autoApproved ? t('دفعتك تملك موافقة تلقائية', 'Auto-approval enabled') : t('طلبك قيد المراجعة', 'Under review'),
        });
        clearCart();
        setCartOpen(false);
        setReturnDate('');
        setCartNote('');
        checkActivityNotification(user.id);
        setTimeout(() => setActiveSection('activity'), 800);
      } else {
        toast({ title: resData.message || t('خطأ في الإرسال', 'Submission error'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('خطأ في الاتصال بالخادم', 'Server connection error'), variant: 'destructive' });
    }
  };

  const allCategoriesAr = ['All', ...Array.from(new Set(items.map(item => getCatAr(item))))];
  const allCategoriesEn = ['All', ...Array.from(new Set(items.map(item => getCatEn(item))))];
  const categories = lang === 'ar' ? allCategoriesAr : allCategoriesEn;

  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = getNameAr(item).toLowerCase().includes(searchLower) || getNameEn(item).toLowerCase().includes(searchLower);
    const matchesCategory = selectedCategory === 'All' || getCatAr(item) === selectedCategory || getCatEn(item) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const navItems = [
    { id: 'catalog' as Section, label: t('المتجر', 'Catalog'), icon: Home, badge: 0 },
    { id: 'boxes' as Section, label: t('البوكسات', 'Boxes'), icon: BoxIcon, badge: 0 },
    { id: 'activity' as Section, label: t('طلباتي وعهدي', 'My Activity'), icon: Archive, badge: hasNotification ? unreadActivity : 0 },
    { id: 'request-item' as Section, label: t('اقتراح قطعة', 'Suggest Item'), icon: Sparkles, badge: 0 },
  ];

  return (
    <div className={`min-h-screen flex transition-colors ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* ─── Sidebar (Desktop) ────────────────────────────────────────── */}
      <aside className={`${
        sidebarOpen ? 'translate-x-0' : lang === 'ar' ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'
      } fixed lg:sticky top-0 ${lang === 'ar' ? 'right-0' : 'left-0'} h-screen w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-300 flex flex-col z-50 lg:z-0 transition-transform duration-300 border-l border-slate-800 shadow-2xl lg:shadow-none`}>
        {/* Logo Header */}
        <div className="px-6 py-5 border-b border-slate-700 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 p-2 flex items-center justify-center">
            <img src={ACADEMY_LOGO_URL} alt="Tuwaiq" className="w-full h-full object-contain filter brightness-0 invert" />
          </div>
          <div>
            <h1 className="font-black text-white text-base">{t('أكاديمية طويق', 'Tuwaiq Academy')}</h1>
            <p className="text-xs font-bold text-blue-400 tracking-widest mt-0.5">{t('بوابة المتدرب', 'STUDENT')}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden mr-auto p-2 rounded-lg hover:bg-slate-800 text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Profile */}
        <div className="px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-sm flex-shrink-0">
              {user.name?.charAt(0) || 'ط'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{user.name || t('طالب', 'Student')}</p>
              <p className="text-xs text-slate-400 truncate font-mono" dir="ltr">{user.id}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {t('القائمة الرئيسية', 'Main Menu')}
          </div>
          {navItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all relative group ${
                  isActive
                    ? 'bg-blue-500/15 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {isActive && (
                  <span className={`absolute ${lang === 'ar' ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full`} />
                )}
                <span className="flex items-center gap-3">
                  <item.icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span>{item.label}</span>
                </span>
                {item.badge > 0 && (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 py-4 border-t border-slate-700 space-y-2">
          {/* Cart Button */}
          <button
            onClick={() => setCartOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-cta"
          >
            <span className="flex items-center gap-3">
              <ShoppingCart size={18} />
              {t('السلة', 'Cart')}
            </span>
            {totalCartItems > 0 && (
              <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-white text-blue-600 text-[10px] font-black flex items-center justify-center">
                {totalCartItems}
              </span>
            )}
          </button>

          {/* Settings Row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={toggleTheme}
              title={t('السمة', 'Theme')}
              className="flex items-center justify-center p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={toggleLang}
              title={t('اللغة', 'Language')}
              className="flex items-center justify-center p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs font-bold"
            >
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>
            <button
              onClick={() => { logout(); navigate('/'); }}
              title={t('خروج', 'Logout')}
              className="flex items-center justify-center p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Main Content ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-black text-base">{navItems.find(n => n.id === activeSection)?.label}</h1>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <ShoppingCart size={20} />
            {totalCartItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {totalCartItems}
              </span>
            )}
          </button>
        </div>

        {/* Section Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* ─── Catalog Section ───────────────────────────────────── */}
          {activeSection === 'catalog' && (
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
              {/* Welcome Hero */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-slate-800 dark:via-blue-900 dark:to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
                <div className="relative z-10 max-w-2xl">
                  <h2 className="text-2xl sm:text-4xl font-black mb-2">
                    {t('مرحباً بك،', 'Welcome,')} {user.name} 👋
                  </h2>
                  <p className="text-blue-100 font-medium leading-relaxed">
                    {t('تصفح الكتالوج الهندسي واطلب القطع التي تحتاجها لمشروعك.', 'Browse the engineering catalog and request items you need for your project.')}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {authUser?.auto_approve && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/40 text-amber-200 px-3 py-1 rounded-full text-xs font-bold">
                        <Zap className="w-3.5 h-3.5" /> {t('موافقة فورية مفعّلة', 'Auto-approval ON')}
                      </span>
                    )}
                    {authUser?.can_borrow === false && (
                      <span className="inline-flex items-center gap-1.5 bg-red-400/20 border border-red-400/40 text-red-200 px-3 py-1 rounded-full text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t('الاستعارة مغلقة', 'Borrowing disabled')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl" />
              </div>

              {/* Search & Filter */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 space-y-4 sticky top-4 z-20">
                <div className="relative">
                  <Search className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400`} />
                  <input
                    type="text"
                    placeholder={t('ابحث عن قطعة (مثال: Arduino, حساس)...', 'Search items (e.g. Arduino, sensor)...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${lang === 'ar' ? 'pr-12' : 'pl-12'} py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white shadow-cta'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat === 'All' ? t('الكل', 'All') : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <Package className="w-20 h-20 mx-auto mb-5 text-slate-300 dark:text-slate-600" />
                  <p className="text-xl font-black">{t('لم نجد أي قطعة', 'No items found')}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">{t('جرب كلمات أخرى', 'Try different keywords')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredItems.map((item, index) => {
                    const inCart = cart.find(c => getNameAr(c.component) === getNameAr(item));
                    return (
                      <div key={index} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                        {/* Image */}
                        <div
                          className="relative aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 cursor-pointer overflow-hidden"
                          onClick={() => navigate('/student/item', { state: { item } })}
                        >
                          <img
                            src={item.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'}
                            alt={displayCompName(item)}
                            className="w-full h-full object-contain p-6 group-hover:scale-110 transition-transform duration-500"
                            onError={e => { e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }}
                          />
                          <div className={`absolute top-3 ${lang === 'ar' ? 'left-3' : 'right-3'} px-2.5 py-1 rounded-lg text-[11px] font-black border backdrop-blur-md ${
                            item.quantity > 5 ? 'bg-emerald-500/90 text-white border-emerald-400' :
                            item.quantity > 0 ? 'bg-amber-500/90 text-white border-amber-400' :
                            'bg-red-500/90 text-white border-red-400'
                          }`}>
                            {item.quantity > 5 ? `${item.quantity} ${t('متوفر', 'avail.')}` : item.quantity > 0 ? `${item.quantity} ${t('باقي', 'left')}` : t('نفذ', 'Out')}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded w-fit mb-2 uppercase tracking-wide">
                            {lang === 'ar' ? getCatAr(item) : getCatEn(item)}
                          </div>
                          <h3
                            onClick={() => navigate('/student/item', { state: { item } })}
                            className="font-black text-slate-800 dark:text-white text-base line-clamp-2 leading-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition mb-3"
                          >
                            {displayCompName(item)}
                          </h3>

                          <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                            {inCart ? (
                              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-1" dir="ltr">
                                <button
                                  onClick={() => updateCartQty(getNameAr(item), inCart.quantity - 1)}
                                  className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center font-black text-slate-600 dark:text-slate-300"
                                >−</button>
                                <span className="font-black text-blue-700 dark:text-blue-400">{inCart.quantity}</span>
                                <button
                                  onClick={() => updateCartQty(getNameAr(item), inCart.quantity + 1)}
                                  disabled={inCart.quantity >= item.quantity}
                                  className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center font-black text-slate-600 dark:text-slate-300 disabled:opacity-40"
                                >+</button>
                              </div>
                            ) : (
                              <button
                                disabled={item.quantity <= 0 || authUser?.can_borrow === false}
                                onClick={() => {
                                  const success = addToCart(item);
                                  if (success) toast({ title: t('تمت الإضافة ✅', 'Added ✅') });
                                }}
                                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                  item.quantity > 0 && authUser?.can_borrow !== false
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-cta'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                <Plus size={16} />
                                {authUser?.can_borrow === false ? t('مغلق', 'Closed') : item.quantity > 0 ? t('أضف للسلة', 'Add to Cart') : t('غير متاح', 'N/A')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Boxes Section ─────────────────────────────────────── */}
          {activeSection === 'boxes' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
              <BoxesSection userId={user.id} userName={user.name} />
            </div>
          )}

          {/* ─── My Activity Section ───────────────────────────────── */}
          {activeSection === 'activity' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
              <MyLoansSection
                userId={user.id}
                userName={user.name}
                onRefresh={() => checkActivityNotification(user.id)}
              />
            </div>
          )}

          {/* ─── Item Requests Section ─────────────────────────────── */}
          {activeSection === 'request-item' && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
              <ItemRequestsSection
                userId={user.id}
                userName={user.name}
              />
            </div>
          )}
        </main>

        {/* Developer Footer */}
        <DeveloperFooter variant="compact" />
      </div>

      {/* ─── Cart Dialog ────────────────────────────────────────────── */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" /> {t('سلة الطلبات', 'Your Cart')} ({totalCartItems})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800">
                <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 font-bold">{t('السلة فارغة', 'Cart is empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2">
                {cart.map(item => (
                  <div key={getNameAr(item.component)} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-lg p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={item.component.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm line-clamp-2 leading-tight">{displayCompName(item.component)}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 bg-blue-50 dark:bg-slate-950 border border-blue-100 dark:border-slate-800 rounded-lg p-1.5 shrink-0" dir="ltr">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateCartQty(getNameAr(item.component), item.quantity - 1)} className="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm flex items-center justify-center font-bold">−</button>
                        <span className="w-5 text-center text-xs font-black text-blue-700 dark:text-blue-400">{item.quantity}</span>
                        <button onClick={() => updateCartQty(getNameAr(item.component), item.quantity + 1)} className="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm flex items-center justify-center font-bold">+</button>
                      </div>
                      <button onClick={() => updateCartQty(getNameAr(item.component), 0)} className="text-[10px] text-red-500 font-bold hover:underline">{t('إزالة', 'Remove')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {cart.length > 0 && (
              <div className="space-y-3 mt-4">
                <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
                  <Label className="font-black text-blue-900 dark:text-blue-300 mb-2 block">{t('تاريخ الإرجاع المتوقع *', 'Expected Return Date *')}</Label>
                  <Input type="date" value={returnDate} min={todayStr} onChange={e => setReturnDate(e.target.value)} className="bg-white dark:bg-slate-900" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 mb-2 block text-sm">{t('ملاحظة (اختياري)', 'Note (optional)')}</Label>
                  <textarea
                    value={cartNote}
                    onChange={e => setCartNote(e.target.value)}
                    placeholder={t('مثال: لمشروع التخرج...', 'e.g. for graduation project...')}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setCartOpen(false)} className="font-bold">{t('إكمال التسوق', 'Continue Shopping')}</Button>
            <Button onClick={submitCart} disabled={cart.length === 0 || !returnDate} className={`font-bold text-white flex items-center gap-2 ${authUser?.auto_approve ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {authUser?.auto_approve && <Zap className="w-4 h-4" />}
              {authUser?.auto_approve ? t('إرسال — موافقة فورية ⚡', 'Submit — Auto-approved ⚡') : t('إرسال الطلب', 'Submit Request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentPortal;
