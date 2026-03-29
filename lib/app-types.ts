export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  upi_id: string | null;
  created_at?: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  responded_at: string | null;
};

export type DebtRequest = {
  id: string;
  creator_id: string;
  approver_id: string;
  amount_in_paise: number;
  currency: string;
  reason: string;
  debt_date: string;
  due_at: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

export type Settlement = {
  id: string;
  payer_id: string;
  receiver_id: string;
  amount_in_paise: number;
  currency: string;
  note: string | null;
  settled_at: string;
  status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

export type SharedItem = {
  id: string;
  owner_id: string;
  friend_id: string;
  item_name: string;
  type: "gave" | "borrowed";
  status: "active" | "returned";
  created_at: string;
};
