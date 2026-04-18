import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, LogIn, LayoutDashboard, ShoppingCart } from 'lucide-react';
import { LocationTags } from '@/components/LocationTags';
import { apiUrl } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

// تعريف واجهة البيانات
interface Device {
  name_ar: string;
  name_en: string;
  quantity: number;
  category_ar: string;
  category_en: string;
  location: string;
  imageUrl: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [components, setComponents] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  // جلب البيانات من السيرفر
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(apiUrl('/api/items'));
        const data = await res.json();
        if (res.ok) setComponents(data.data);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  // تجهيز الأقسام
  const categories = ['الكل', ...Array.from(new Set(components.map(c => c.category_ar || 'عام')))];

  // فلترة القطع
  const filteredItems = components.filter(item => {
    const name = item.name_ar || '';
    const cat = item.category_ar || 'عام';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || cat === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // توجيه المستخدم حسب الرتبة
  const handleDashboardRedirect = () => {
    const userRole = user?.role?.toString().trim().toLowerCase();
    const isAdminOrEng = ['admin', 'مشرف', 'engineer', 'مهندس'].includes(userRole || '');
    navigate(isAdminOrEng ? '/admin' : '/student');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors" dir="rtl">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">كتالوج المعمل</h1>
          </div>

          <div className="flex items-center gap-2">
            {!user ? (
              <Button onClick={() => navigate('/login')} className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold">
                <LogIn className="w-4 h-4" /> تسجيل الدخول
              </Button>
            ) : (
              <Button onClick={handleDashboardRedirect} className="gap-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 font-bold">
                <LayoutDashboard className="w-4 h-4" /> لوحة التحكم
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-800 dark:text-white mb-4">مرحباً بك في معمل الابتكار 👋</h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium">استكشف القطع الإلكترونية والمعدات المتوفرة لمشروعك القادم.</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 mb-10 space-y-6">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              placeholder="ابحث عن قطعة (مثلاً: Arduino)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-12 pl-4 py-4 text-lg rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-200 dark:text-slate-700" />
              <p className="text-slate-400 dark:text-slate-500 font-bold text-lg">لا توجد نتائج مطابقة لبحثك</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <Card key={idx} className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group rounded-3xl flex flex-col h-full">
                <div className="aspect-square bg-slate-50 dark:bg-slate-800 p-6 relative flex items-center justify-center border-b border-slate-200 dark:border-slate-800 overflow-hidden">
                  <img
                    src={item.imageUrl || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'}
                    alt=""
                    className="object-contain w-full h-full group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm ${
                    item.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                  }`}>
                    {item.quantity > 0 ? `متاح: ${item.quantity}` : 'نافد'}
                  </div>
                </div>

                <CardContent className="p-5 flex flex-col flex-1">
                  <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-widest">
                    {item.category_ar || 'عام'}
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-3 line-clamp-2 leading-tight">
                    {item.name_ar}
                  </h3>

                  <div className="mt-auto space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                       <LocationTags location={item.location} />
                    </div>

                    {!user ? (
                      <Button
                        className="w-full font-bold text-xs bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        variant="outline"
                        onClick={() => navigate('/login')}
                      >
                        سجل دخول للطلب
                      </Button>
                    ) : (
                      <Button
                        className="w-full font-bold text-xs bg-blue-600 hover:bg-blue-700 shadow-md"
                        onClick={handleDashboardRedirect}
                      >
                         <ShoppingCart className="w-3.5 h-3.5 ml-1" /> اطلب الآن
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;