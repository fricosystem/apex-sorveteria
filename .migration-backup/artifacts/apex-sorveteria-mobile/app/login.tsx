import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/auth-context";
import { useColors } from "@/hooks/useColors";
import colors from "@/constants/colors";

type Tab = "login" | "register";

export default function LoginScreen() {
  const { login, register, loading } = useAuth();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !senha.trim()) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), senha);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password"
          ? "E-mail ou senha incorretos."
          : err?.code === "auth/invalid-credential"
          ? "Credenciais inválidas."
          : "Erro ao entrar. Tente novamente.";
      Alert.alert("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    if (senha !== confirmar) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return;
    }
    if (senha.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      await register(nome.trim(), email.trim(), senha);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        err?.code === "auth/email-already-in-use"
          ? "Este e-mail já está cadastrado."
          : "Erro ao criar conta. Tente novamente.";
      Alert.alert("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={[styles.logoBox, { backgroundColor: c.foreground }]}>
            <Text style={[styles.logoText, { color: c.background }]}>A</Text>
            <View style={[styles.logoDot, { backgroundColor: c.primary }]} />
          </View>
          <Text style={[styles.appName, { color: c.foreground }]}>APEX Sorveteria</Text>
          <Text style={[styles.appSub, { color: c.mutedForeground }]}>
            Sistema de Gestão Financeira
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Tabs */}
          <View style={[styles.tabRow, { backgroundColor: c.muted }]}>
            {(["login", "register"] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tabBtn,
                  tab === t && { backgroundColor: c.card, shadowColor: "#000" },
                ]}
                onPress={() => setTab(t)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: tab === t ? c.primary : c.mutedForeground },
                  ]}
                >
                  {t === "login" ? "Entrar" : "Criar Conta"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formArea}>
            {tab === "register" && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>Nome</Text>
                <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                  <Feather name="user" size={16} color={c.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: c.foreground }]}
                    placeholder="Seu nome"
                    placeholderTextColor={c.mutedForeground}
                    value={nome}
                    onChangeText={setNome}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>E-mail</Text>
              <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <Feather name="mail" size={16} color={c.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: c.foreground }]}
                  placeholder="seu@email.com"
                  placeholderTextColor={c.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>Senha</Text>
              <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <Feather name="lock" size={16} color={c.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: c.foreground }]}
                  placeholder="••••••••"
                  placeholderTextColor={c.mutedForeground}
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!showSenha}
                />
                <TouchableOpacity onPress={() => setShowSenha((v) => !v)}>
                  <Feather
                    name={showSenha ? "eye-off" : "eye"}
                    size={16}
                    color={c.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {tab === "register" && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: c.mutedForeground }]}>Confirmar Senha</Text>
                <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                  <Feather name="lock" size={16} color={c.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: c.foreground }]}
                    placeholder="••••••••"
                    placeholderTextColor={c.mutedForeground}
                    value={confirmar}
                    onChangeText={setConfirmar}
                    secureTextEntry={!showSenha}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: c.primary, opacity: submitting ? 0.7 : 1 }]}
              onPress={tab === "login" ? handleLogin : handleRegister}
              disabled={submitting || loading}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <>
                  <Text style={[styles.submitLabel, { color: c.primaryForeground }]}>
                    {tab === "login" ? "Entrar" : "Criar Conta"}
                  </Text>
                  <Feather name="arrow-right" size={18} color={c.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <Feather name="shield" size={12} color={c.mutedForeground} />
            <Text style={[styles.footerText, { color: c.mutedForeground }]}>
              Desenvolvido por APEX HUB
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  logoText: { fontSize: 36, fontWeight: "700" as const },
  logoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: "absolute",
    top: 6,
    right: 6,
  },
  appName: { fontSize: 22, fontWeight: "700" as const, marginBottom: 4 },
  appSub: { fontSize: 13 },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  tabRow: {
    flexDirection: "row",
    margin: 8,
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: { fontSize: 14, fontWeight: "600" as const },
  formArea: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "500" as const },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  submitLabel: { fontSize: 16, fontWeight: "600" as const },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 6,
  },
  footerText: { fontSize: 12 },
});
