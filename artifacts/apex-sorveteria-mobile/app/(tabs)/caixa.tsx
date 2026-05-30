import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
  runTransaction,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/contexts/cart-context";
import type { PaymentMethod } from "@/contexts/cart-context";
import { sendLowStockAlert, scheduleDailySummaryNotification } from "@/lib/notifications";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRL = (v: number) => fmt.format(v);

interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria: string | null;
  estoque: number;
  ativo: boolean;
}

interface CaixaDoc {
  id: string;
  status: string;
  valorInicial: number;
  totalVendas: number;
  dataAbertura: string;
}

const PAYMENT_METHODS: PaymentMethod[] = ["Dinheiro", "Pix", "Cartão Crédito", "Cartão Débito"];
const CATEGORIAS = ["Todas", "Potes", "Picolés", "Massas", "Açaí", "Bebidas", "Complementos"];

const PAYMENT_ICONS: Record<PaymentMethod, string> = {
  Dinheiro: "dollar-sign",
  Pix: "zap",
  "Cartão Crédito": "credit-card",
  "Cartão Débito": "credit-card",
};

export default function CaixaScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [caixaAtual, setCaixaAtual] = useState<CaixaDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState("Todas");
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [openModalVisible, setOpenModalVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 50;

  const load = useCallback(async () => {
    try {
      const [prodSnap, caixaSnap] = await Promise.all([
        getDocs(query(collection(db, "produtos"), orderBy("nome"))),
        getDocs(query(collection(db, "caixas"), where("status", "==", "aberto"), limit(1))),
      ]);
      const prods: Produto[] = prodSnap.docs
        .map((d) => ({
          id: d.id,
          nome: d.data().nome ?? "",
          preco: d.data().preco ?? 0,
          categoria: d.data().categoria ?? null,
          estoque: d.data().estoque ?? 0,
          ativo: d.data().ativo !== false,
        }))
        .filter((p) => p.ativo);
      setProdutos(prods);
      if (!caixaSnap.empty) {
        const d = caixaSnap.docs[0];
        setCaixaAtual({
          id: d.id,
          status: d.data().status,
          valorInicial: d.data().valorInicial ?? 0,
          totalVendas: d.data().totalVendas ?? 0,
          dataAbertura: d.data().dataAbertura ?? "",
        });
      } else {
        setCaixaAtual(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredProds = produtos.filter((p) =>
    categoria === "Todas" || p.categoria === categoria
  );

  const addToCart = (p: Produto) => {
    if (p.estoque <= 0) {
      Alert.alert("Sem estoque", `${p.nome} está sem estoque.`);
      return;
    }
    if (!caixaAtual) {
      Alert.alert("Caixa fechado", "Abra o caixa antes de registrar vendas.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cart.addItem({
      id: Date.now().toString(36),
      produtoId: p.id,
      nome: p.nome,
      preco: p.preco,
      quantidade: 1,
      subtotal: p.preco,
    });
  };

  const finalizeSale = async () => {
    if (!caixaAtual || cart.items.length === 0) return;
    setCheckoutVisible(false);
    const saleTotal = cart.total;
    const saleItems = [...cart.items];
    try {
      const numero = (await getDocs(collection(db, "vendas"))).size + 1;
      const venda = {
        numero,
        caixaId: caixaAtual.id,
        itens: saleItems.map((i) => ({
          produtoId: i.produtoId,
          nome: i.nome,
          preco: i.preco,
          quantidade: i.quantidade,
          subtotal: i.subtotal,
        })),
        total: saleTotal,
        desconto: cart.discount,
        subtotal: saleItems.reduce((s, i) => s + i.subtotal, 0),
        formaPagamento: cart.paymentMethod,
        status: "concluida",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "vendas"), venda);
      await updateDoc(doc(db, "caixas", caixaAtual.id), {
        totalVendas: increment(saleTotal),
      });
      for (const item of saleItems) {
        await updateDoc(doc(db, "produtos", item.produtoId), {
          estoque: increment(-item.quantidade),
        });
      }
      cart.clearCart();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Venda Registrada!", `Total: ${fmtBRL(saleTotal)}`);

      const newCaixaTotal = caixaAtual.totalVendas + saleTotal;

      for (const item of saleItems) {
        const prod = produtos.find((p) => p.id === item.produtoId);
        if (prod) {
          const newStock = prod.estoque - item.quantidade;
          if (newStock <= 5 && newStock >= 0) {
            sendLowStockAlert(prod.nome, newStock);
          }
        }
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const fimHoje = new Date();
      fimHoje.setHours(23, 59, 59, 999);
      const { Timestamp: TS } = await import("firebase/firestore");
      const vendasHojeSnap = await getDocs(
        query(
          collection(db, "vendas"),
          where("createdAt", ">=", TS.fromDate(hoje)),
          where("createdAt", "<=", TS.fromDate(fimHoje)),
        ),
      );
      const vendasConcluidas = vendasHojeSnap.docs.filter(
        (d) => d.data().status === "concluida",
      );
      const receitaHoje = vendasConcluidas.reduce(
        (s, d) => s + ((d.data().total as number) || 0),
        0,
      );
      scheduleDailySummaryNotification(receitaHoje, vendasConcluidas.length, newCaixaTotal);

      load();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível registrar a venda.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.title, { color: c.foreground }]}>Caixa / PDV</Text>
          <View style={[styles.caixaStatus, { backgroundColor: caixaAtual ? c.primary + "20" : c.muted }]}>
            <View style={[styles.statusDot, { backgroundColor: caixaAtual ? c.primary : c.mutedForeground }]} />
            <Text style={[styles.statusLabel, { color: caixaAtual ? c.primary : c.mutedForeground }]}>
              {caixaAtual ? "Aberto" : "Fechado"}
            </Text>
          </View>
        </View>
        {!caixaAtual ? (
          <TouchableOpacity
            style={[styles.caixaBtn, { backgroundColor: c.primary }]}
            onPress={() => setOpenModalVisible(true)}
          >
            <Feather name="unlock" size={16} color={c.primaryForeground} />
            <Text style={[styles.caixaBtnText, { color: c.primaryForeground }]}>Abrir</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.caixaBtn, { backgroundColor: c.destructive }]}
            onPress={() => Alert.alert("Fechar Caixa", "Deseja fechar o caixa?", [
              { text: "Cancelar" },
              {
                text: "Fechar",
                style: "destructive",
                onPress: async () => {
                  await updateDoc(doc(db, "caixas", caixaAtual!.id), {
                    status: "fechado",
                    dataFechamento: new Date().toISOString(),
                    updatedAt: serverTimestamp(),
                  });
                  setCaixaAtual(null);
                  cart.clearCart();
                },
              },
            ])}
          >
            <Feather name="lock" size={16} color="#fff" />
            <Text style={[styles.caixaBtnText, { color: "#fff" }]}>Fechar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 50 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}
      >
        {CATEGORIAS.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, { backgroundColor: categoria === cat ? c.primary : c.secondary, borderColor: categoria === cat ? c.primary : c.border }]}
            onPress={() => setCategoria(cat)}
          >
            <Text style={[styles.catChipText, { color: categoria === cat ? c.primaryForeground : c.foreground }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products grid */}
      <FlatList
        data={filteredProds}
        keyExtractor={(i) => i.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 200, gap: 10 }}
        columnWrapperStyle={{ gap: 10 }}
        scrollEnabled={!!filteredProds.length}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.prodCard,
              { backgroundColor: c.card, borderColor: c.border, opacity: item.estoque <= 0 ? 0.5 : 1 },
            ]}
            onPress={() => addToCart(item)}
            activeOpacity={0.75}
          >
            <View style={[styles.prodIconBox, { backgroundColor: c.primary + "20" }]}>
              <Feather name="box" size={22} color={c.primary} />
            </View>
            <Text style={[styles.prodNome, { color: c.foreground }]} numberOfLines={2}>{item.nome}</Text>
            <Text style={[styles.prodPreco, { color: c.primary }]}>{fmtBRL(item.preco)}</Text>
            <Text style={[styles.prodEstoque, { color: item.estoque <= 5 ? (c.warning ?? "#d97706") : c.mutedForeground }]}>
              {item.estoque} un
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="box" size={40} color={c.mutedForeground} />
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Nenhum produto ativo</Text>
          </View>
        }
      />

      {/* Cart FAB */}
      {cart.itemsCount > 0 && (
        <TouchableOpacity
          style={[styles.cartFab, { backgroundColor: c.primary, bottom: bottomPad + 16 }]}
          onPress={() => setCheckoutVisible(true)}
        >
          <Feather name="shopping-cart" size={22} color={c.primaryForeground} />
          <Text style={[styles.cartFabText, { color: c.primaryForeground }]}>
            {cart.itemsCount} itens · {fmtBRL(cart.total)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Checkout Modal */}
      <Modal visible={checkoutVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCheckoutVisible(false)}>
        <View style={[styles.modalWrap, { backgroundColor: c.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setCheckoutVisible(false)}>
              <Feather name="x" size={22} color={c.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: c.foreground }]}>Finalizar Venda</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Items */}
            {cart.items.map((item) => (
              <View key={item.produtoId} style={[styles.cartItem, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cartItemNome, { color: c.foreground }]}>{item.nome}</Text>
                  <Text style={[styles.cartItemSub, { color: c.mutedForeground }]}>{fmtBRL(item.preco)} un</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    onPress={() => cart.updateQty(item.produtoId, item.quantidade - 1)}
                    style={[styles.qtyBtn, { backgroundColor: c.secondary }]}
                  >
                    <Feather name="minus" size={14} color={c.foreground} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { color: c.foreground }]}>{item.quantidade}</Text>
                  <TouchableOpacity
                    onPress={() => cart.updateQty(item.produtoId, item.quantidade + 1)}
                    style={[styles.qtyBtn, { backgroundColor: c.secondary }]}
                  >
                    <Feather name="plus" size={14} color={c.foreground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.cartItemTotal, { color: c.primary }]}>{fmtBRL(item.subtotal)}</Text>
              </View>
            ))}

            {/* Discount */}
            <View style={[styles.discountRow, { borderTopColor: c.border }]}>
              <Text style={[styles.discountLabel, { color: c.foreground }]}>Desconto (R$)</Text>
              <TextInput
                style={[styles.discountInput, { borderColor: c.border, color: c.foreground }]}
                value={cart.discount > 0 ? String(cart.discount) : ""}
                onChangeText={(v) => cart.setDiscount(parseFloat(v) || 0)}
                placeholder="0,00"
                placeholderTextColor={c.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Total */}
            <View style={[styles.totalRow, { borderTopColor: c.border }]}>
              <Text style={[styles.totalLabel, { color: c.mutedForeground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: c.primary }]}>{fmtBRL(cart.total)}</Text>
            </View>

            {/* Payment method */}
            <Text style={[styles.payTitle, { color: c.foreground }]}>Forma de Pagamento</Text>
            <View style={styles.payGrid}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.payBtn,
                    {
                      backgroundColor: cart.paymentMethod === m ? c.primary : c.secondary,
                      borderColor: cart.paymentMethod === m ? c.primary : c.border,
                    },
                  ]}
                  onPress={() => cart.setPaymentMethod(m)}
                >
                  <Feather
                    name={(PAYMENT_ICONS[m] ?? "credit-card") as any}
                    size={18}
                    color={cart.paymentMethod === m ? c.primaryForeground : c.foreground}
                  />
                  <Text
                    style={[
                      styles.payBtnText,
                      { color: cart.paymentMethod === m ? c.primaryForeground : c.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.finalizeBtn, { backgroundColor: c.primary }]}
              onPress={finalizeSale}
            >
              <Feather name="check-circle" size={20} color={c.primaryForeground} />
              <Text style={[styles.finalizeBtnText, { color: c.primaryForeground }]}>
                Registrar Venda
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.clearCartBtn, { borderColor: c.destructive }]}
              onPress={() => { cart.clearCart(); setCheckoutVisible(false); }}
            >
              <Text style={[styles.clearCartText, { color: c.destructive }]}>Limpar Carrinho</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Open Caixa Modal */}
      <OpenCaixaModal
        visible={openModalVisible}
        onClose={() => setOpenModalVisible(false)}
        onOpened={() => { setOpenModalVisible(false); load(); }}
        c={c}
        insets={insets}
      />
    </View>
  );
}

