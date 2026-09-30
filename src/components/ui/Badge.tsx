import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'indigo';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-sky-50 text-sky-700 border border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">قيد الانتظار</Badge>;
    case 'CONFIRMED':
      return <Badge variant="info">مؤكد</Badge>;
    case 'PROCESSING':
      return <Badge variant="indigo">قيد التجهيز / التصنيع</Badge>;
    case 'READY':
      return <Badge variant="success">جاهز للاستلام / الشحن</Badge>;
    case 'SHIPPED':
      return <Badge variant="info">تم الشحن</Badge>;
    case 'DELIVERED':
      return <Badge variant="success">تم التسليم</Badge>;
    case 'CANCELLED':
      return <Badge variant="danger">ملغي</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  switch (role) {
    case 'ADMIN':
      return <Badge variant="indigo">مدير عام (Admin)</Badge>;
    case 'MANAGER':
      return <Badge variant="info">مشرف إنتاج (Manager)</Badge>;
    case 'WORKER':
      return <Badge variant="neutral">فني تشغيل (Worker)</Badge>;
    default:
      return <Badge variant="neutral">{role}</Badge>;
  }
};
