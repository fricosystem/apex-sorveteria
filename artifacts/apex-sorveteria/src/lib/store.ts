import { create } from "zustand";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  subtotal: number;
}

export type ActiveView = "dashboard" | "produtos" | "compras" | "caixa" | "perfil";
export type PaymentMethod =
  | "Dinheiro"
  | "Pix"
  | "Cartão Crédito"
  | "Cartão Débito";

// ── Store State & Actions ─────────────────────────────────────────────────

interface StoreState {
  // Navigation
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Cart / POS
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (produtoId: string) => void;
  updateCartQuantity: (produtoId: string, quantity: number) => void;
  clearCart: () => void;

  // Discount
  discount: number;
  setDiscount: (value: number) => void;

  // Payment
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;

  // Computed getters
  cartTotal: () => number;
  cartItemsCount: () => number;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useStore = create<StoreState>((set, get) => ({
  // Navigation
  activeView: "dashboard" as ActiveView,
  setActiveView: (view) => set({ activeView: view }),

  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Cart
  cart: [],

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.produtoId === item.produtoId);

      if (existing) {
        const quantidade = existing.quantidade + item.quantidade;
        return {
          cart: state.cart.map((c) =>
            c.produtoId === item.produtoId
              ? { ...c, quantidade, subtotal: c.preco * quantidade }
              : c,
          ),
        };
      }

      return { cart: [...state.cart, item] };
    }),

  removeFromCart: (produtoId) =>
    set((state) => ({
      cart: state.cart.filter((c) => c.produtoId !== produtoId),
    })),

  updateCartQuantity: (produtoId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { cart: state.cart.filter((c) => c.produtoId !== produtoId) };
      }

      return {
        cart: state.cart.map((c) =>
          c.produtoId === produtoId
            ? { ...c, quantidade: quantity, subtotal: c.preco * quantity }
            : c,
        ),
      };
    }),

  clearCart: () => set({ cart: [], discount: 0 }),

  // Discount
  discount: 0,
  setDiscount: (value) => set({ discount: Math.max(0, value) }),

  // Payment
  paymentMethod: "Dinheiro",
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  // Computed getters (derived from current state)
  cartTotal: () => {
    const { cart, discount } = get();
    const subtotalsSum = cart.reduce((sum, item) => sum + item.subtotal, 0);
    return Math.max(0, subtotalsSum - discount);
  },

  cartItemsCount: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.quantidade, 0);
  },
}));
