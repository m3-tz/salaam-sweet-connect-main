import { useLanguage } from '../LanguageContext';
import { Github, Mail, Linkedin, Globe } from 'lucide-react';

interface DeveloperFooterProps {
  variant?: 'compact' | 'full'; // compact = small footer, full = detailed section
}

const DeveloperFooter = ({ variant = 'compact' }: DeveloperFooterProps) => {
  const { t, lang } = useLanguage();

  if (variant === 'compact') {
    return (
      <footer className="bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm border-t border-slate-700 dark:border-slate-800 py-6 px-4 mt-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                {t('مصمم وطُور بواسطة', 'Developed by')}
              </p>
              <p className="text-sm font-black text-slate-200 dark:text-slate-100 mt-1">
                Motaz Albdulsalam
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm"
                title={t('GitHub', 'GitHub')}
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="mailto:motaz@example.com"
                className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm"
                title={t('البريد الإلكتروني', 'Email')}
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-600 font-mono">
              © 2026
            </p>
          </div>
        </div>
      </footer>
    );
  }

  // Full variant - detailed developer section for admin dashboard
  return (
    <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 dark:from-slate-900 dark:via-slate-950 dark:to-slate-1000 border border-slate-700 dark:border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Developer Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-2xl font-black text-white">MA</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-white leading-tight">
                  Motaz Albdulsalam
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-300 dark:text-slate-400 leading-relaxed mb-4">
              {t(
                'مصمم ومطور نظام إدارة معمل أكاديمية طويق — نظام شامل يدمج أحدث التقنيات في تطوير الويب.',
                'Designer and Developer of Tuwaiq Academy Lab Management System — a comprehensive system integrating cutting-edge web development technologies.'
              )}
            </p>

            <div className="flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-blue-400 transition-all shadow-md hover:shadow-lg"
                title="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="mailto:motaz@example.com"
                className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all shadow-md hover:shadow-lg"
                title={t('البريد الإلكتروني', 'Email')}
              >
                <Mail className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 transition-all shadow-md hover:shadow-lg"
                title="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>



          {/* Stats */}
          <div className="lg:col-span-1">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl font-black text-purple-400 min-w-fit">2026</span>
                <div>
                  <p className="text-xs font-bold text-slate-300">{t('سنة التطوير', 'Development Year')}</p>
                  <p className="text-[10px] text-slate-400">{t('تقنيات حديثة وآمنة', 'Modern & Secure')}</p>
                </div>
              </div>
              </div>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-8 pt-6 border-t border-slate-700 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-mono">
            {t('نظام إدارة معمل أكاديمية طويق', 'Tuwaiq Academy Lab Management System')} © 2026 • Motaz Albdulsalam
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-600 text-center mt-2 font-medium">
            {t(
              'مصمم بعناية لتقديم تجربة احترافية وآمنة',
              'Carefully designed to deliver a professional and secure experience'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeveloperFooter;
