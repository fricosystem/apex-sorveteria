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
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRL = (v: number) => fmt.format(v);

interface Compra {
  id: string;
  numero: number;
  fornecedor: string;
  status: string;
  totalCusto: number;
  dataCompra: string;
  observacoes?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Pendente: { label: "Pendente", color: "#d97706", bg: "#fef3c7" },
  Recebida: { label: "Recebida", color: "#16a34a", bg: "#dcfce7" },
  Cancelada: { label: "Cancelada", color: "#dc2626", bg: "#fee2e2" },
  Concluida: { label: "Concluída", color: "#16a34a", bg: "#dcfce7" },
};

export default function ComprasScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Compra | null>(null);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "compras"), orderBy("dataCompra", "desc"))
      );
      const list: Compra[] = snap.docs.map((d) => {
        const raw = d.data().dataCompra;
        let dataCompra = new Date().toISOString();
        if (raw && typeof raw === "object" && "toDate" in raw) {
          dataCompra = raw.toDate().toISOString();
        } else if (typeof raw === "string") {
          dataCompra = raw;
        }
        return {
          id: d.id,
          numero: d.data().numero ?? 0,
          fornecedor: d.data().fornecedor ?? "",
          status: d.data().status ?? "Pendente",
          totalCusto: d.data().totalCusto ?? 0,
          dataCompra,
          observacoes: d.data().observacoes ?? null,
        };
      });
      setCompras(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = compras.filter((c) =>
    c.fornecedor.toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    load();
  };

  const updateStatus = async (id: string, status: Compra["status"]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateDoc(doc(db, "compras", id), { status, updatedAt: serverTimestamp() });
    setCompras((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  };

  const renderItem = ({ item }: { item: Compra }) => {
    const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.Pendente;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
        onPress={() => { setEditingItem(item); setModalVisible(true); }}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardNum, { color: c.mutedForeground }]}>
              #{String(item.numero).padStart(4, "0")}
            </Text>
            <Text style={[styles.cardFornecedor, { color: c.foreground }]}>{item.fornecedor}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.cardMeta}>
            <Feather name="calendar" size={12} color={c.mutedForeground} />
            <Text style={[styles.metaText, { color: c.mutedForeground }]}>{formatDate(item.dataCompra)}</Text>
          </View>
          <Text style={[styles.cardTotal, { color: c.primary }]}>{fmtBRL(item.totalCusto)}</Text>
        </View>

        {item.status === "Pendente" && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtnSmall, { backgroundColor: c.success + "20" }]}
              onPress={() => updateStatus(item.id, "Recebida")}
            >
              <Feather name="check" size={14} color={c.success ?? "#16a34a"} />
              <Text style={[styles.actionSmallText, { color: c.success ?? "#16a34a" }]}>Recebida</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnSmall, { backgroundColor: c.destructive + "20" }]}
              onPress={() => Alert.alert("Cancelar", "Confirmar cancelamento?", [
                { text: "Não" },
                { text: "Sim", onPress: () => updateStatus(item.id, "Cancelada"), style: "destructive" },
              ])}
            >
              <Feather name="x" size={14} color={c.destructive} />
              <Text style={[styles.actionSmallText, { color: c.destructive }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.foreground }]}>Compras</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: c.primary }]}
          onPress={() => { setEditingItem(null); setModalVisible(true); }}
        >
          <Feather name="plus" size={20} color={c.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, { borderBottomColor: c.border }]}>
        <View style={[styles.searchBox, { backgroundColor: c.muted, borderColor: c.border }]}>
          <Feather name="search" size={15} color={c.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: c.foreground }]}
            placeholder="Buscar fornecedor..."
            placeholderTextColor={c.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="truck" size={40} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>Nenhuma compra encontrada</Text>
            </View>
          }
        />
      )}

      <CompraModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={() => { setModalVisible(false); load(); }}
        editItem={editingItem}
        c={c}
      />
    </View>
  );
}

function CompraModal({ visible, onClose, onSaved, editItem, c }: any) {
  const insets = useSafeAreaInsets();
  const [fornecedor, setFornecedor] = useState("");
  const [total, setTotal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setFornecedor(editItem.fornecedor);
      setTotal(String(editItem.totalCusto));
      setObservacoes(editItem.observacoes ?? "");
    } else {
      setFornecedor("");
      setTotal("");
      setObservacoes("");
    }
  }, [editItem, visible]);

  const save = async () => {
    if (!fornecedor.trim()) {
      Alert.alert("Atenção", "Informe o fornecedor.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        fornecedor: fornecedor.trim(),
        totalCusto: parseFloat(total) || 0,
        observacoes: observacoes.trim() || null,
        status: "Pendente",
        dataCompra: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (editItem) {
        await updateDoc(doc(db, "compras", editItem.id), data);
      } else {
        const counterSnap = await getDocs(collection(db, "compras"));
        await addDoc(collection(db, "compras"), {
          ...data,
          numero: counterSnap.size + 1,
          createdAt: serverTimestamp(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalWrap, { backgroundColor: c.background, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={c.foreground} /></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.foreground }]}>{editItem ? "Editar Compra" : "Nova Compra"}</Text>
          <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: c.primary }]} disabled={saving}>
            {saving ? <ActivityIndicator color={c.primaryForeground} size="small" /> : <Text style={[styles.saveBtnText, { color: c.primaryForeground }]}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          {[
            { label: "Fornecedor *", value: fornecedor, set: setFornecedor, placeholder: "Nome do fornecedor" },
            { label: "Total (R$)", value: total, set: setTotal, placeholder: "0,00", keyboard: "decimal-pad" },
          ].map((f) => (
            <View key={f.label} style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>{f.label}</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground }]}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor={c.mutedForeground}
                keyboardType={(f as any).keyboard ?? "default"}
              />
            </View>
          ))}
          <View style={{ gap: 6 }}>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Observações</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground, height: 80, textAlignVertical: "top" }]}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Opcional..."
              placeholderTextColor={c.mutedForeground}
              multiline
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontWeight: "700" as const },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardNum: { fontSize: 12 },
  cardFornecedor: { fontSize: 16, fontWeight: "600" as const },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" as const },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  cardTotal: { fontSize: 16, fontWeight: "700" as const },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtnSmall: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  actionSmallText: { fontSize: 13, fontWeight: "500" as const },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" as const },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  saveBtnText: { fontWeight: "600" as const, fontSize: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "500" as const },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
});
