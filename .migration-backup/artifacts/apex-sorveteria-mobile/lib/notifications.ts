import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_SUMMARY_TYPE = "daily-summary";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export async function registerForPushNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch {
    return false;
  }
}

export async function sendLowStockAlert(
  productName: string,
  stock: number,
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ Estoque Baixo",
        body: `${productName} está com apenas ${stock} unidade${stock !== 1 ? "s" : ""}!`,
        data: { screen: "produtos" },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("sendLowStockAlert error:", e);
  }
}

export async function scheduleDailySummaryNotification(
  totalRevenue: number,
  salesCount: number,
  caixaTotal: number,
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as Record<string, unknown>)?.type === DAILY_SUMMARY_TYPE) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📊 Resumo do Dia",
        body: `${salesCount} venda${salesCount !== 1 ? "s" : ""} · Receita: ${fmt.format(totalRevenue)} · Caixa: ${fmt.format(caixaTotal)}`,
        data: { screen: "dashboard", type: DAILY_SUMMARY_TYPE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn("scheduleDailySummaryNotification error:", e);
  }
}
