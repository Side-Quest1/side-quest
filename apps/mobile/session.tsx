import {createContext,useEffect,useState,type ReactNode} from "react";
import {AppState,Linking} from "react-native";
import * as SecureStore from "expo-secure-store";
import {connect,type SupabaseClient} from "@sidequest/adapters";
import {useRouter} from "expo-router";
import Constants from "expo-constants";
import { installCryptoForAuth } from "./crypto";
export const MobileSession=createContext<{db?:SupabaseClient;authError:string}>({authError:""});
export function SessionProvider({children}:{children:ReactNode}){
  const router=useRouter();
  installCryptoForAuth();
  const [authError, setAuthError] = useState("");
  const [db] = useState(() =>
    __DEV__ && process.env.EXPO_PUBLIC_SIDEQUEST_MODE==="mock"?undefined:connect(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      },
    ),
  );
  useEffect(() => {
    if (!db) return;
    let active = true;
    let lastCode = "";
    const exchange = async (raw: string | null | undefined) => {
      if (!raw || !active) return;
      try {
        const url = new URL(raw);
        if (
          url.protocol !== "sidequest:" ||
          url.host !== "auth" ||
          url.pathname !== "/callback"
        )
          return;
        const code = url.searchParams.get("code");
        if (!code || code === lastCode) return;
        lastCode = code;
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } catch {
        if (active)
          setAuthError(
            "This sign-in link could not be opened. Request a fresh link on this device.",
          );
      }
    };
    void Linking.getInitialURL()
      .then(exchange)
      .catch(() => {
        if (active) setAuthError("Unable to open the sign-in link.");
      });
    const links = Linking.addEventListener("url", (e) => void exchange(e.url));
    const refresh = (state: string | null | undefined) =>
      state === "active"
        ? db.auth.startAutoRefresh()
        : db.auth.stopAutoRefresh();
    void refresh(AppState.currentState);
    const states = AppState.addEventListener("change", (s) => void refresh(s));
    return () => {
      active = false;
      links.remove();
      states.remove();
      void db.auth.stopAutoRefresh();
    };
  }, [db]);
  useEffect(()=>{
    if(!db || Constants.executionEnvironment==="storeClient")return;
    let active=true;let subscription:{remove:()=>void}|undefined;
    void import("expo-notifications").then(notifications=>{
      if(!active)return;
      const open=(response:ReturnType<typeof notifications.getLastNotificationResponse>)=>{
        const id=response?.notification.request.content.data?.activityId;
        if(typeof id==="string" && /^[a-f0-9-]{36}$/i.test(id)){
          router.push({pathname:"/activity/[id]",params:{id}});
          notifications.clearLastNotificationResponse();
        }
      };
      open(notifications.getLastNotificationResponse());
      subscription=notifications.addNotificationResponseReceivedListener(open);
    }).catch(()=>{});
    return ()=>{active=false;subscription?.remove();};
  },[db,router]);
  return <MobileSession.Provider value={{db,authError}}>{children}</MobileSession.Provider>;
}
