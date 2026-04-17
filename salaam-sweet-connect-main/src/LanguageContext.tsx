import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// تعريف أنواع البيانات
type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  // دالة سحرية لترجمة أي نص بسرعة
  t: (arText: string, enText: string) => string;
}

// إنشاء الـ Context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// الموزع (Provider) الذي سيغلف التطبيق
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // جلب اللغة من التخزين المحلي عشان لو سوى تحديث للصفحة ما ترجع عربي فجأة
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'ar';
  });

  // لما تتغير اللغة، احفظها في المتصفح وغير اتجاه الموقع كامل (RTL/LTR)
  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // دالة تبديل اللغة
  const toggleLang = () => setLang(prev => (prev === 'ar' ? 'en' : 'ar'));

  // دالة الترجمة السريعة: تعطيها النصين وترجع لك الصح حسب اللغة
  const t = (arText: string, enText: string) => (lang === 'ar' ? arText : enText);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook مخصص عشان تستخدمه في أي صفحة بسهولة
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};