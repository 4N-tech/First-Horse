import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from '../types/index.ts';
import { api } from './api.ts';

const CART_STORAGE_KEY = 'nassij_cart_v1';

interface AddItemResult {
  success: boolean;
  message: string;
}

interface CartContextType {
  items: CartItem[];
  totalItemsCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => AddItemResult;
  updateQuantity: (variantId: number, quantity: number) => { success: boolean; message?: string };
  removeItem: (variantId: number) => void;
  clearCart: () => void;
  revalidateWithServer: () => Promise<{ isValid: boolean; issues: string[] }>;
  isValidating: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Failed to load cart from localStorage:', e);
    }
    return [];
  });

  const [isValidating, setIsValidating] = useState(false);

  // Sync to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage:', e);
    }
  }, [items]);

  // Revalidate cart with server on initial mount if items exist
  useEffect(() => {
    if (items.length > 0) {
      revalidateWithServer().catch(() => {});
    }
  }, []);

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const deliveryFee = 0; // Phase 3: Delivery fee is 0 (ready for future phase calculation)
  const total = subtotal + deliveryFee;

  const addItem = (newItem: Omit<CartItem, 'quantity'>, quantityToAdd: number): AddItemResult => {
    if (quantityToAdd <= 0) {
      return { success: false, message: 'الكمية يجب أن تكون أكبر من صفر.' };
    }

    const existingIndex = items.findIndex((i) => i.variant_id === newItem.variant_id);

    if (existingIndex > -1) {
      const existing = items[existingIndex];
      const newQty = existing.quantity + quantityToAdd;

      if (newQty > newItem.stock_quantity) {
        return {
          success: false,
          message: `الكمية المطلوبة (${newQty}) تتجاوز المخزون المتوفر (${newItem.stock_quantity}).`,
        };
      }

      const updated = [...items];
      updated[existingIndex] = {
        ...existing,
        ...newItem,
        quantity: newQty,
      };
      setItems(updated);
      return { success: true, message: 'تمت إضافة المنتج إلى السلة وتحديث الكمية.' };
    }

    if (quantityToAdd > newItem.stock_quantity) {
      return {
        success: false,
        message: 'الكمية المطلوبة غير متاحة حاليًا بالمخزون.',
      };
    }

    setItems((prev) => [
      ...prev,
      {
        ...newItem,
        quantity: quantityToAdd,
      },
    ]);

    return { success: true, message: 'تمت إضافة المنتج إلى السلة.' };
  };

  const updateQuantity = (variantId: number, newQty: number) => {
    if (newQty <= 0) {
      removeItem(variantId);
      return { success: true };
    }

    const item = items.find((i) => i.variant_id === variantId);
    if (!item) return { success: false };

    if (newQty > item.stock_quantity) {
      // Cap at available stock
      setItems((prev) =>
        prev.map((i) => (i.variant_id === variantId ? { ...i, quantity: item.stock_quantity } : i))
      );
      return {
        success: false,
        message: 'الكمية المطلوبة غير متاحة حاليًا. تم ضبط الكمية على أقصى متوفر.',
      };
    }

    setItems((prev) =>
      prev.map((i) => (i.variant_id === variantId ? { ...i, quantity: newQty } : i))
    );
    return { success: true };
  };

  const removeItem = (variantId: number) => {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  // Revalidate cart with authoritative backend database
  const revalidateWithServer = async (): Promise<{ isValid: boolean; issues: string[] }> => {
    if (items.length === 0) return { isValid: true, issues: [] };

    setIsValidating(true);
    const issues: string[] = [];

    try {
      const payload = items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
      }));

      const res = await api.orders.validateCart(payload);
      if (res.success && Array.isArray(res.items)) {
        const validatedMap = new Map<number, any>();
        for (const vItem of res.items) {
          validatedMap.set(vItem.variant_id, vItem);
        }

        const nextItems: CartItem[] = [];

        for (const item of items) {
          const vData = validatedMap.get(item.variant_id);

          if (!vData || !vData.is_available) {
            issues.push(`المنتج (${item.product_name} - ${item.color}/${item.size}) لم يعد متاحًا.`);
            nextItems.push({
              ...item,
              is_active: false,
              error_message: 'هذا المنتج لم يعد متاحًا.',
            });
            continue;
          }

          let adjustedQty = item.quantity;
          if (adjustedQty > vData.stock_quantity) {
            adjustedQty = Math.max(0, vData.stock_quantity);
            issues.push(
              `تم تعديل كمية (${item.product_name} - ${item.color}/${item.size}) إلى ${adjustedQty} نظراً لنفاد جزء من المخزون.`
            );
          }

          nextItems.push({
            ...item,
            product_name: vData.product_name || item.product_name,
            product_slug: vData.product_slug || item.product_slug,
            image_url: vData.image_url || item.image_url,
            color: vData.color || item.color,
            size: vData.size || item.size,
            sku: vData.sku || item.sku,
            price: vData.unit_price, // Authoritative price from database
            stock_quantity: vData.stock_quantity,
            quantity: adjustedQty,
            is_active: true,
          });
        }

        setItems(nextItems);
        return { isValid: res.is_valid && issues.length === 0, issues };
      }
    } catch (err: any) {
      console.error('Cart revalidation error:', err);
    } finally {
      setIsValidating(false);
    }

    return { isValid: true, issues: [] };
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalItemsCount,
        subtotal,
        deliveryFee,
        total,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        revalidateWithServer,
        isValidating,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
