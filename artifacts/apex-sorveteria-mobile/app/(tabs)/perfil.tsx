import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/auth-context";
import { useColors } from "@/hooks/useColors";

export default function PerfilScreen() {
  const { user, userData, logout, refreshUserData } = useAuth();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  };

  const initials = (userData?.nome ?? user?.displayName ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase())
    .join("");

  const infoRows = [
    { icon: "user", label: "Nome", value: userData?.nome ?? user?.displayName ?? "—" },
    { icon: "mail", label: "E-mail", value: user?.email ?? "—" },
    { icon: "shield", label: "Perfil", value: userData?.role === "admin" ? "Administrador" : "Usuário" },
  ];

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 16, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: c.primary }]}>
          <Text style={[styles.avatarText, { color: c.primaryForeground }]}>{initials}</Text>
        </View>
        <Text style={[styles.displayName, { color: c.foreground }]}>
          {userData?.nome ?? user?.displayName ?? "Usuário"}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: c.primary + "20" }]}>
          <Feather name="shield" size={13} color={c.primary} />
          <Text style={[styles.roleText, { color: c.primary }]}>
            {userData?.role === "admin" ? "Administrador" : "Usuário"}
          </Text>
        </View>
      </View>

      {/* Info card */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.mutedForeground }]}>Informações da Conta</Text>
        {infoRows.map((row, idx) => (
          <View
            key={row.label}
            style={[
              styles.infoRow,
              { borderTopColor: c.border, borderTopWidth: idx === 0 ? 0 : 1 },
            ]}
          >
            <View style={[styles.infoIcon, { backgroundColor: c.muted }]}>
              <Feather name={row.icon as any} size={16} color={c.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: c.mutedForeground }]}>{row.label}</Text>
              <Text style={[styles.infoValue, { color: c.foreground }]}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* App info */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.mutedForeground }]}>Sobre o App</Text>
        <View style={styles.appInfoRow}>
          <View style={[styles.appIconSmall, { backgroundColor: c.foreground }]}>
            <Text style={[styles.appIconText, { color: c.background }]}>A</Text>
          </View>
          <View>
            <Text style={[styles.appName, { color: c.foreground }]}>APEX Sorveteria</Text>
            <Text style={[styles.appVersion, { color: c.mutedForeground }]}>
              Sistema de Gestão · v1.0
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <View style={[styles.infoRow, { borderTopWidth: 0 }]}>
          <Feather name="shield" size={14} color={c.mutedForeground} />
          <Text style={[styles.appVersion, { color: c.mutedForeground, marginLeft: 8 }]}>
            Desenvolvido por APEX HUB
          </Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: c.destructive, backgroundColor: c.destructive + "10" }]}
        onPress={handleLogout}
        disabled={loggingOut}
        activeOpacity={0.8}
      >
        {loggingOut ? (
          <ActivityIndicator color={c.destructive} />
        ) : (
          <>
            <Feather name="log-out" size={18} color={c.destructive} />
            <Text style={[styles.logoutText, { color: c.destructive }]}>Sair da Conta</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: 20 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: "700" as const },
  displayName: { fontSize: 22, fontWeight: "700" as const, marginBottom: 8 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleText: { fontSize: 13, fontWeight: "600" as const },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 0,
  },
  cardTitle: { fontSize: 12, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 12 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 15, fontWeight: "500" as const },
  appInfoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 },
  appIconSmall: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  appIconText: { fontSize: 20, fontWeight: "700" as const },
  appName: { fontSize: 15, fontWeight: "600" as const },
  appVersion: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginVertical: 8 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
    marginTop: 4,
  },
  logoutText: { fontSize: 16, fontWeight: "600" as const },
});
