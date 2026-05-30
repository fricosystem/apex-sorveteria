import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { useColors } from "@/hooks/useColors";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRL = (v: number) => fmt.format(v);

interface DashboardData {
  receitaHoje: number;
  vendasHoje: number;
  caixaAberto: boolean;
  valorInicialCaixa: number;
  produtosBaixoEstoque: number;
  totalProdutos: number;
}

async function fetchDashboard(): Promise<DashboardData> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date();
  fimHoje.setHours(23, 59, 59, 999);
  const inicioTS = Timestamp.fromDate(hoje);
  const fimTS = Timestamp.fromDate(fimHoje);

  const [vendasSnap, caixaSnap, produtosSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "vendas"),
        where("createdAt", ">=", inicioTS),
        where("createdAt", "<=", fimTS)
      )
    ),
    getDocs(query(collection(db, "caixas"), where("status", "==", "aberto"), limit(1))),
    getDocs(query(collection(db, "produtos"), where("ativo", "==", true))),
  ]);

  const vendasConcluidas = vendasSnap.docs.filter(
    (d) => d.data().status === "concluida"
  );
  const receitaHoje = vendasConcluidas.reduce(
    (s, d) => s + ((d.data().total as number) || 0),
    0
  );
  const caixaAberto = !caixaSnap.empty;
  const valorInicialCaixa = caixaAberto
    ? (caixaSnap.docs[0].data().valorInicial as number) || 0
    : 0;

  let baixoEstoque = 0;
  produtosSnap.docs.forEach((d) => {
    if (((d.data().estoque as number) || 0) <= 5) baixoEstoque++;
  });

  return {
    receitaHoje,
    vendasHoje: vendasSnap.size,
    caixaAberto,
    valorInicialCaixa,
    produtosBaixoEstoque: baixoEstoque,
    totalProdutos: produtosSnap.size,
  };
}

export default function DashboardScreen() {
  const { userData } = useAuth();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
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

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    load();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={c.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: c.mutedForeground }]}>{greeting()},</Text>
          <Text style={[styles.userName, { color: c.foreground }]}>
            {userData?.nome?.split(" ")[0] ?? "Usuário"} 👋
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: c.secondary }]}>
          <Text style={[styles.badgeText, { color: c.primary }]}>
            {userData?.role === "admin" ? "Admin" : "Usuário"}
          </Text>
        </View>
      </View>

      {/* Caixa status */}
      <View
        style={[
          styles.caixaCard,
          {
            backgroundColor: data?.caixaAberto ? c.primary : c.muted,
            borderColor: data?.caixaAberto ? c.primary : c.border,
          },
        ]}
      >
        <View style={styles.caixaRow}>
          <Feather
            name={data?.caixaAberto ? "unlock" : "lock"}
            size={20}
            color={data?.caixaAberto ? c.primaryForeground : c.mutedForeground}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={[
                styles.caixaLabel,
                { color: data?.caixaAberto ? c.primaryForeground : c.mutedForeground },
              ]}
            >
              Caixa {data?.caixaAberto ? "Aberto" : "Fechado"}
            </Text>
            {data?.caixaAberto && (
              <Text style={[styles.caixaSub, { color: c.primaryForeground }]}>
                Abertura: {fmtBRL(data.valorInicialCaixa)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Metrics */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Receita Hoje"
              value={fmtBRL(data?.receitaHoje ?? 0)}
              icon="dollar-sign"
              iconColor={c.success ?? "#16a34a"}
              c={c}
            />
            <MetricCard
              title="Vendas Hoje"
              value={String(data?.vendasHoje ?? 0)}
              icon="shopping-bag"
              iconColor={c.primary}
              c={c}
            />
          </View>
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Produtos Ativos"
              value={String(data?.totalProdutos ?? 0)}
              icon="package"
              iconColor="#6366f1"
              c={c}
            />
            <MetricCard
              title="Estoque Baixo"
              value={String(data?.produtosBaixoEstoque ?? 0)}
              icon="alert-triangle"
              iconColor={
                (data?.produtosBaixoEstoque ?? 0) > 0
                  ? c.warning ?? "#d97706"
                  : c.mutedForeground
              }
              c={c}
              alert={(data?.produtosBaixoEstoque ?? 0) > 0}
            />
          </View>
        </>
      )}

      {/* Date */}
      <View style={[styles.dateRow, { borderColor: c.border }]}>
        <Feather name="calendar" size={14} color={c.mutedForeground} />
        <Text style={[styles.dateText, { color: c.mutedForeground }]}>
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
    </ScrollView>
  );
}

function MetricCard({
  title,
  value,
  icon,
  iconColor,
  c,
  alert,
}: {
  title: string;
  value: string;
  icon: any;
  iconColor: string;
  c: any;
  alert?: boolean;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: c.card,
          borderColor: alert ? c.warning ?? "#d97706" : c.border,
          borderWidth: alert ? 1.5 : 1,
        },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: iconColor + "20" }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.metricValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[styles.metricTitle, { color: c.mutedForeground }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 120 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  greeting: { fontSize: 14 },
  userName: { fontSize: 22, fontWeight: "700" as const },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { fontSize: 13, fontWeight: "600" as const },
  caixaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  caixaRow: { flexDirection: "row", alignItems: "center" },
  caixaLabel: { fontSize: 16, fontWeight: "600" as const },
  caixaSub: { fontSize: 13, marginTop: 2 },
  loadingArea: { paddingVertical: 40, alignItems: "center" },
  metricsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { fontSize: 22, fontWeight: "700" as const },
  metricTitle: { fontSize: 12 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  dateText: { fontSize: 13, textTransform: "capitalize" as const },
});
