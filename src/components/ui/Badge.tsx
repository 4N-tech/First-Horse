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

export const OrderStatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning" size={size}>معلق</Badge>;
    case 'CONFIRMED':
      return <Badge variant="info" size={size}>تم التأكيد</Badge>;
    case 'PROCESSING':
      return <Badge variant="indigo" size={size}>جاري التجهيز</Badge>;
    case 'READY':
      return <Badge variant="success" size={size}>جاهز</Badge>;
    case 'SHIPPED':
      return <Badge variant="info" size={size}>تم الشحن</Badge>;
    case 'DELIVERED':
      return <Badge variant="success" size={size}>تم التسليم</Badge>;
    case 'CANCELLED':
      return <Badge variant="danger" size={size}>ملغي</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
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

export const StockStatusBadge: React.FC<{ status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' | string; size?: 'sm' | 'md' }> = ({
  status,
  size = 'sm',
}) => {
  switch (status) {
    case 'OUT_OF_STOCK':
      return (
        <Badge variant="danger" size={size} className="gap-1 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
          <span>نفد من المخزن</span>
        </Badge>
      );
    case 'LOW_STOCK':
      return (
        <Badge variant="warning" size={size} className="gap-1 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          <span>مخزون منخفض</span>
        </Badge>
      );
    case 'IN_STOCK':
      return (
        <Badge variant="success" size={size} className="gap-1 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>متوفر بالمخزن</span>
        </Badge>
      );
    default:
      return <Badge variant="neutral" size={size}>{status}</Badge>;
  }
};

export const MovementTypeBadge: React.FC<{ type: string; size?: 'sm' | 'md' }> = ({ type, size = 'sm' }) => {
  switch (type) {
    case 'ADJUSTMENT_IN':
      return <Badge variant="success" size={size}>تسوية بالزيادة (+)</Badge>;
    case 'ADJUSTMENT_OUT':
      return <Badge variant="danger" size={size}>تسوية بالعجز (-)</Badge>;
    case 'ORDER_DEDUCTION':
      return <Badge variant="indigo" size={size}>صرف لطلب عميل (-)</Badge>;
    case 'ORDER_RELEASE':
      return <Badge variant="info" size={size}>إلغاء حجز / استرجاع (+)</Badge>;
    case 'ORDER_RESERVATION':
      return <Badge variant="warning" size={size}>حجز لطلب</Badge>;
    case 'PURCHASE':
      return <Badge variant="success" size={size}>توريد / شراء (+)</Badge>;
    case 'INITIAL':
      return <Badge variant="neutral" size={size}>رصيد افتتاحي</Badge>;
    case 'RETURN':
      return <Badge variant="success" size={size}>مرتجع عميل (+)</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{type}</Badge>;
  }
};
