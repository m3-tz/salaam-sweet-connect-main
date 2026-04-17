import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// تعريف القطعة
interface Device {
  name?: string;
  name_ar?: string;
  name_en?: string;
  quantity: number;
  location: string;
  category?: string;
  category_ar?: string;
  category_en?: string;
  imageUrl: string;
}

// تعريف عنصر السلة
interface CartItem {
  component: Device;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (comp: Device) => boolean;
  updateCartQty: (compNameAr: string, qty: number) => void;
  clearCart: () => void;
  totalCartItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  // 💡 السحر هنا: نسحب السلة من التخزين المحلي عشان ما تضيع لو تحدثت الصفحة
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem('lab_student_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // 💡 حفظ السلة تلقائياً مع كل تغيير
  useEffect(() => {
    localStorage.setItem('lab_student_cart', JSON.stringify(cart));
  }, [cart]);

  const getNameAr = (c: Device) => c.name_ar || c.name || '';

  const addToCart = (comp: Device) => {
    let success = true;
    setCart(prev => {
      const existing = prev.find(i => getNameAr(i.component) === getNameAr(comp));
      if (existing) {
        if (existing.quantity >= comp.quantity) {
          success = false; // الكمية ما تسمح
          return prev;
        }
        return prev.map(i => getNameAr(i.component) === getNameAr(comp) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { component: comp, quantity: 1 }];
    });
    return success;
  };

  const updateCartQty = (compNameAr: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => getNameAr(i.component) !== compNameAr));
    } else {
      setCart(prev => prev.map(i => getNameAr(i.component) === compNameAr ? { ...i, quantity: qty } : i));
    }
  };

  const clearCart = () => setCart([]);

  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateCartQty, clearCart, totalCartItems }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
};