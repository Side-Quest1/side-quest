import type { ReactNode } from "react";
import { Badge, Button, Card } from "./web";
import type { QuestCardData } from "./quest-card-types";

export type { QuestCardData } from "./quest-card-types";

export function QuestCard({
  quest,
  hostName,
  action,
  actionLabel,
  actionDisabled = false,
  children,
}: {
  quest: QuestCardData;
  hostName: string;
  action?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  children?: ReactNode;
}) {
  const spots = Math.max(quest.capacity - quest.participantCount, 0);
  const cost = quest.estimatedCost
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: quest.estimatedCost.currency,
        maximumFractionDigits: 0,
      }).format(quest.estimatedCost.amount)
    : "Free";

  return (
    <Card style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <Badge variant="category">{quest.category}</Badge>
        <Badge variant={quest.status === "open" ? "success" : "neutral"}>
          {quest.status === "open" ? `${spots} spots left` : quest.status}
        </Badge>
      </div>
      <div>
        <h3 style={{ color: "#172B25", fontSize: 20, margin: 0 }}>{quest.title}</h3>
        <p style={{ color: "#68756D", lineHeight: 1.5, margin: "8px 0 0" }}>{quest.description}</p>
      </div>
      <div style={{ color: "#68756D", display: "grid", gap: 6, fontSize: 13 }}>
        <span>{quest.date} · {quest.startTime}</span>
        <span>{quest.locationLabel}{quest.approximateDistance ? ` · ${quest.approximateDistance}` : ""}</span>
        <span>{cost} · Hosted by {hostName}</span>
      </div>
      {children}
      {action && actionLabel && (
        <Button onClick={action} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}
