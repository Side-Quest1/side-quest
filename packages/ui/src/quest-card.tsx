import type { ReactNode } from "react";
import { Badge, Button, Card } from "./web";
import type { QuestCardData } from "./quest-card-types";

export type { QuestCardData } from "./quest-card-types";

type QuestCardProps = {
  quest: QuestCardData;
  hostName: string;
  action?: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  imageUrl?: string;
  imageAlt?: string;
  children?: ReactNode;
};

export function QuestCard({
  quest,
  hostName,
  action,
  actionLabel,
  actionDisabled = false,
  imageUrl,
  imageAlt,
  children,
}: QuestCardProps) {
  const spots = Math.max(quest.capacity - quest.participantCount, 0);

  const cost = quest.estimatedCost
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: quest.estimatedCost.currency,
        maximumFractionDigits: 0,
      }).format(quest.estimatedCost.amount)
    : "Free";

  const spotsLabel =
    quest.status === "open"
      ? spots > 0
        ? `${spots} spots left`
        : "Full"
      : quest.status;

  const spotsVariant =
    quest.status === "open" && spots > 0 ? "success" : "neutral";

  return (
    <Card
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 20,
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
      className="quest-card-interactive"
    >
      {imageUrl ? (
        <div
          style={{
            position: "relative",
            height: 200,
            background: "var(--surface-secondary)",
          }}
        >
          <img
            src={imageUrl}
            alt={imageAlt ?? quest.title}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <div style={{ position: "absolute", top: 14, left: 14 }}>
            <Badge variant="category">{quest.category}</Badge>
          </div>
          <div style={{ position: "absolute", top: 14, right: 14 }}>
            <Badge variant={spotsVariant}>{spotsLabel}</Badge>
          </div>
        </div>
      ) : (
        <div
          style={{
            height: 8,
            background: "var(--accent)",
          }}
        />
      )}

      <div
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        {!imageUrl && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Badge variant="category">{quest.category}</Badge>
            <Badge variant={spotsVariant}>{spotsLabel}</Badge>
          </div>
        )}

        <div>
          <h3
            style={{
              color: "var(--text-primary)",
              fontSize: 20,
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            {quest.title}
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              margin: "8px 0 0",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {quest.description}
          </p>
        </div>

        <div
          style={{
            color: "var(--text-secondary)",
            display: "grid",
            gap: 10,
            fontSize: 13,
          }}
        >
          <span><strong style={{ color: "var(--text-primary)" }}>When</strong> {quest.date} · {quest.startTime}</span>
          <span><strong style={{ color: "var(--text-primary)" }}>Where</strong> {quest.locationLabel}{quest.approximateDistance ? ` · ${quest.approximateDistance}` : ""}</span>
          <span><strong style={{ color: "var(--text-primary)" }}>Cost</strong> {cost}</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: "auto",
            paddingTop: 12,
            borderTop: "1px solid var(--divider)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {hostName.trim().charAt(0).toUpperCase() || "H"}
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Hosted by <strong style={{ color: "var(--text-primary)" }}>{hostName}</strong>
          </span>
        </div>

        {children}

        {action && actionLabel && (
          <Button
            onClick={action}
            disabled={actionDisabled}
            style={{ width: "100%", marginTop: 4 }}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}