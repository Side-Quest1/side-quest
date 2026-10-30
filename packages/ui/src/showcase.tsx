import { Badge, Button, Card, EmptyState, Input, LoadingState, ThemePreview } from "./web";

export function UiShowcase() {
  return <main style={{ display: "grid", gap: 16, maxWidth: 640, padding: 32 }}>
    <ThemePreview mode="light" />
    <ThemePreview mode="dark" />
    <Card>
      <h2>Shared component showcase</h2>
      <Input aria-label="Example input" placeholder="Search quests" />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button>Primary action</Button>
        <Button variant="outline">Secondary action</Button>
        <Badge variant="category">Outdoors</Badge>
      </div>
    </Card>
    <EmptyState title="No quests yet" description="Create the first plan for your crew." />
    <LoadingState />
  </main>;
}
