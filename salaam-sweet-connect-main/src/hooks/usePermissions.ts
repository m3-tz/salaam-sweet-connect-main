/**
 * usePermissions – خطاف مساعد للتحقق من صلاحيات المستخدم
 *
 * Usage:
 *   const { can, canAny, canAll } = usePermissions();
 *   if (can('inventory:delete')) { ... }
 *   if (canAny('loans:create', 'loans:return')) { ... }
 */

import { useAuth } from '@/contexts/AuthContext';

export const usePermissions = () => {
  const { hasPermission, user } = useAuth();

  /** هل المستخدم يملك هذه الصلاحية؟ */
  const can = (perm: string): boolean => hasPermission(perm);

  /** هل يملك أي واحدة من الصلاحيات؟ */
  const canAny = (...perms: string[]): boolean => perms.some(p => hasPermission(p));

  /** هل يملك كل الصلاحيات؟ */
  const canAll = (...perms: string[]): boolean => perms.every(p => hasPermission(p));

  /** هل هو مشرف/admin? */
  const isSuperAdmin = user?.role === 'مشرف' || user?.role?.toLowerCase() === 'admin';

  return { can, canAny, canAll, isSuperAdmin, permissions: user?.permissions || [] };
};
