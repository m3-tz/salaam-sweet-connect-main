// ====================================================
// 🌐 API Base URL
// ====================================================
// إذا كان VITE_API_URL محدد في .env يستخدمه مباشرة
// وإلا يستخدم نفس origin المتصفح (localhost أو IP الشبكة)
// هكذا يشتغل من أي جهاز بدون تعديل
// ====================================================
const envUrl = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE: string =
  envUrl && envUrl.trim() !== ''
    ? envUrl.trim().replace(/\/$/, '')   // حذف / الأخيرة لو موجودة
    : '';                                 // relative → نفس host:port للـ Vite

/**
 * دالة مساعدة لبناء رابط API
 * مثال: apiUrl('/api/login') → '/api/login'  (يروح عبر Vite proxy لـ Flask)
 * أو   apiUrl('/api/login') → 'http://my.server:8080/api/login' لو عدّلت .env
 */
export const apiUrl = (path: string): string => `${API_BASE}${path}`;
