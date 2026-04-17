import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Package, MapPin, Tag, CheckCircle2, AlertCircle, ShoppingCart, Plus, Minus, Info, Trash2, Sun, Moon, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../../LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import LocationBadge from '@/components/LocationBadge';

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

const ComponentDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme(); // ✅ تفعيل الثيم

  const { user } = useAuth();
  const { cart, addToCart, updateCartQty, totalCartItems } = useCart(); // ✅ جلب عدد عناصر السلة
  const item = location.state?.item as Device;

  // صلاحية رؤية المواقع (افتراضي: مسموح)
  const canViewLocations = user?.can_view_locations !== false;

  const getNameAr = (c: Device) => c.name_ar || c.name || '';
  const getNameEn = (c: Device) => c.name_en || c.name_ar || c.name || '';
  const displayCompName = (c: Device) => lang === 'ar' ? getNameAr(c) : getNameEn(c);
  const getCatAr = (c: Device) => c.category_ar || c.category || 'عام';
  const getCatEn = (c: Device) => c.category_en || c.category_ar || c.category || 'General';

  if (!item) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 font-sans transition-colors ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="text-center max-w-md bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
          <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white dark:border-slate-900 shadow-inner">
             <Package className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">{t('القطعة غير متوفرة', 'Item not found')}</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">{t('يبدو أنه تم تحديث الصفحة أو أن القطعة لم تعد موجودة في المخزون.', 'It seems the page was refreshed or the item is no longer in inventory.')}</p>
          <Button className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-700 font-bold h-12 text-lg shadow-md" onClick={() => navigate('/student')}>
            {t('العودة للكتالوج', 'Back to Catalog')}
          </Button>
        </div>
      </div>
    );
  }

  const available = item.quantity > 0;
  const inCart = cart.find(c => getNameAr(c.component) === getNameAr(item));

  return (
    <div className={`min-h-screen font-sans pb-24 transition-colors ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* 🌟 الهيدر الشفاف والأنيق */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm transition-colors">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors rounded-xl" onClick={() => navigate('/student')}>
              {lang === 'ar' ? <ArrowRight className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
            </Button>
            <h1 className="font-black text-xl text-slate-800 dark:text-white">{t('تفاصيل القطعة', 'Item Details')}</h1>
          </div>

          {/* ✅ أزرار الهيدر (الثيم والسلة) */}
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-inner">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <div className="relative flex items-center justify-center p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 cursor-pointer" onClick={() => navigate('/student')}>
              <ShoppingCart className="w-5 h-5" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
                  {totalCartItems}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 🌟 Breadcrumb (مسار التصفح) */}
        <div className="flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500 mb-6 px-2">
          <span className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={() => navigate('/student')}>{t('الكتالوج', 'Catalog')}</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900 shadow-sm">{lang === 'ar' ? getCatAr(item) : getCatEn(item)}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* 🖼️ 1. منطقة عرض الصورة */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-8 relative flex items-center justify-center aspect-square lg:h-[550px] overflow-hidden group transition-colors">
            {/* خلفية متدرجة خفيفة */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 opacity-80 transition-colors"></div>

            {/* شارة التوفر */}
            <div className={`absolute top-6 ${lang === 'ar' ? 'right-6' : 'left-6'} px-4 py-2 rounded-xl text-sm font-black border shadow-sm z-10 backdrop-blur-md transition-transform hover:scale-105 ${available ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-900/80 dark:text-emerald-300 dark:border-emerald-800' : 'bg-red-50/90 text-red-700 border-red-200 dark:bg-red-900/80 dark:text-red-300 dark:border-red-800'}`}>
              {available ? (
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {t('متاح للطلب', 'Available')}</span>
              ) : (
                <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {t('غير متوفر حالياً', 'Out of Stock')}</span>
              )}
            </div>

            <img
              src={item.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'}
              alt={displayCompName(item)}
              className="relative z-10 max-w-[85%] max-h-[85%] object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500 ease-out"
            />
          </div>

          {/* 📝 2. تفاصيل القطعة */}
          <div className="flex flex-col h-full justify-center">

            <h2 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-white mb-8 leading-tight tracking-tight transition-colors">
              {displayCompName(item)}
            </h2>

            {/* كروت المعلومات المصغرة */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className={`p-5 rounded-2xl border transition-all ${available ? 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-emerald-900 shadow-sm shadow-emerald-100/50 dark:shadow-none' : 'bg-red-50/30 dark:bg-red-900/10 border-red-100 dark:border-red-900'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-inner border ${available ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-500 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}>
                  {available ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t('الكمية المتاحة', 'Stock Available')}</p>
                <p className={`text-3xl font-black ${available ? 'text-slate-800 dark:text-white' : 'text-red-500 dark:text-red-400'}`}>{item.quantity}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-blue-100 dark:border-slate-800 shadow-sm shadow-blue-100/50 dark:shadow-none transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-inner border ${canViewLocations ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                  {canViewLocations ? <MapPin className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t('موقع القطعة (الدرج)', 'Location')}</p>
                {canViewLocations ? (
                  <div className="mt-1">
                    {item.location ? (
                      <LocationBadge location={item.location} />
                    ) : (
                      <span className="text-lg font-black text-slate-300 dark:text-slate-600">-</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1">
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500">{t('غير متاح لدفعتك', 'Not available for your batch')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* صندوق التلميح */}
            <div className="bg-slate-800 dark:bg-slate-900 text-white rounded-2xl p-5 mb-8 shadow-md border dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold mb-2 text-blue-300 dark:text-blue-400">
                <Info className="w-5 h-5" />
                <span>{t('معلومات هامة', 'Important Info')}</span>
              </div>
              <p className="text-slate-300 dark:text-slate-400 text-sm leading-relaxed font-medium">
                {t('هذه القطعة تابعة لتصنيف', 'This item belongs to')} <strong className="text-white px-1">{lang === 'ar' ? getCatAr(item) : getCatEn(item)}</strong>.
                {t(' يرجى التأكد من اختيار الكمية المناسبة لمشروعك. بمجرد إضافة القطعة وإرسال الطلب، سيقوم المشرف بمعالجتها وتجهيزها لك للاستلام.', ' Ensure you select the correct quantity for your project. Once added and requested, the admin will process it for pickup.')}
              </p>
            </div>

            {/* 🛒 3. منطقة الإجراءات */}
            <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 transition-colors">
              {inCart ? (
                <div className="bg-slate-900 dark:bg-slate-800 border-2 border-slate-800 dark:border-slate-700 rounded-2xl p-3 shadow-xl flex items-center justify-between transition-all" dir="ltr">
                  <button
                    onClick={() => updateCartQty(getNameAr(item), inCart.quantity - 1)}
                    className="w-14 h-14 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-600 transition-colors group"
                  >
                    {inCart.quantity === 1 ? <Trash2 className="w-6 h-6 text-slate-400 dark:text-slate-300 group-hover:text-white" /> : <Minus className="w-6 h-6 text-slate-300 group-hover:text-white"/>}
                  </button>

                  <div className="flex flex-col items-center">
                     <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-0.5">{t('في السلة', 'In Cart')}</span>
                     <span className="font-black text-white text-2xl leading-none">{inCart.quantity}</span>
                  </div>

                  <button
                    onClick={() => updateCartQty(getNameAr(item), inCart.quantity + 1)}
                    disabled={inCart.quantity >= item.quantity}
                    className="w-14 h-14 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:hover:bg-slate-800 dark:disabled:hover:bg-slate-700 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="w-6 h-6 text-slate-300 dark:text-slate-200"/>
                  </button>
                </div>
              ) : (
                <Button
                  className={`w-full h-16 text-xl font-black shadow-lg hover:shadow-xl transition-all rounded-2xl ${available ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 hover:-translate-y-1 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
                  disabled={!available}
                  onClick={() => {
                    const success = addToCart(item);
                    if (success) toast({ title: t('تمت الإضافة للسلة بنجاح 🛒', 'Added to cart successfully 🛒') });
                    else toast({ title: t('عذراً، الكمية غير متوفرة', 'Sorry, quantity unavailable'), variant: 'destructive' });
                  }}
                >
                  {available ? (
                    <span className="flex items-center gap-3"><ShoppingCart className="w-6 h-6" /> {t('أضف إلى سلة الطلبات', 'Add to Request Cart')}</span>
                  ) : (
                    <span className="flex items-center gap-3"><AlertCircle className="w-6 h-6" /> {t('القطعة غير متاحة حالياً', 'Item is Currently Unavailable')}</span>
                  )}
                </Button>
              )}

              {/* زر "اذهب للسلة" — يظهر فقط لما تكون القطعة في السلة */}
              {inCart && (
                <Button
                  onClick={() => navigate('/student')}
                  variant="outline"
                  className="w-full h-12 font-bold rounded-2xl border-2 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-2 transition-all"
                >
                  <ShoppingCart className="w-5 h-5"/>
                  {t('عرض السلة وإرسال الطلب', 'View Cart & Submit')}
                </Button>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default ComponentDetail;