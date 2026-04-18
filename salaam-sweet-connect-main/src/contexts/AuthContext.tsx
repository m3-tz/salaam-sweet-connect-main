import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  role: string;
  session_token?: string;
  can_view_locations?: boolean;
  can_borrow?: boolean;
  auto_approve?: boolean;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; blocked?: boolean }>;
  logout: (reason?: 'session_expired' | 'inactivity') => void;
  isLoading: boolean;
  hasPermission: (perm: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// مدة الخمول قبل الطرد: 20 دقيقة
const INACTIVITY_MS       = 20 * 60 * 1000; // 20 دقيقة خمول
const PING_INTERVAL_MS    =  2 * 60 * 1000; // ping كل دقيقتين
const SESSION_CHECK_MS    =      10 * 1000; // فحص الجلسة كل 10 ثواني

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── تسجيل الخروج مع حفظ السبب ────────────────────────────────────────
  const logout = useCallback((reason?: 'session_expired' | 'inactivity') => {
    if (reason) localStorage.setItem('logout_reason', reason);
    setUser(null);
    localStorage.removeItem('lab_user');
  }, []);

  // ── تايمر الخمول: 20 دقيقة بدون نشاط → خروج تلقائي ─────────────────
  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        logout('inactivity');
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // ابدأ العداد فوراً

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user?.id, logout]);

  // ── فحص الجلسة كل 10 ثواني — يطرد الجلسة القديمة فوراً ─────────────
  useEffect(() => {
    if (!user?.session_token) return;

    const checkSession = () => {
      const params = new URLSearchParams({ uid: user.id, token: user.session_token! });
      fetch(apiUrl(`/api/session/check?${params}`))
        .then(r => r.json())
        .then(data => {
          if (!data.valid && data.reason === 'session_expired') {
            logout('session_expired');
          }
        })
        .catch(() => {});
    };

    // لا تبدأ الفحص فوراً — انتظر 10 ثواني أول مرة
    const interval = setInterval(checkSession, SESSION_CHECK_MS);
    return () => clearInterval(interval);
  }, [user?.id, user?.session_token, logout]);

  // ── Presence ping: كل دقيقتين لتحديث last_seen ───────────────────────
  useEffect(() => {
    if (!user) return;

    const sendPing = () => {
      const page = window.location.pathname;
      fetch(apiUrl('/api/ping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universityId: user.id,
          userName: user.name,
          role: user.role,
          page,
          sessionToken: user.session_token || '',
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.status === 'session_expired') {
            logout('session_expired');
          }
        })
        .catch(() => {});
    };

    sendPing();
    const interval = setInterval(sendPing, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id, logout]);

  // ── RBAC: تحميل الصلاحيات تلقائياً ──────────────────────────────────
  useEffect(() => {
    if (!user || !user.role) return;
    if (user.role === 'مشرف' || user.role.toLowerCase() === 'admin') return;
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

  // ── Login ─────────────────────────────────────────────────────────────
  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId: username, password }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        const dbRole = data.user.role?.toString().trim();

        const loggedInUser: User = {
          id:                 data.user.universityId,
          name:               data.user.name,
          role:               dbRole,
          session_token:      data.user.session_token || undefined,
          can_view_locations: data.user.can_view_locations !== false,
          can_borrow:         data.user.can_borrow !== false,
          auto_approve:       data.user.auto_approve === true,
          permissions:        data.user.permissions || [],
        };

        setUser(loggedInUser);
        localStorage.setItem('lab_user', JSON.stringify(loggedInUser));
        // امسح أي سبب تسجيل خروج سابق
        localStorage.removeItem('logout_reason');
        return { success: true };
      } else {
        return {
          success: false,
          error:   data.message || 'بيانات الدخول غير صحيحة',
          blocked: !!data.blocked,
        };
      }
    } catch {
      return { success: false, error: 'تعذر الاتصال بالخادم. تأكد من تشغيل (Python API).' };
    }
  };

  // ── RBAC: فحص الصلاحيات ──────────────────────────────────────────────
  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.role === 'مشرف' || user.role?.toLowerCase() === 'admin') return true;
    return user.permissions?.includes(perm) ?? false;
  };

  // ── RBAC: تحديث الصلاحيات من السيرفر ────────────────────────────────
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