function OpenCaixaModal({ visible, onClose, onOpened, c, insets }: any) {
  const [valor, setValor] = useState("0");
  const [saving, setSaving] = useState(false);

  const open = async () => {
    setSaving(true);
    try {
      await addDoc(collection(db, "caixas"), {
        status: "aberto",
        valorInicial: parseFloat(valor) || 0,
        totalVendas: 0,
        valorFinal: null,
        dataAbertura: new Date().toISOString(),
        dataFechamento: null,
        createdAt: serverTimestamp(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onOpened();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível abrir o caixa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.modalWrap, { backgroundColor: c.background, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={c.foreground} /></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.foreground }]}>Abrir Caixa</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ padding: 24, gap: 20 }}>
          <View style={[styles.openIconBox, { backgroundColor: c.primary + "20" }]}>
            <Feather name="unlock" size={32} color={c.primary} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Valor de Abertura (R$)</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground, fontSize: 24, textAlign: "center" }]}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={c.mutedForeground}
            />
          </View>
          <TouchableOpacity
            style={[styles.finalizeBtn, { backgroundColor: c.primary }]}
            onPress={open}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={c.primaryForeground} /> : (
              <>
                <Feather name="unlock" size={20} color={c.primaryForeground} />
                <Text style={[styles.finalizeBtnText, { color: c.primaryForeground }]}>Abrir Caixa</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontWeight: "700" as const },
  caixaStatus: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 4, alignSelf: "flex-start" },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: "600" as const },
  caixaBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  caixaBtnText: { fontSize: 14, fontWeight: "600" as const },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: "500" as const },
  prodCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 8 },
  prodIconBox: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  prodNome: { fontSize: 14, fontWeight: "600" as const, textAlign: "center" as const },
  prodPreco: { fontSize: 16, fontWeight: "700" as const },
  prodEstoque: { fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  cartFab: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 18, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  cartFabText: { fontSize: 16, fontWeight: "600" as const },
  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" as const },
  cartItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  cartItemNome: { fontSize: 15, fontWeight: "500" as const },
  cartItemSub: { fontSize: 12, marginTop: 2 },
  cartItemTotal: { fontSize: 15, fontWeight: "700" as const, minWidth: 70, textAlign: "right" as const },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 15, fontWeight: "600" as const, minWidth: 24, textAlign: "center" as const },
  discountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 1, marginTop: 8 },
  discountLabel: { fontSize: 15, fontWeight: "500" as const },
  discountInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, width: 100, textAlign: "right" as const },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderTopWidth: 1 },
  totalLabel: { fontSize: 16 },
  totalValue: { fontSize: 26, fontWeight: "700" as const },
  payTitle: { fontSize: 15, fontWeight: "600" as const, marginTop: 8, marginBottom: 12 },
  payGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 10, marginBottom: 20 },
  payBtn: { flex: 1, minWidth: "45%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  payBtnText: { fontSize: 13, fontWeight: "500" as const },
  finalizeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 16, gap: 10 },
  finalizeBtnText: { fontSize: 16, fontWeight: "700" as const },
  clearCartBtn: { alignItems: "center", paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 10 },
  clearCartText: { fontSize: 14, fontWeight: "500" as const },
  openIconBox: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "500" as const },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
