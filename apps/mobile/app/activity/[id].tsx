import { useLocalSearchParams } from "expo-router";
import App from "../../App";
export default function ActivityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <App initialActivityId={id} />;
}
