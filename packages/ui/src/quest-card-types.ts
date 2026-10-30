export type QuestCardData = {
  title: string;
  description: string;
  category: string;
  date: string;
  startTime: string;
  locationLabel: string;
  approximateDistance?: string;
  capacity: number;
  participantCount: number;
  estimatedCost?: { amount: number; currency: string };
  status: string;
  joinMode: string;
};
