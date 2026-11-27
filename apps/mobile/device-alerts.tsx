import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type { SupabaseClient } from "@sidequest/adapters";
import { Button, useTheme } from "@sidequest/ui/native";

const key = (user: string) => "sidequest.push." + user;
export async function disconnectDevice(db: SupabaseClient, user: string) {
  const token = await SecureStore.getItemAsync(key(user));
  if (!token) return;
  const { error } = await db.from("push_devices").delete().eq("token", token);
  if (error) throw error;
  await SecureStore.deleteItemAsync(key(user));
}
export function DeviceAlerts({
  db,
  user,
}: {
  db: SupabaseClient;
  user: string;
}) {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(key(user)).then((v) => {
      if (active) setEnabled(!!v);
    });
    return () => {
      active = false;
    };
  }, [user]);
  async function change() {
    setBusy(true);
    try {
      if (enabled) {
        await disconnectDevice(db, user);
        setEnabled(false);
        setMessage("Device alerts disabled.");
        return;
      }
      if (!Device.isDevice || Constants.executionEnvironment === "storeClient")
        throw Error(
          "Use a signed development build on your device to enable push.",
        );
      const Notifications = await import("expo-notifications");
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("activities", {
          name: "Activity coordination",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted")
        throw Error("Notification permission was declined.");
      const projectId =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw Error("This build needs an EAS project ID.");
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      await SecureStore.setItemAsync(key(user), token);
      const { error } = await db.from("push_devices").insert({ token });
      if (error) {
        const existing = await db
          .from("push_devices")
          .select("token")
          .eq("token", token)
          .maybeSingle();
        if (!existing.data) {
          await SecureStore.deleteItemAsync(key(user));
          throw error;
        }
      }
      setEnabled(true);
      setMessage("Device alerts enabled.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to update device alerts.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Button disabled={busy} onPress={() => void change()}>
        {enabled ? "Disable device alerts" : "Enable device alerts"}
      </Button>
      {!!message && <Text style={{ color: theme.textPrimary }}>{message}</Text>}
    </View>
  );
}
