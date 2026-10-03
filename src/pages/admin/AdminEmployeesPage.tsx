import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  ShieldAlert,
  Check,
  RefreshCw,
  Eye,
  Trash2,
  Calendar,
  ShoppingBag,
  Clock,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context.tsx';
import { User, UserRole } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { Table, Column } from '../../components/ui/Table.tsx';
import { RoleBadge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { LoadingState } from '../../components/ui/LoadingState.tsx';
import { ErrorState } from '../../components/ui/ErrorState.tsx';

export const AdminEmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Employee Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('WORKER');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Employee Profile Modal State (Requirement 11)
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Action messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.employees.getAll();
      if (res.success) setEmployees(res.data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات الموظفين');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadData();
    }
  }, [user?.role]);

  // Strict RBAC enforcement: Only ADMIN can manage employees
  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-red-950 text-base">غير مصرح بالوصول (حساب المدير العام فقط)</h3>
        <p className="text-xs text-red-700 max-w-md mx-auto leading-relaxed">
          إدارة موظفي المصنع وصلاحيات النظام محصورة بمدير النظام (ADMIN). لا يملك مشرف الإنتاج أو عمال التشغيل صلاحية تعديل حسابات الموظفين.
        </p>
      </div>
    );
  }

  // Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !role) return;

    setIsSubmittingCreate(true);
    setActionError(null);
    try {
      const res = await api.employees.create({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim() || null,
        role,
        is_active: isActive ? 1 : 0,
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        setRole('WORKER');
        setIsActive(true);
        setSuccessMsg('تم إضافة الموظف الجديد بنجاح في قاعدة البيانات وتفعيل حسابه.');
        await loadData();
      }
    } catch (err: any) {
      setActionError(err.message || 'فشل في إنشاء حساب الموظف');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Toggle Employee Active/Inactive Status (Requirement 10)
  const handleToggleActive = async (emp: User) => {
    const nextStatus = emp.is_active === 1 ? false : true;
    setActionError(null);
    try {
      const res = await api.employees.update(emp.id, { is_active: nextStatus });
      if (res.success) {
        setSuccessMsg(`تم ${nextStatus ? 'تنشيط' : 'تعطيل'} حساب الموظف (${emp.name}) بنجاح.`);
        await loadData();
      }
    } catch (err: any) {
      setActionError(err.message || 'فشل تحديث حالة الموظف');
    }
  };

  // Delete Employee with Historical Protection (Requirement 10)
  const handleDeleteEmployee = async (emp: User) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف الموظف (${emp.name})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    setActionError(null);
    try {
      const res = await api.employees.delete(emp.id);
      if (res.success) {
        setSuccessMsg(`تم حذف حساب الموظف (${emp.name}) بنجاح.`);
        await loadData();
      }
    } catch (err: any) {
      setActionError(err.message || 'لا يمكن حذف الموظف لوجود سجلات تاريخية أو طلبات مسندة إليه');
    }
  };

  // View Employee Profile (Requirement 11)
  const handleViewProfile = async (empId: number) => {
    setIsLoadingProfile(true);
    setIsProfileModalOpen(true);
    try {
      const res = await api.employees.getProfile(empId);
      if (res.success) {
        setSelectedProfile(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحميل الملف التعريفي للموظف');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Table Columns (Requirement 8)
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'اسم الموظف',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {u.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs">{u.name}</span>
            <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: (u) => (
        <span className="font-mono text-xs text-slate-600 block" dir="ltr">
          {u.phone || '-'}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'البريد الإلكتروني',
      render: (u) => (
        <span className="font-mono text-xs text-slate-600">
          {u.email}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'الدور (Role)',
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      key: 'is_active',
      header: 'الحالة (Status)',
      render: (u) => (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            u.is_active === 1
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active === 1 ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {u.is_active === 1 ? 'ACTIVE (نشط)' : 'INACTIVE (معطل)'}
        </span>
      ),
    },
    {
      key: 'assigned_orders_count',
      header: 'الطلبات المسندة',
      align: 'center',
      render: (u) => (
        <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full text-xs font-mono">
          {u.assigned_orders_count ?? 0}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'تاريخ الإنشاء',
      render: (u) => (
        <span className="text-[11px] text-slate-400 font-mono">
          {u.created_at?.slice(0, 10) || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'end',
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          {/* View Profile */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewProfile(u.id)}
            icon={<Eye className="h-3.5 w-3.5" />}
            title="عرض الملف التعريفي والطلبات"
          >
            الملف
          </Button>

          {/* Toggle status */}
          <Button
            size="sm"
            variant={u.is_active === 1 ? 'ghost' : 'outline'}
            onClick={() => handleToggleActive(u)}
            disabled={u.id === user?.id}
            className={`text-xs ${u.is_active === 1 ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700'}`}
          >
            {u.is_active === 1 ? 'تعطيل' : 'تنشيط'}
          </Button>

          {/* Delete (guarded against historical orders) */}
          <button
            type="button"
            onClick={() => handleDeleteEmployee(u)}
            disabled={u.id === user?.id}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              u.id === user?.id
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
            }`}
            title="حذف الموظف (غير متاح إذا ارتبطت به طلبات سابقة)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">إدارة فريق العمل والموظفين</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في حسابات مشرفي الإنتاج وعمال الخياطة وتوزيع الصلاحيات (خاص بالمدير العام ADMIN فقط).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            إضافة موظف جديد
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            تحديث
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 text-xs hover:underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-700 text-xs hover:underline cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <LoadingState message="جاري جلب سجل الموظفين..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <Table
          columns={columns}
          data={employees}
          keyExtractor={(u) => u.id}
          emptyMessage="لم تتم إضافة موظفين بعد."
        />
      )}

      {/* Add Employee Modal (Requirement 9 & 10) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إضافة موظف جديد (Add Employee)"
        maxWidth="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          <Input
            label="الاسم الكامل *"
            placeholder="مثال: أحمد عبد الله"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="البريد الإلكتروني *"
              type="email"
              placeholder="worker3@factory.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="رقم الهاتف"
              placeholder="010XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Input
            label="كلمة المرور المشفرة *"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="يتم تشفير كلمة المرور فوراً عبر bcrypt ولا تخزن بصيغة نصية"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="الدور الوظيفي (Role) *"
              options={[
                { value: 'WORKER', label: 'فني تشغيل وخياطة (WORKER)' },
                { value: 'MANAGER', label: 'مشرف إنتاج وإدارة (MANAGER)' },
                { value: 'ADMIN', label: 'مدير عام كامل الصلاحيات (ADMIN)' },
              ]}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              required
            />

            <Select
              label="حالة الحساب (Status) *"
              options={[
                { value: '1', label: 'ACTIVE (نشط - متاح لتسجيل الدخول والإسناد)' },
                { value: '0', label: 'INACTIVE (معطل - محظور من الدخول والإسناد)' },
              ]}
              value={isActive ? '1' : '0'}
              onChange={(e) => setIsActive(e.target.value === '1')}
              required
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingCreate}>
              إنشاء حساب الموظف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Employee Profile Modal (Requirement 11) */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="الملف التعريفي للموظف (Employee Profile)"
        maxWidth="lg"
      >
        {isLoadingProfile || !selectedProfile ? (
          <LoadingState message="جاري تجهيز سجل الموظف وإحصائياته..." />
        ) : (
          <div className="space-y-5 text-xs">
            {/* Header Profile Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-bold text-lg flex items-center justify-center">
                  {selectedProfile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{selectedProfile.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <RoleBadge role={selectedProfile.role} />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedProfile.is_active === 1
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {selectedProfile.is_active === 1 ? 'حساب نشط' : 'حساب معطل'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-start sm:text-end text-slate-500 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono">{selectedProfile.email}</span>
                </div>
                {selectedProfile.phone && (
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono">{selectedProfile.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics Row (Requirement 11) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-center">
                <span className="text-slate-500 text-[11px] block">إجمالي الطلبات المسندة</span>
                <span className="text-xl font-black text-indigo-700 block mt-0.5">
                  {selectedProfile.assigned_orders_count ?? 0}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <span className="text-slate-500 text-[11px] block">الطلبات المكتملة</span>
                <span className="text-xl font-black text-emerald-700 block mt-0.5">
                  {selectedProfile.completed_orders_count ?? 0}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center col-span-2 sm:col-span-1">
                <span className="text-slate-500 text-[11px] block">تاريخ الانضمام</span>
                <span className="text-xs font-bold text-slate-800 block mt-1.5 font-mono">
                  {selectedProfile.created_at?.slice(0, 10)}
                </span>
              </div>
            </div>

            {/* Recent Assigned Orders */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-indigo-600" />
                <span>الطلبات المسندة لهذا الموظف (Recent Assigned Orders):</span>
              </h4>

              <div className="rounded-xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                {selectedProfile.assigned_orders && selectedProfile.assigned_orders.length > 0 ? (
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[11px]">
                      <tr>
                        <th className="p-2.5 text-start">رقم الطلب</th>
                        <th className="p-2.5 text-start">العميل</th>
                        <th className="p-2.5 text-center">الحالة</th>
                        <th className="p-2.5 text-end">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedProfile.assigned_orders.map((ord: any) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-indigo-700">#{ord.order_number}</td>
                          <td className="p-2.5 text-slate-800 font-medium">{ord.customer_name}</td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded">
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-end font-mono font-bold text-slate-900">{ord.total} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-4 text-center text-slate-400">لا توجد طلبات مسندة حالياً لهذا الموظف.</p>
                )}
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-indigo-600" />
                <span>النشاط الأخير (Recent Activity):</span>
              </h4>

              <div className="space-y-2 max-h-36 overflow-y-auto pe-1">
                {selectedProfile.recent_activity && selectedProfile.recent_activity.length > 0 ? (
                  selectedProfile.recent_activity.map((act: any) => (
                    <div key={act.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">طلب #{act.order_number}: </span>
                        <span className="text-slate-500">{act.old_status} ← </span>
                        <span className="font-bold text-indigo-600">{act.new_status}</span>
                        {act.note && <span className="text-slate-400 block mt-0.5">"{act.note}"</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{act.created_at}</span>
                    </div>
                  ))
                ) : (
                  <p className="p-2 text-slate-400 text-center">لا توجد أنشطة مسجلة حديثاً.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setIsProfileModalOpen(false)}>
                إغلاق الملف
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
