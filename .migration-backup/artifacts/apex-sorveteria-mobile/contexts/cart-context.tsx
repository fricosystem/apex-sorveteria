import React, { createContext, useContext, useReducer } from "react";

export interface CartItem {
  id: string;
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  subtotal: number;
}

export type PaymentMethod = "Dinheiro" | "Pix" | "Cartão Crédito" | "Cartão Débito";

interface CartState {
  items: CartItem[];
  discount: number;
  paymentMethod: PaymentMethod;
}

type CartAction =
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; produtoId: string }
  | { type: "UPDATE_QTY"; produtoId: string; quantity: number }
  | { type: "SET_DISCOUNT"; value: number }
  | { type: "SET_PAYMENT"; method: PaymentMethod }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.produtoId === action.item.produtoId);
      if (existing) {
        const qty = existing.quantidade + action.item.quantidade;
        return {
          ...state,
          items: state.items.map((i) =>
            i.produtoId === action.item.produtoId
              ? { ...i, quantidade: qty, subtotal: i.preco * qty }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.produtoId !== action.produtoId) };
    case "UPDATE_QTY":
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.produtoId !== action.produtoId) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.produtoId === action.produtoId
            ? { ...i, quantidade: action.quantity, subtotal: i.preco * action.quantity }
            : i
        ),
      };
    case "SET_DISCOUNT":
      return { ...state, discount: Math.max(0, action.value) };
    case "SET_PAYMENT":
      return { ...state, paymentMethod: action.method };
    case "CLEAR":
      return { items: [], discount: 0, paymentMethod: "Dinheiro" };
    default:
      return state;
  }
}

interface CartContextType {
  items: CartItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  addItem: (item: CartItem) => void;
  removeItem: (produtoId: string) => void;
  updateQty: (produtoId: string, quantity: number) => void;
  setDiscount: (value: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearCart: () => void;
  total: number;
  itemsCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    discount: 0,
    paymentMethod: "Dinheiro",
  });

  const subtotalsSum = state.items.reduce((s, i) => s + i.subtotal, 0);
  const total = Math.max(0, subtotalsSum - state.discount);
  const itemsCount = state.items.reduce((s, i) => s + i.quantidade, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        discount: state.discount,
        paymentMethod: state.paymentMethod,
        addItem: (item) => dispatch({ type: "ADD_ITEM", item }),
        removeItem: (produtoId) => dispatch({ type: "REMOVE_ITEM", produtoId }),
        updateQty: (produtoId, quantity) => dispatch({ type: "UPDATE_QTY", produtoId, quantity }),
        setDiscount: (value) => dispatch({ type: "SET_DISCOUNT", value }),
        setPaymentMethod: (method) => dispatch({ type: "SET_PAYMENT", method }),
        clearCart: () => dispatch({ type: "CLEAR" }),
        total,
        itemsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
