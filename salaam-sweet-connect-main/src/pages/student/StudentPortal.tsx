import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Moon, Sun, Search, Package, LogOut, ShoppingCart, ClipboardList, Plus, Languages, Eye, AlertTriangle, Zap, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { apiUrl } from '@/lib/api';
import DeveloperFooter from '@/components/DeveloperFooter';

const ACADEMY_LOGO_URL = "https://tuwaiq.edu.sa/img/logo-v2/logo.webp"
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

  const [items, setItems] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [user, setUser] = useState<{name: string, id: string}>({ name: '', id: '' });
  const [cartOpen, setCartOpen] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [cartNote, setCartNote] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];

  // ✅ متغيرات الإشعار
  const [hasNotification, setHasNotification] = useState(false);
  const [activityCount, setActivityCount] = useState(0);

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
    checkActivityNotification(parsedUser.id); // ✅ فحص الإشعارات عند الدخول
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

  // ✅ دالة فحص الإشعارات (لإظهار النقطة الحمراء)
  const checkActivityNotification = async (userId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/student/my-requests/${userId}`));
      if (res.ok) {
        const data = await res.json();
        const reqCount = data.data.requests.length;
        const loanCount = data.data.loans.length;
        const totalItems = reqCount + loanCount;

        const seenCount = parseInt(localStorage.getItem(`seen_activity_${userId}`) || '0');

        // إذا كان هناك عناصر جديدة، أو عهدة متأخرة دائماً يظهر التنبيه
        const hasOverdue = data.data.loans.some((l: any) => l.status === 'متأخر' || l.status === 'Overdue');
        if (totalItems > seenCount || hasOverdue) {
          setHasNotification(true);
        }
        setActivityCount(totalItems);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ✅ دالة الانتقال ومسح الإشعار
  const handleActivityClick = () => {
    if (user.id) {
      localStorage.setItem(`seen_activity_${user.id}`, activityCount.toString());
      setHasNotification(false);
    }
    navigate('/student/loans');
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
      if (res.ok) {
        const resData = await res.json();
        const autoApproved = resData.request_status === 'approved';
        toast({
          title: autoApproved
            ? t('تمت الموافقة التلقائية ✅', 'Auto-approved ✅')
            : t('تم إرسال الطلب ✅', 'Request submitted ✅'),
          description: autoApproved
            ? t('دفعتك تملك موافقة تلقائية — طلبك مقبول مباشرة!', 'Your batch has auto-approval — request accepted instantly!')
            : t('طلبك الآن قيد المراجعة من المشرف', 'Your request is under review'),
        });
        clearCart();
        setCartOpen(false);
        setReturnDate('');
        setCartNote('');
        checkActivityNotification(user.id);
        // الانتقال التلقائي لصفحة طلباتي بعد الإرسال
        setTimeout(() => navigate('/student/loans'), 800);
      }
    } catch (error) {
      toast({ title: t('خطأ في الإرسال', 'Submission error'), variant: 'destructive' });
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

  return (
    <div className={`min-h-screen font-sans pb-20 transition-colors ${theme === 'dark' ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-blue-100 dark:border-slate-700 p-1">
              <img src={ACADEMY_LOGO_URL} alt="Academy Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 dark:text-white leading-none">{t('أكاديمية طويق', 'Tuwaiq Academy')}</h1>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{t('بوابة المتدرب', 'Student Portal')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-inner">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            <Button onClick={toggleLang} variant="outline" size="sm" className="font-bold gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
              <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'English' : 'عربي'}</span>
            </Button>

            {/* زر طلب قطعة جديدة */}
            <Button
              variant="outline"
              onClick={() => navigate('/student/item-requests')}
              className="font-bold text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 shadow-sm transition-colors"
            >
              <Sparkles className={`w-4 h-4 ${lang === 'ar' ? 'ml-1.5' : 'mr-1.5'}`} />
              <span className="hidden sm:inline">{t('طلب قطعة جديدة', 'Request Item')}</span>
            </Button>

            {/* ✅ زر طلباتي وعهدي مع الإشعار الذكي */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={handleActivityClick}
                className="font-bold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
              >
                <ClipboardList className={`w-4 h-4 ${lang === 'ar' ? 'ml-1.5' : 'mr-1.5'}`} />
                <span className="hidden sm:inline">{t('طلباتي وعهدي', 'My Activity')}</span>
              </Button>
              {hasNotification && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm"></span>
              )}
            </div>

            <Button
              onClick={() => setCartOpen(true)}
              className="relative font-bold bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 shadow-md transition-transform active:scale-95 text-white"
            >
              <ShoppingCart className={`w-4 h-4 ${lang === 'ar' ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('السلة', 'Cart')}
              {totalCartItems > 0 && (
                <span className={`absolute -top-2 ${lang === 'ar' ? '-right-2' : '-left-2'} bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-sm animate-in zoom-in`}>
                  {totalCartItems}
                </span>
              )}
            </Button>

            <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/'); }} className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 ml-1">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-800 dark:from-slate-800 dark:via-blue-900 dark:to-indigo-950 rounded-3xl p-8 sm:p-10 mb-6 text-white shadow-xl relative overflow-hidden transition-colors">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black mb-2 drop-shadow-md">{t('مرحباً بك،', 'Welcome,')} {user.name} 👋</h2>
            <p className="text-blue-200 font-mono text-xs mb-3 opacity-80">{user.id}</p>
            <p className="text-blue-100 dark:text-blue-200 font-medium text-lg leading-relaxed drop-shadow-sm">{t('تصفح الكتالوج الهندسي واطلب القطع التي تحتاجها لمشروعك بضغطة زر. نحن هنا لدعم ابتكارك.', 'Browse the engineering catalog and request items for your project with a single click. We are here to support your innovation.')}</p>
            {/* شارات صلاحيات الدفعة */}
            <div className="flex flex-wrap gap-2 mt-4">
              {authUser?.auto_approve && (
                <span className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/40 text-amber-200 px-3 py-1 rounded-full text-xs font-bold">
                  <Zap className="w-3.5 h-3.5" /> {t('موافقة فورية مفعّلة', 'Auto-approval ON')}
                </span>
              )}
              {authUser?.can_borrow === false && (
                <span className="inline-flex items-center gap-1.5 bg-red-400/20 border border-red-400/40 text-red-200 px-3 py-1 rounded-full text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t('الاستعارة مغلقة لدفعتك', 'Borrowing disabled')}
                </span>
              )}
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
             <div className="absolute -top-24 -right-24 w-64 h-64 bg-white rounded-full blur-3xl"></div>
             <div className="absolute bottom-[-50px] left-[-50px] w-80 h-80 bg-indigo-400 rounded-full blur-3xl"></div>
          </div>
        </div>

        {/* ⚠️ بانر تحذير إذا كانت الاستعارة مغلقة */}
        {authUser?.can_borrow === false && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-2xl p-4 mb-6 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <p className="font-bold text-red-700 dark:text-red-400 text-sm">
              {t('دفعتك لا تملك صلاحية الاستعارة حالياً — تواصل مع المشرف لمزيد من المعلومات.', 'Your batch is not allowed to borrow items currently — contact the supervisor for more info.')}
            </p>
          </div>
        )}

        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8 space-y-4 sticky top-20 z-30 transition-all hover:shadow-md">
          <div className="relative">
            <Search className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500`} />
            <Input
              placeholder={t('ابحث عن قطعة (مثال: Arduino, حساس الحرارة)...', 'Search for an item (e.g. Arduino, Temp Sensor)...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${lang === 'ar' ? 'pr-12' : 'pl-12'} text-md py-6 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-white focus-visible:ring-blue-500 rounded-xl font-medium transition-colors`}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm ${
                  selectedCategory === cat 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-600/20 ring-offset-2 dark:ring-offset-slate-900 scale-105' 
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {cat === 'All' ? t('الكل', 'All') : cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm transition-colors">
            <Package className="w-20 h-20 mx-auto mb-5 text-slate-300 dark:text-slate-600" />
            <p className="text-xl font-black text-slate-600 dark:text-slate-300">{t('لم نجد أي قطعة تطابق بحثك', 'No matching items found')}</p>
            <p className="text-slate-400 dark:text-slate-500 font-medium mt-2">{t('جرب البحث بكلمات أخرى أو اختر تصنيفاً مختلفاً', 'Try searching with different keywords or select another category')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item, index) => {
              const inCart = cart.find(c => getNameAr(c.component) === getNameAr(item));
              return (
                <Card key={index} className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-slate-200 dark:border-slate-800 group rounded-2xl flex flex-col h-full bg-white dark:bg-slate-900">
                  <div
                    className="aspect-[4/3] bg-slate-50 dark:bg-slate-800/50 relative flex items-center justify-center border-b border-slate-100 dark:border-slate-800 cursor-pointer overflow-hidden group/img transition-colors"
                    onClick={() => navigate(`/student/item`, { state: { item } })}
                  >
                    <img src={item.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} alt={displayCompName(item)} className="object-contain w-full h-full p-8 group-hover/img:scale-110 transition-transform duration-500 drop-shadow-sm" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} />
                    <div className="absolute inset-0 bg-blue-900/10 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                       <span className="bg-white/95 text-blue-700 px-5 py-2.5 rounded-full font-black text-sm shadow-xl transform translate-y-4 group-hover/img:translate-y-0 transition-all duration-300 flex items-center gap-2">
                         <Eye className="w-4 h-4" /> {t('عرض التفاصيل', 'View Details')}
                       </span>
                    </div>
                    <div className={`absolute top-3 ${lang === 'ar' ? 'left-3' : 'right-3'} px-3 py-1.5 rounded-lg text-[11px] font-black border shadow-sm z-10 backdrop-blur-md ${item.quantity > 5 ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-900/90 dark:text-emerald-300 dark:border-emerald-800' : item.quantity > 0 ? 'bg-orange-50/90 text-orange-700 border-orange-200 dark:bg-orange-900/90 dark:text-orange-300 dark:border-orange-800' : 'bg-red-50/90 text-red-700 border-red-200 dark:bg-red-900/90 dark:text-red-300 dark:border-red-800'}`}>
                      {item.quantity > 5 ? `${t('متوفر بقوة:', 'In Stock:')} ${item.quantity}` : item.quantity > 0 ? `${t('باقي القليل:', 'Low Stock:')} ${item.quantity}` : t('نفذت الكمية', 'Out of Stock')}
                    </div>
                  </div>

                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="mb-4">
                      <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 px-2.5 py-1 rounded w-fit mb-2.5 border border-blue-100 dark:border-blue-900 uppercase tracking-wide transition-colors">{lang === 'ar' ? getCatAr(item) : getCatEn(item)}</div>
                      <h3
                        className="font-black text-slate-800 dark:text-white text-lg line-clamp-2 leading-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title={displayCompName(item)}
                        onClick={() => navigate(`/student/item`, { state: { item } })}
                      >
                        {displayCompName(item)}
                      </h3>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 transition-colors">
                      {inCart ? (
                        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-1.5 shadow-inner transition-colors" dir="ltr">
                          <button onClick={() => updateCartQty(getNameAr(item), inCart.quantity - 1)} className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center font-black text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">−</button>
                          <span className="font-black text-blue-800 dark:text-blue-400 text-lg">{inCart.quantity}</span>
                          <button onClick={() => updateCartQty(getNameAr(item), inCart.quantity + 1)} disabled={inCart.quantity >= item.quantity} className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center font-black text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">+</button>
                        </div>
                      ) : (
                        <Button
                          className="w-full font-bold shadow-md hover:shadow-lg transition-all"
                          disabled={item.quantity <= 0 || authUser?.can_borrow === false}
                          onClick={() => {
                            const success = addToCart(item);
                            if (success) toast({ title: t('تمت الإضافة للسلة ✅', 'Added to cart ✅') });
                            else toast({ title: t('الكمية غير متوفرة', 'Quantity not available'), variant: 'destructive' });
                          }}
                          variant={item.quantity > 0 && authUser?.can_borrow !== false ? 'default' : 'secondary'}
                        >
                          <Plus className={`w-5 h-5 ${lang === 'ar' ? 'ml-1.5' : 'mr-1.5'}`} />
                          {authUser?.can_borrow === false ? t('الاستعارة مغلقة', 'Borrowing Closed') : item.quantity > 0 ? t('إضافة للسلة', 'Add to Cart') : t('غير متوفر', 'Unavailable')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* نافذة السلة (كما هي) */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle className="text-xl font-black text-blue-700 dark:text-blue-400 flex items-center gap-2"><ShoppingCart className="w-6 h-6" /> {t('سلة الطلبات', 'Your Cart')} ({totalCartItems})</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800"><ShoppingCart className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3"/><p className="text-slate-500 font-bold text-lg">{t('السلة فارغة حالياً', 'Cart is empty')}</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                {cart.map(item => (
                  <div key={getNameAr(item.component)} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group hover:border-blue-300 dark:hover:border-blue-500 transition-all">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-lg p-1.5 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 overflow-hidden"><img src={item.component.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'} className="max-w-full max-h-full object-contain" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/679/679821.png'; }} /></div>
                    <div className="flex-1 min-w-0"><p className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">{displayCompName(item.component)}</p></div>
                    <div className="flex flex-col items-center gap-1.5 bg-blue-50/50 dark:bg-slate-950 border border-blue-100 dark:border-slate-800 rounded-lg p-1.5 shadow-inner shrink-0" dir="ltr">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateCartQty(getNameAr(item.component), item.quantity - 1)} className="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">−</button>
                        <span className="w-5 text-center text-xs font-black text-blue-800 dark:text-blue-400">{item.quantity}</span>
                        <button onClick={() => updateCartQty(getNameAr(item.component), item.quantity + 1)} className="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">+</button>
                      </div>
                      <button onClick={() => updateCartQty(getNameAr(item.component), 0)} className="text-[10px] text-red-500 font-bold hover:underline">{t('إزالة', 'Remove')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {cart.length > 0 && (
              <div className="space-y-3 mt-4">
                <div className="bg-blue-50/80 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors">
                  <Label className="font-black text-blue-900 dark:text-blue-300 mb-2 block text-md">{t('تاريخ الإرجاع المتوقع *', 'Expected Return Date *')}</Label>
                  <Input type="date" value={returnDate} min={todayStr} onChange={e => setReturnDate(e.target.value)} className={`bg-white dark:bg-slate-900 border-blue-300 dark:border-slate-700 font-medium py-5 shadow-inner ${lang === 'ar' ? 'text-right' : 'text-left'} dark:text-white`} />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors">
                  <Label className="font-bold text-slate-700 dark:text-slate-300 mb-2 block text-sm">{t('ملاحظة للمشرف (اختياري)', 'Note to supervisor (optional)')}</Label>
                  <textarea
                    value={cartNote}
                    onChange={e => setCartNote(e.target.value)}
                    placeholder={t('مثال: سأستخدمها في مشروع التخرج...', 'e.g. I need it for my graduation project...')}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setCartOpen(false)} className="w-full sm:w-auto font-bold border-slate-300 dark:border-slate-700 dark:text-white">{t('إكمال التسوق', 'Continue Shopping')}</Button>
            <Button onClick={submitCart} disabled={cart.length === 0 || !returnDate} className={`w-full sm:w-auto font-bold shadow-md px-8 py-5 text-md text-white flex items-center gap-2 ${authUser?.auto_approve ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {authUser?.auto_approve && <Zap className="w-4 h-4" />}
              {authUser?.auto_approve ? t('إرسال — موافقة فورية ⚡', 'Submit — Auto-approved ⚡') : t('إرسال الطلب للمشرف', 'Submit Request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Developer Footer */}
      <DeveloperFooter variant="compact" />
    </div>
  );
};

export default StudentPortal;