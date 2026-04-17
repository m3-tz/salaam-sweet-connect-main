import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';

// تم تعديل الواجهة لتطابق استهلاك ملفاتك للبيانات
export interface User {
  id: string;
  name: string;
  role: string; // سنخزن فيه "مهندس" أو "مشرف" أو "admin" كما هي في الداتا بيس
  can_view_locations?: boolean;
  can_borrow?: boolean;
  auto_approve?: boolean;
  permissions?: string[]; // RBAC صلاحيات المستخدم
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; blocked?: boolean }>;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (perm: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // استرجاع الجلسة المحفوظة
  useEffect(() => {
    const stored = localStorage.getItem('lab_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('lab_user');
      }
    }
    setIsLoading(false);
  }, []);

  // ── Presence ping: أرسل كل دقيقتين لتحديث last_seen ────────────────────
  useEffect(() => {
    if (!user) return;

    const sendPing = () => {
      const page = window.location.pathname;
      fetch(apiUrl('/api/ping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: user.id, userName: user.name, role: user.role, page }),
      }).catch(() => {});
    };

    sendPing(); // ping فوري عند تسجيل الدخول أو تحديث الصفحة
    const interval = setInterval(sendPing, 2 * 60 * 1000); // كل دقيقتين
    return () => clearInterval(interval);
  }, [user?.id]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── RBAC: تحميل الصلاحيات تلقائياً عند فتح التطبيق أو إذا كانت فارغة ──
  useEffect(() => {
    if (!user || !user.role) return;
    // المشرف لديه كل الصلاحيات تلقائياً — لا حاجة للجلب
    if (user.role === 'مشرف' || user.role.toLowerCase() === 'admin') return;
    // إذا الصلاحيات فارغة أو غير موجودة، اجلبها
    if (!user.permissions || user.permissions.length === 0) {
      fetch(apiUrl(`/api/permissions/my?role=${encodeURIComponent(user.role)}`))
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && data.data?.length > 0) {
            const updated = { ...user, permissions: data.data };
            setUser(updated);
            localStorage.setItem('lab_user', JSON.stringify(updated));
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.role]);
  // ─────────────────────────────────────────────────────────────────────────

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: username, password }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // ✅ السر هنا: نأخذ الرتبة الحقيقية من الداتا بيس ونضعها في role
        // لكي تعمل الحسبة في ملفاتك (user.role === 'مشرف') بشكل صحيح
        const dbRole = data.user.role?.toString().trim();

        const loggedInUser: User = {
          id: data.user.universityId,
          name: data.user.name,
          role: dbRole, // ستكون قيمتها "مهندس" أو "مشرف" أو "admin"
          can_view_locations: data.user.can_view_locations !== false,
          can_borrow:         data.user.can_borrow !== false,
          auto_approve:       data.user.auto_approve === true,
          permissions:        data.user.permissions || [],
        };

        setUser(loggedInUser);
        localStorage.setItem('lab_user', JSON.stringify(loggedInUser));
        return { success: true };
      } else {
        return { success: false, error: data.message || 'بيانات الدخول غير صحيحة', blocked: !!data.blocked };
      }
    } catch (error) {
      return { success: false, error: 'تعذر الاتصال بالخادم. تأكد من تشغيل (Python API).' };
    }
  };

  // ── RBAC: فحص الصلاحيات ───────────────────────────────────────────────
  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    // المشرف لديه كل الصلاحيات
    if (user.role === 'مشرف' || user.role?.toLowerCase() === 'admin') return true;
    return user.permissions?.includes(perm) ?? false;
  };

  // ── RBAC: تحديث الصلاحيات من السيرفر ────────────────────────────────────
  const refreshPermissions = async () => {
    if (!user) return;
    try {
      const res = await fetch(apiUrl(`/api/permissions/my?role=${encodeURIComponent(user.role)}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          const updated = { ...user, permissions: data.data };
          setUser(updated);
          localStorage.setItem('lab_user', JSON.stringify(updated));
        }
      }
    } catch { /* silent */ }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const logout = () => {
    setUser(null);
    localStorage.removeItem('lab_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasPermission, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};