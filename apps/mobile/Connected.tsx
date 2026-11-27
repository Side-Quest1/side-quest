import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
} from "react";
import {
  ScrollView,
  FlatList,Animated,AccessibilityInfo,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Linking,
  AppState,
  BackHandler,
  Share,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {MobileSession} from "./session";
import { StatusBar } from "expo-status-bar";
import { LiveActivities } from "@sidequest/application/activities";
import { Button, Input, useTheme } from "@sidequest/ui/native";
import { themes } from "@sidequest/ui";
import { DeviceAlerts, disconnectDevice } from "./device-alerts";
import { activityCode } from "@sidequest/application/share";
import { Image as ExpoImage } from "expo-image";

const Viewport = createContext<Set<() => void> | null>(null);
const ui: ComponentProps<typeof LiveActivities>["ui"] = {
  areaLocation:async()=>{
    const location=await import("expo-location");
    const permission=await location.requestForegroundPermissionsAsync();
    if(!permission.granted)throw Error("Location permission was declined. Enter your area manually.");
    const {coords}=await location.getCurrentPositionAsync({accuracy:location.Accuracy.Low});
    return {latitude:coords.latitude.toFixed(2),longitude:coords.longitude.toFixed(2)};
  },
  FeedList:function FeedList({header,ids,render,footer}){
    const viewport=useContext(Viewport);
    return <FlatList style={{flex:1}} data={ids} keyExtractor={id=>id} initialNumToRender={4} windowSize={5}
      renderItem={({item})=><View style={{paddingVertical:14}}>{render(item)}</View>}
      ListHeaderComponent={<View>{header}</View>} ListFooterComponent={<View>{footer}</View>}
      onScroll={()=>viewport?.forEach(check=>check())} scrollEventThrottle={180} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20}}/>;
  },
  storage: AsyncStorage,
  DeviceAlerts,
  disconnectDevice,
  Exposure: function Exposure({ children, visible }) {
    const viewport = useContext(Viewport),
      ref = useRef<ComponentRef<typeof View>>(null),
      seen = useRef(false);
    const { height } = useWindowDimensions();
    useEffect(() => {
      if (!viewport || seen.current) return;
      let active = true;
      const check = () =>
        ref.current?.measureInWindow((_x, y, _w, h) => {
          if (
            active &&
            !seen.current &&
            AppState.currentState === "active" &&
            h > 0 &&
            Math.min(height - 70, y + h) - Math.max(y, 0) >= h * 0.25
          ) {
            seen.current = true;
            viewport.delete(check);
            visible();
          }
        });
      viewport.add(check);
      check();
      return () => {
        active = false;
        viewport.delete(check);
      };
    }, [height, visible, viewport]);
    return (
      <View ref={ref} collapsable={false}>
        {children}
      </View>
    );
  },
  Heading: function Heading({ children }) {
    const { theme } = useTheme();
    const position=useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      let active=true;
      void AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{
        if(!active || reduced)return;
        position.setValue(5);
        Animated.timing(position,{toValue:0,duration:160,useNativeDriver:true}).start();
      });
      return ()=>{active=false;position.stopAnimation();};
    },[position]);
    return (
      <Animated.Text
        accessibilityRole="header"
        style={{
          color: theme.textPrimary,
          fontSize: 30,
          fontFamily:"Manrope",transform:[{translateY:position}],
          fontWeight: "800",
          letterSpacing: -1.3,
        }}
      >
        {children}
      </Animated.Text>
    );
  },
  Cover: ({ title, kicker, subtitle, image }) => (
    <View style={{ minHeight: 260, justifyContent: "flex-end", backgroundColor: "#172B25", borderRadius: 22, overflow: "hidden" }}>
      <ExpoImage source={image ? { uri: image } : require("../../packages/ui/assets/trail.jpg")} contentFit="cover" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <View style={{ padding: 20, gap: 5, backgroundColor: "rgba(10,24,18,.74)" }}>
        <Text
          style={{
            color: "#C8F169",
            fontWeight: "800",
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: "white",
            fontWeight: "800",
            fontSize: 37,
            fontFamily:"Manrope",
            letterSpacing: -1.6,
          }}
        >
          {title}
        </Text>
        <Text style={{ color: "white" }}>{subtitle}</Text>
      </View>
    </View>
  ),
  Choices: function Choices({ label, values, labels, current, choose }) {
    const { theme } = useTheme();
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {values.map((v, i) => {
            const selected = v === current || !!labels?.[i]?.startsWith("✓");
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={v}
                onPress={() => choose(v)}
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  opacity: pressed ? 0.75 : 1,
                  paddingHorizontal: 14,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: selected ? "#C8F169" : theme.surface,
                })}
              >
                <Text
                  style={{ color: selected ? "#172B25" : theme.textPrimary }}
                >
                  {labels?.[i] ?? v}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  },
  AreaMap: ({ item }) => {
    const lat =
        (Math.max(-85, Math.min(85, Number(item.latitude))) * Math.PI) / 180,
      lon = Number(item.longitude);
    const x = ((lon + 180) / 360) * 4096,
      y = ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * 4096;
    return (
      <View style={{ alignItems: "center", gap: 4 }}>
        <View accessibilityLabel={"Approximate area of " + item.title} style={{ width: 256, height: 256, position: "relative", overflow: "hidden", backgroundColor: "#E8EBDD" }}>
          <ExpoImage
            source={{
              uri:
                "https://tile.openstreetmap.org/12/" +
                (Math.floor(x) % 4096) +
                "/" +
                Math.floor(y) +
                ".png",
              headers: { "User-Agent": "SideQuest activity discovery" },
            }}
            contentFit="cover"
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={{
              position: "absolute",
              left: Math.max(0, (x % 1) * 256 - 6),
              top: Math.max(0, (y % 1) * 256 - 6),
              width: 14,
              height: 14,
              backgroundColor: "#172B25",
              borderColor: "#C8F169",
              borderWidth: 3,
              borderRadius: 7,
            }}
          />
        </View>
        <Button
          onPress={() =>
            void Linking.openURL(
              "https://www.openstreetmap.org/?mlat=" +
                item.latitude +
                "&mlon=" +
                lon,
            )
          }
        >
          © OpenStreetMap contributors
        </Button>
      </View>
    );
  },
  Links: function Links({ item }) {
    const [code, setCode] = useState<boolean[][]>();
    const url =
      (process.env.EXPO_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "") ??
        "sidequest:/") +
      "/activity/" +
      item.id;
    return (
      <View style={{ gap: 8 }}>
        <Button onPress={() => void Share.share({ message: url })}>
          Share activity
        </Button>
        <Button onPress={() => setCode(code ? undefined : activityCode(url))}>
          {code ? "Hide QR code" : "Show QR code"}
        </Button>
        {code && (
          <View
            accessible
            accessibilityLabel="Scannable activity link"
            style={{
              alignSelf: "flex-start",
              backgroundColor: "white",
              padding: 16,
            }}
          >
            {code.map((row, y) => (
              <View key={y} style={{ flexDirection: "row" }}>
                {row.map((dark, x) => (
                  <View
                    key={x}
                    style={{
                      width: 4,
                      height: 4,
                      backgroundColor: dark ? "black" : "white",
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
        <Button
          onPress={() =>
            void Linking.openURL(
              "https://www.openstreetmap.org/search?query=" +
                encodeURIComponent(item.area),
            )
          }
        >
          Map of area
        </Button>
      </View>
    );
  },
  Screen: function Screen({ children, footer, back, virtualized, contentKey }) {
    const [viewport] = useState(() => new Set<() => void>());
    const entrance = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (!back) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        back();
        return true;
      });
      return () => sub.remove();
    }, [back]);
    useEffect(() => {
      let active = true;
      void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (!active || reduced) return;
        entrance.setValue(0);
        Animated.timing(entrance, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      });
      return () => {
        active = false;
        entrance.stopAnimation();
      };
    }, [contentKey, entrance]);
    return (
      <Viewport.Provider value={viewport}>
        <View style={{ flex: 1 }}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={back}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                marginHorizontal: 20,
                marginTop: 12,
                minHeight: 40,
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: "#397B53", fontWeight: "800" }}>← Back</Text>
            </Pressable>
          )}
          <Animated.View style={{ flex: 1, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          {virtualized?children:<ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            onScroll={() => viewport.forEach((check) => check())}
            scrollEventThrottle={180}
            contentContainerStyle={{ padding: 20 }}
          >
            {children}
          </ScrollView>}
          </Animated.View>
          {footer}
        </View>
      </Viewport.Provider>
    );
  },
  Theme: function Theme() {
    const { mode, setMode } = useTheme();
    return (
      <Button
        onPress={() =>
          setMode(
            mode === "system" ? "light" : mode === "light" ? "dark" : "system",
          )
        }
      >
        Theme · {mode}
      </Button>
    );
  },
  Nav: function Navigation({ current, choose }) {
    const { bottom } = useSafeAreaInsets();
    return (
      <View
        style={{
          flexDirection: "row",
          borderRadius: 24,
          padding: 4,
          backgroundColor: "#172B25",
          marginBottom: bottom,
        }}
      >
        {["Discover", "My Activities", "Create", "Alerts", "Profile"].map(
          (tab) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === current }}
              onPress={() => choose(tab)}
              style={{
                flex: 1,
                minHeight: 50,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tab === "Create" ? "#C8F169" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  textAlign: "center",
                  color:
                    tab === "Create"
                      ? "#172B25"
                      : tab === current
                        ? "#C8F169"
                        : "#FFFFFF",
                }}
              >
                {tab === "Create" ? "+ Create" : tab}
              </Text>
            </Pressable>
          ),
        )}
      </View>
    );
  },
  Section: ({ children }) => (
    <View style={{ gap: 12, paddingVertical: 8 }}>{children}</View>
  ),
  Label: function Label({ children }) {
    const { theme } = useTheme();
    return <Text style={{ color: theme.textPrimary,fontFamily:"Inter" }}>{children}</Text>;
  },
  Field: ({ label, value, change, secret }) => (
    <View style={{gap:4}}><ui.Label>{label}</ui.Label><Input
      accessibilityLabel={label}
      placeholder={label}
      value={value}
      autoCapitalize="none"
      secureTextEntry={secret}
      onChangeText={change}
    /></View>
  ),
  Action: ({ label, press, disabled }) => (
    <Button onPress={press} disabled={disabled}>
      {label}
    </Button>
  ),
};
export default function Connected({
  initialActivityId,
}: {
  initialActivityId?: string;
}) {
  const { theme } = useTheme();
  const {db,authError}=useContext(MobileSession);
  const activityId=initialActivityId;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme === themes.dark ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {authError ? <ui.Label>{authError}</ui.Label> : null}
        <LiveActivities
          db={db}
          ui={ui}
          redirectTo="sidequest://auth/callback"
          activityId={activityId}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
