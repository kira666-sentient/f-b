import type { Profile, Friendship, DebtRequest, Settlement, SharedItem } from "./app-types";

export type FriendSummary = {
  friendshipId: string;
  profile: Profile;
  balanceInPaise: number;
};

export type ActivityItem = {
  id: string;
  kind: "debt" | "settlement";
  createdAt: string;
  profile: Profile | null;
  label: string;
  detail: string;
  status: string;
  amountInPaise: number;
};

export type StatementEntry = {
  id: string;
  createdAt: string;
  kind: "debt" | "settlement";
  title: string;
  detail: string;
  status: string;
  amountInPaise: number;
  balanceDeltaInPaise: number;
};

export type DashboardData = {
  profile: Profile | null;
  friendships: Friendship[];
  profiles: Profile[];
  debtRequests: DebtRequest[];
  settlements: Settlement[];
  sharedItems: SharedItem[];
};

export type DebtFormState = {
  friendId: string;
  amount: string;
  reason: string;
  debtDate: string;
  dueAt: string;
};

export type SettlementFormState = {
  friendId: string;
  amount: string;
  note: string;
};

export type ItemFormState = {
  name: string;
  type: "gave" | "borrowed";
  friendId: string;
  date: string;
};
