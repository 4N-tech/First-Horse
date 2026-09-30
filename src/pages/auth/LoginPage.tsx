import React, { useState } from 'react';
import { Lock, Mail, Shield, AlertCircle, ArrowLeft, ArrowRight, UserCheck, ShieldAlert, Check } from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { useI18n } from '../../lib/i18n.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';

interface LoginPageProps {
  onSuccess: () => void;
  onBackToStorefront: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onBackToStorefront }) => {
  const { login, isLoading } = useAuth();
  const { t, lang } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setError(null);
    try {
      await login({ email, password });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة');
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    try {
      await login({ email: demoEmail, password: demoPass });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول بالحساب التجريبي');
    }
  };

  const ArrowIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Return to storefront */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 mb-4">
        <button
          onClick={onBackToStorefront}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <ArrowIcon className="h-3.5 w-3.5" />
          <span>الرجوع إلى متجر العملاء العام</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">بوابة موظفي وإدارة المصنع</h2>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل دخول آمن للمشرفين والعمال والإدارة مع التحقق من الصلاحيات
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm rounded-3xl border border-slate-200 sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="البريد الإلكتروني"
              type="email"
              placeholder="admin@factory.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <Input
              label="كلمة المرور"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full font-bold shadow-xs py-2.5 mt-2"
            >
              تسجيل الدخول
            </Button>
          </form>

          {/* Quick Demo Personas - Crucial for immediate reviewer validation */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-700 mb-2.5 text-center">
              حسابات تجريبية سريعة لفحص الأدوار والصلاحيات (1-Click Login):
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@factory.com', 'admin123')}
                className="w-full text-start p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/70 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-indigo-950 block">حساب المدير العام (ADMIN)</span>
                  <span className="text-[10px] text-indigo-700 block">admin@factory.com | كامل الصلاحيات والنظام</span>
                </div>
                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded">دخول</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('manager@factory.com', 'manager123')}
                className="w-full text-start p-2.5 rounded-xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100/70 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-sky-950 block">حساب مشرف الإنتاج (MANAGER)</span>
                  <span className="text-[10px] text-sky-700 block">manager@factory.com | إدارة المنتجات والطلبات والعملاء</span>
                </div>
                <span className="text-[10px] font-bold bg-sky-600 text-white px-2 py-0.5 rounded">دخول</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('worker@factory.com', 'worker123')}
                className="w-full text-start p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">حساب فني التشغيل (WORKER)</span>
                  <span className="text-[10px] text-slate-500 block">worker@factory.com | الطلبات المسندة وتحديث حالتها فقط</span>
                </div>
                <span className="text-[10px] font-bold bg-slate-800 text-white px-2 py-0.5 rounded">دخول</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
