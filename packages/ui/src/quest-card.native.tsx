import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card } from "./native";
import { colors, spacing, themes } from "./index";
import type { QuestCardData } from "./quest-card-types";

export type { QuestCardData } from "./quest-card-types";

export function QuestCard({
  quest,
  hostName,
  action,
  actionLabel,
  actionDisabled = false,
  onPress,
}: {
  quest: QuestCardData;
  hostName: string;
  action?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  onPress?: () => void;
}) {
  const spots = Math.max(quest.capacity - quest.participantCount, 0);
  const cost = quest.estimatedCost
    ? `${quest.estimatedCost.currency} ${quest.estimatedCost.amount}`
    : "Free";

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${quest.title}`}
        onPress={onPress}
      >
        <View style={styles.topRow}>
          <Badge variant="category">{quest.category}</Badge>
          <Badge variant={quest.status === "open" ? "success" : "neutral"}>
            {quest.status === "open" ? `${spots} spots left` : quest.status}
          </Badge>
        </View>
        <Text style={styles.title}>{quest.title}</Text>
        <Text style={styles.description}>{quest.description}</Text>
        <View style={styles.metadata}>
          <Text style={styles.metaText}>{quest.date} · {quest.startTime}</Text>
          <Text style={styles.metaText}>
            {quest.locationLabel}
            {quest.approximateDistance ? ` · ${quest.approximateDistance}` : ""}
          </Text>
          <Text style={styles.metaText}>{cost} · Hosted by {hostName}</Text>
        </View>
      </Pressable>
      {action && actionLabel && (
        <Button onPress={action} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  title: {
    color: themes.light.text,
    fontSize: 19,
    fontWeight: "700",
  },
  description: {
    color: themes.light.textSecondary,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  metadata: {
    borderTopColor: themes.light.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  metaText: {
    color: colors.slate,
    fontSize: 12,
  },
});
