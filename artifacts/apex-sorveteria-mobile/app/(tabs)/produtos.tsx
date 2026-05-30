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
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  custo: number | null;
  categoria: string | null;
  estoque: number;
  ativo: boolean;
}

const CATEGORIAS = ["Todas", "Potes", "Picolés", "Massas", "Açaí", "Bebidas", "Complementos"];

export default function ProdutosScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Produto | null>(null);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "produtos"), orderBy("createdAt", "desc"))
      );
      const list: Produto[] = snap.docs.map((d) => ({
        id: d.id,
        nome: d.data().nome ?? "",
        descricao: d.data().descricao ?? null,
        preco: d.data().preco ?? 0,
        custo: d.data().custo ?? null,
        categoria: d.data().categoria ?? null,
        estoque: d.data().estoque ?? 0,
        ativo: d.data().ativo ?? true,
      }));
      setProdutos(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = produtos.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoria === "Todas" || p.categoria === categoria;
    return matchSearch && matchCat;
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    load();
  };

  const openAdd = () => {
    setEditingItem(null);
    setModalVisible(true);
  };

  const openEdit = (p: Produto) => {
    setEditingItem(p);
    setModalVisible(true);
  };

  const toggleAtivo = async (p: Produto) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateDoc(doc(db, "produtos", p.id), {
      ativo: !p.ativo,
      updatedAt: serverTimestamp(),
    });
    setProdutos((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, ativo: !item.ativo } : item))
    );
  };

  const renderItem = ({ item }: { item: Produto }) => (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardMain}>
        <View style={[styles.catBadge, { backgroundColor: c.accent }]}>
          <Text style={[styles.catText, { color: c.accentForeground }]}>
            {item.categoria ?? "Sem categoria"}
          </Text>
        </View>
        <Text style={[styles.nomeProduto, { color: c.foreground }]}>{item.nome}</Text>
        <Text style={[styles.precoProduto, { color: c.primary }]}>{fmtBRL(item.preco)}</Text>
        <View style={styles.stockRow}>
          <Feather
            name="package"
            size={13}
            color={item.estoque <= 5 ? (c.warning ?? "#d97706") : c.mutedForeground}
          />
          <Text
            style={[
              styles.stockText,
              { color: item.estoque <= 5 ? (c.warning ?? "#d97706") : c.mutedForeground },
            ]}
          >
            {item.estoque} un
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: item.ativo ? c.success + "20" : c.muted }]}
          onPress={() => toggleAtivo(item)}
        >
          <Feather name={item.ativo ? "check-circle" : "circle"} size={16} color={item.ativo ? (c.success ?? "#16a34a") : c.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: c.secondary }]}
          onPress={() => openEdit(item)}
        >
          <Feather name="edit-2" size={16} color={c.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.foreground }]}>Produtos</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: c.primary }]}
          onPress={openAdd}
        >
          <Feather name="plus" size={20} color={c.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: c.border }]}>
        <View style={[styles.searchBox, { backgroundColor: c.muted, borderColor: c.border }]}>
          <Feather name="search" size={15} color={c.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: c.foreground }]}
            placeholder="Buscar produto..."
            placeholderTextColor={c.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={c.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.catScroll, { borderBottomColor: c.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}
      >
        {CATEGORIAS.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catChip,
              {
                backgroundColor: categoria === cat ? c.primary : c.secondary,
                borderColor: categoria === cat ? c.primary : c.border,
              },
            ]}
            onPress={() => setCategoria(cat)}
          >
            <Text
              style={[
                styles.catChipText,
                { color: categoria === cat ? c.primaryForeground : c.foreground },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="box" size={40} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                Nenhum produto encontrado
              </Text>
            </View>
          }
        />
      )}

      <ProdutoModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          setModalVisible(false);
          load();
        }}
        editItem={editingItem}
        c={c}
      />
    </View>
  );
}

function ProdutoModal({
  visible,
  onClose,
  onSaved,
  editItem,
  c,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editItem: Produto | null;
  c: any;
}) {
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [estoque, setEstoque] = useState("");
  const [categoria, setCategoria] = useState("Potes");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setNome(editItem.nome);
      setPreco(String(editItem.preco));
      setCusto(String(editItem.custo ?? ""));
      setEstoque(String(editItem.estoque));
      setCategoria(editItem.categoria ?? "Potes");
      setDescricao(editItem.descricao ?? "");
    } else {
      setNome("");
      setPreco("");
      setCusto("");
      setEstoque("0");
      setCategoria("Potes");
      setDescricao("");
    }
  }, [editItem, visible]);

  const save = async () => {
    if (!nome.trim() || !preco.trim()) {
      Alert.alert("Atenção", "Nome e preço são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        nome: nome.trim(),
        preco: parseFloat(preco) || 0,
        custo: custo ? parseFloat(custo) : null,
        estoque: parseInt(estoque) || 0,
        categoria,
        descricao: descricao.trim() || null,
        ativo: true,
        updatedAt: serverTimestamp(),
      };
      if (editItem) {
        await updateDoc(doc(db, "produtos", editItem.id), data);
      } else {
        await addDoc(collection(db, "produtos"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalWrap, { backgroundColor: c.background, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={c.foreground} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.foreground }]}>
            {editItem ? "Editar Produto" : "Novo Produto"}
          </Text>
          <TouchableOpacity
            onPress={save}
            style={[styles.saveBtn, { backgroundColor: c.primary, opacity: saving ? 0.7 : 1 }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={c.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: c.primaryForeground }]}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <ModalField label="Nome *" value={nome} onChangeText={setNome} placeholder="Ex: Pote 500ml" c={c} />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <ModalField label="Preço (R$) *" value={preco} onChangeText={setPreco} placeholder="0,00" keyboardType="decimal-pad" c={c} />
            </View>
            <View style={{ flex: 1 }}>
              <ModalField label="Custo (R$)" value={custo} onChangeText={setCusto} placeholder="0,00" keyboardType="decimal-pad" c={c} />
            </View>
          </View>
          <ModalField label="Estoque (un)" value={estoque} onChangeText={setEstoque} placeholder="0" keyboardType="number-pad" c={c} />
          <View>
            <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
              {CATEGORIAS.filter((c) => c !== "Todas").map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    { backgroundColor: categoria === cat ? c.primary : c.secondary, borderColor: categoria === cat ? c.primary : c.border },
                  ]}
                  onPress={() => setCategoria(cat)}
                >
                  <Text style={[styles.catChipText, { color: categoria === cat ? c.primaryForeground : c.foreground }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <ModalField label="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Opcional..." multiline c={c} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function ModalField({ label, value, onChangeText, placeholder, keyboardType, multiline, c }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.modalInput, { borderColor: c.border, backgroundColor: c.card, color: c.foreground, height: multiline ? 80 : undefined, textAlignVertical: multiline ? "top" : "center" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: "700" as const },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  catScroll: { borderBottomWidth: 1 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontWeight: "500" as const },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardMain: { flex: 1, gap: 4 },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 2,
  },
  catText: { fontSize: 11, fontWeight: "500" as const },
  nomeProduto: { fontSize: 16, fontWeight: "600" as const },
  precoProduto: { fontSize: 15, fontWeight: "700" as const },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stockText: { fontSize: 12 },
  cardActions: { gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" as const },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  saveBtnText: { fontWeight: "600" as const, fontSize: 14 },
  twoCol: { flexDirection: "row", gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "500" as const },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 6,
  },
});
