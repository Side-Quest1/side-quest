import {SessionProvider} from "../session";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";

export default function Layout() {
  const [loaded, error] = useFonts({
    Manrope: require("../../../packages/ui/assets/Manrope.ttf"),
    Inter: require("../../../packages/ui/assets/Inter.ttf"),
  });
  if (!loaded && !error) return null;
  return <SessionProvider><Stack screenOptions={{ headerShown: false }} /></SessionProvider>;
}
