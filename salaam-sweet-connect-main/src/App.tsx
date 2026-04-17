import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from '@/contexts/CartContext';
import { LanguageProvider } from "./LanguageContext";
import { ThemeProvider } from '@/contexts/ThemeContext'; // ✅ الاستيراد موجود
import AdminLocations from '@/pages/admin/AdminLocations.tsx'; // أو حسب المسار اللي حطيت الملف فيه
import LoginPage from "./pages/LoginPage";
import StudentPortal from "./pages/student/StudentPortal";
import ComponentDetail from "./pages/student/ComponentDetail";
import MyLoans from "./pages/student/MyLoans";
import StudentItemRequests from "./pages/student/StudentItemRequests";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// 🛠️ تحديث الحارس البرمجي ليقبل المهندس والمشرف في صفحة الإدارة
const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: 'admin_or_engineer' | 'student' }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (!user) return <Navigate to="/login" replace />;

  // 🕵️‍♂️ سطر كشف الأخطاء (افتح الـ Console في المتصفح F12 وشوف وش يطلع لك)
  console.log("Current User Role:", user.role);

  // تنظيف الرتبة من المسافات وتحويلها لنص صغير للفحص
  const userRole = user.role?.toString().trim().toLowerCase();

  // فحص شامل (يدعم العربي والإنجليزي)
  const isAdminOrEng =
    userRole === 'admin' ||
    userRole === 'مشرف' ||
    userRole === 'engineer' ||
    userRole === 'مهندس';

  // المنطق الجديد:
  if (role === 'admin_or_engineer') {
    if (isAdminOrEng) return <>{children}</>;
    return <Navigate to="/student" replace />;
  }

  if (role === 'student') {
    if (isAdminOrEng) return <Navigate to="/admin" replace />;
    return <>{children}</>;
  }

  return <>{children}</>;
};

// 🏠 التوجيه التلقائي عند فتح التطبيق
const RootRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const userRole = user.role?.toString().trim().toLowerCase();
  const isAdminOrEng =
    userRole === 'admin' ||
    userRole === 'مشرف' ||
    userRole === 'engineer' ||
    userRole === 'مهندس';

  return <Navigate to={isAdminOrEng ? '/admin' : '/student'} replace />;
};

const AppRoutes = () => (
  <Routes>
      <Route path="/admin/locations" element={<AdminLocations />} />

    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<LoginPage />} />

    {/* 🎓 مسارات الطالب فقط */}
    <Route path="/student" element={<ProtectedRoute role="student"><StudentPortal /></ProtectedRoute>} />
    <Route path="/student/item" element={<ProtectedRoute role="student"><ComponentDetail /></ProtectedRoute>} />
    <Route path="/student/loans" element={<ProtectedRoute role="student"><MyLoans /></ProtectedRoute>} />
    <Route path="/student/item-requests" element={<ProtectedRoute role="student"><StudentItemRequests /></ProtectedRoute>} />

    {/* 🛠️ مسارات الإدارة (المشرف + المهندس) */}
    <Route path="/admin" element={<ProtectedRoute role="admin_or_engineer"><AdminDashboard /></ProtectedRoute>} />
    <Route path="/admin/*" element={<ProtectedRoute role="admin_or_engineer"><AdminDashboard /></ProtectedRoute>} />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  // 👇 ✅ تم تغليف التطبيق بالكامل بـ ThemeProvider هنا
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              {/* ✅ السلة الذكية نغلفها هنا عشان كل النظام يشوفها */}
              <CartProvider>
                <AppRoutes />
              </CartProvider>
            </AuthProvider>
          </BrowserRouter>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;