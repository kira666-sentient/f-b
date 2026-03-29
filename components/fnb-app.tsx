"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getAppOrigin,
  getSupabaseBrowserClient,
  hasSupabaseEnv
} from "@/lib/supabase";
import type {
  DebtRequest,
  Friendship,
  Profile,
  Settlement
} from "@/lib/app-types";

type FriendSummary = {
  friendshipId: string;
  profile: Profile;
  balanceInPaise: number;
};

type ActivityItem = {
  id: string;
  kind: "debt" | "settlement";
  createdAt: string;
  profile: Profile | null;
  label: string;
  detail: string;
  status: string;
  amountInPaise: number;
};

type StatementEntry = {
  id: string;
  createdAt: string;
  kind: "debt" | "settlement";
  title: string;
  detail: string;
  status: string;
  amountInPaise: number;
  balanceDeltaInPaise: number;
};

type DashboardData = {
  profile: Profile | null;
  friendships: Friendship[];
  profiles: Profile[];
  debtRequests: DebtRequest[];
  settlements: Settlement[];
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium"
});

function formatCurrency(amountInPaise: number) {
  return money.format(amountInPaise / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return dateTime.format(new Date(value));
}

function formatUsernameCandidate(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function makeStarterUsername(user: User) {
  const emailPart = user.email?.split("@")[0] ?? "friend";
  const base = formatUsernameCandidate(emailPart) || "friend";
  const suffix = user.id.replace(/-/g, "").slice(0, 4);
  return `${base}_${suffix}`;
}

function readableProfile(profile?: Profile | null) {
  return profile?.full_name || profile?.username || "Friend";
}

function initialsFor(profile?: Profile | null) {
  const source = readableProfile(profile).trim();
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "FB";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getErrorMessage(cause: unknown) {
  if (typeof cause === "string") {
    return cause;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  return "Something went wrong. Please try again.";
}

export default function FnbApp() {
  const supabase = getSupabaseBrowserClient();
  const envReady = hasSupabaseEnv();

  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUsername, startSavingUsername] = useTransition();
  const [mutating, startMutation] = useTransition();

  const [dashboard, setDashboard] = useState<DashboardData>({
    profile: null,
    friendships: [],
    profiles: [],
    debtRequests: [],
    settlements: []
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [usernameDraft, setUsernameDraft] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [debtForm, setDebtForm] = useState({
    friendId: "",
    amount: "",
    reason: "",
    debtDate: new Date().toISOString().slice(0, 10),
    dueAt: ""
  });
  const [settlementForm, setSettlementForm] = useState({
    friendId: "",
    amount: "",
    note: ""
  });
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState("");

  function openProfileDialog() {
    setUsernameDraft(dashboard.profile?.username ?? "");
    setIsProfileDialogOpen(true);
  }

  function openStatementDialog(friendId: string) {
    setSelectedFriendId(friendId);
    setIsStatementDialogOpen(true);
  }

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setBooting(false);
      return;
    }

    const readyClient = client;

    let active = true;

    async function bootstrap() {
      const {
        data: { session: currentSession }
      } = await readyClient.auth.getSession();

      if (!active) {
        return;
      }

      setSession(currentSession);

      if (currentSession?.user) {
        await ensureProfile(currentSession.user);
        await loadDashboard(currentSession.user.id);
      }

      if (active) {
        setBooting(false);
      }
    }

    bootstrap().catch((cause: unknown) => {
      if (active) {
        setError(getErrorMessage(cause));
        setBooting(false);
      }
    });

    const {
      data: { subscription }
    } = readyClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event !== "TOKEN_REFRESHED") {
        setError(null);
        setFeedback(null);
      }

      if (!nextSession?.user) {
        setDashboard({
          profile: null,
          friendships: [],
          profiles: [],
          debtRequests: [],
          settlements: []
        });
        return;
      }

      const shouldSyncProfile =
        event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION";

      void (async () => {
        try {
          if (shouldSyncProfile) {
            await ensureProfile(nextSession.user);
          }

          await loadDashboard(nextSession.user.id, { silent: true });
        } catch (cause: unknown) {
          setError(getErrorMessage(cause));
        }
      })();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const refreshSilently = () => {
      void loadDashboard(session.user.id, { silent: true }).catch((cause: unknown) => {
        setError(getErrorMessage(cause));
      });
    };

    const intervalId = window.setInterval(refreshSilently, 5000);

    const handleFocus = () => {
      refreshSilently();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session?.user?.id]);

  async function ensureProfile(user: User) {
    const client = supabase;

    if (!client) {
      return;
    }

    const profilePayload = {
      id: user.id,
      full_name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email ??
        "Friend",
      avatar_url: user.user_metadata?.avatar_url ?? null
    };

    const { error: upsertError } = await client
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }

    const { data: existingProfile, error: readError } = await client
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .single();

    if (readError) {
      throw readError;
    }

    if (!existingProfile.username) {
      const { error: usernameError } = await client
        .from("profiles")
        .update({ username: makeStarterUsername(user) })
        .eq("id", user.id)
        .is("username", null);

      if (usernameError) {
        throw usernameError;
      }
    }
  }

  async function loadDashboard(userId: string, options?: { silent?: boolean }) {
    const client = supabase;

    if (!client) {
      return;
    }

    const silent = options?.silent ?? false;

    if (!silent) {
      setRefreshing(true);
    }

    const [profileResult, friendshipsResult, debtsResult, settlementsResult] =
      await Promise.all([
        client
          .from("profiles")
          .select("id, username, full_name, avatar_url, created_at")
          .eq("id", userId)
          .single(),
        client
          .from("friendships")
          .select(
            "id, requester_id, addressee_id, status, created_at, responded_at"
          )
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        client
          .from("debt_requests")
          .select(
            "id, creator_id, approver_id, amount_in_paise, currency, reason, debt_date, due_at, status, approved_at, rejected_at, created_at"
          )
          .or(`creator_id.eq.${userId},approver_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        client
          .from("settlements")
          .select(
            "id, payer_id, receiver_id, amount_in_paise, currency, note, settled_at, created_at"
          )
          .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("settled_at", { ascending: false })
      ]);

    if (profileResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw profileResult.error;
    }

    if (friendshipsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw friendshipsResult.error;
    }

    if (debtsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw debtsResult.error;
    }

    if (settlementsResult.error) {
      if (!silent) {
        setRefreshing(false);
      }
      throw settlementsResult.error;
    }

    const friendships = (friendshipsResult.data ?? []) as Friendship[];
    const debtRequests = (debtsResult.data ?? []) as DebtRequest[];
    const settlements = (settlementsResult.data ?? []) as Settlement[];

    const relatedProfileIds = new Set<string>();

    friendships.forEach((friendship) => {
      relatedProfileIds.add(friendship.requester_id);
      relatedProfileIds.add(friendship.addressee_id);
    });

    debtRequests.forEach((request) => {
      relatedProfileIds.add(request.creator_id);
      relatedProfileIds.add(request.approver_id);
    });

    settlements.forEach((settlement) => {
      relatedProfileIds.add(settlement.payer_id);
      relatedProfileIds.add(settlement.receiver_id);
    });

    const ids = [...relatedProfileIds];
    let profiles: Profile[] = [];

    if (ids.length > 0) {
      const profilesResult = await client
        .from("profiles")
        .select("id, username, full_name, avatar_url, created_at")
        .in("id", ids);

      if (profilesResult.error) {
        if (!silent) {
          setRefreshing(false);
        }
        throw profilesResult.error;
      }

      profiles = (profilesResult.data ?? []) as Profile[];
    }

    setDashboard({
      profile: profileResult.data as Profile,
      friendships,
      profiles,
      debtRequests,
      settlements
    });
    if (!silent) {
      setRefreshing(false);
    }
  }

  async function refreshData() {
    if (!session?.user) {
      return;
    }

    try {
      await loadDashboard(session.user.id);
    } catch (cause: unknown) {
      setError(getErrorMessage(cause));
    }
  }

  const profilesById = useMemo(() => {
    return new Map(dashboard.profiles.map((profile) => [profile.id, profile]));
  }, [dashboard.profiles]);

  const acceptedFriends = useMemo<FriendSummary[]>(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships
      .filter((friendship) => friendship.status === "accepted")
      .map((friendship) => {
        const friendId =
          friendship.requester_id === session.user.id
            ? friendship.addressee_id
            : friendship.requester_id;

        return {
          friendshipId: friendship.id,
          profile: profilesById.get(friendId) ?? {
            id: friendId,
            username: null,
            full_name: "Unknown friend",
            avatar_url: null
          },
          balanceInPaise: 0
        };
      });
  }, [dashboard.friendships, profilesById, session?.user]);

  const balances = useMemo(() => {
    if (!session?.user) {
      return acceptedFriends;
    }

    const byFriend = new Map(
      acceptedFriends.map((friend) => [
        friend.profile.id,
        { ...friend, balanceInPaise: 0 }
      ])
    );

    dashboard.debtRequests
      .filter((request) => request.status === "approved")
      .forEach((request) => {
        const friendId =
          request.creator_id === session.user.id
            ? request.approver_id
            : request.creator_id;
        const item = byFriend.get(friendId);

        if (!item) {
          return;
        }

        item.balanceInPaise +=
          request.creator_id === session.user.id
            ? request.amount_in_paise
            : -request.amount_in_paise;
      });

    dashboard.settlements.forEach((settlement) => {
      const friendId =
        settlement.payer_id === session.user.id
          ? settlement.receiver_id
          : settlement.payer_id;
      const item = byFriend.get(friendId);

      if (!item) {
        return;
      }

      item.balanceInPaise +=
        settlement.payer_id === session.user.id
          ? settlement.amount_in_paise
          : -settlement.amount_in_paise;
    });

    return [...byFriend.values()].sort(
      (left, right) =>
        Math.abs(right.balanceInPaise) - Math.abs(left.balanceInPaise)
    );
  }, [acceptedFriends, dashboard.debtRequests, dashboard.settlements, session?.user]);

  useEffect(() => {
    if (balances.length === 0) {
      setSelectedFriendId("");
      return;
    }

    const stillExists = balances.some(
      (friend) => friend.profile.id === selectedFriendId
    );

    if (!stillExists) {
      setSelectedFriendId(balances[0].profile.id);
    }
  }, [balances, selectedFriendId]);

  const selectedFriend = useMemo(() => {
    return balances.find((friend) => friend.profile.id === selectedFriendId) ?? null;
  }, [balances, selectedFriendId]);

  const friendStatement = useMemo<StatementEntry[]>(() => {
    if (!session?.user || !selectedFriend) {
      return [];
    }

    const friendId = selectedFriend.profile.id;
    const statementFromDebts = dashboard.debtRequests
      .filter((request) => {
        const otherId =
          request.creator_id === session.user.id
            ? request.approver_id
            : request.creator_id;

        return otherId === friendId;
      })
      .map((request) => ({
        id: request.id,
        createdAt: request.created_at,
        kind: "debt" as const,
        title:
          request.creator_id === session.user.id
            ? `You logged a debt for ${readableProfile(selectedFriend.profile)}`
            : `${readableProfile(selectedFriend.profile)} logged a debt for you`,
        detail: request.reason,
        status: request.status,
        amountInPaise: request.amount_in_paise,
        balanceDeltaInPaise:
          request.status === "approved"
            ? request.creator_id === session.user.id
              ? request.amount_in_paise
              : -request.amount_in_paise
            : 0
      }));

    const statementFromSettlements = dashboard.settlements
      .filter((settlement) => {
        const otherId =
          settlement.payer_id === session.user.id
            ? settlement.receiver_id
            : settlement.payer_id;

        return otherId === friendId;
      })
      .map((settlement) => ({
        id: settlement.id,
        createdAt: settlement.settled_at,
        kind: "settlement" as const,
        title:
          settlement.payer_id === session.user.id
            ? `You paid ${readableProfile(selectedFriend.profile)}`
            : `${readableProfile(selectedFriend.profile)} paid you`,
        detail: settlement.note || "Settlement recorded",
        status: "settled",
        amountInPaise: settlement.amount_in_paise,
        balanceDeltaInPaise:
          settlement.payer_id === session.user.id
            ? settlement.amount_in_paise
            : -settlement.amount_in_paise
      }));

    return [...statementFromDebts, ...statementFromSettlements].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }, [
    dashboard.debtRequests,
    dashboard.settlements,
    selectedFriend,
    session?.user
  ]);

  const incomingInvites = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships.filter(
      (friendship) =>
        friendship.status === "pending" &&
        friendship.addressee_id === session.user.id
    );
  }, [dashboard.friendships, session?.user]);

  const outgoingInvites = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.friendships.filter(
      (friendship) =>
        friendship.status === "pending" &&
        friendship.requester_id === session.user.id
    );
  }, [dashboard.friendships, session?.user]);

  const pendingApprovals = useMemo(() => {
    if (!session?.user) {
      return [];
    }

    return dashboard.debtRequests.filter(
      (request) =>
        request.status === "pending" && request.approver_id === session.user.id
    );
  }, [dashboard.debtRequests, session?.user]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    if (!session?.user) {
      return [];
    }

    const debtItems = dashboard.debtRequests.map((request) => {
      const otherProfile = profilesById.get(
        request.creator_id === session.user.id
          ? request.approver_id
          : request.creator_id
      );
      const otherName = readableProfile(otherProfile);

      return {
        id: request.id,
        kind: "debt" as const,
        createdAt: request.created_at,
        profile: otherProfile ?? null,
        label:
          request.creator_id === session.user.id
            ? `${otherName} owes you`
            : `You owe ${otherName}`,
        detail: request.reason,
        status: request.status,
        amountInPaise: request.amount_in_paise
      };
    });

    const settlementItems = dashboard.settlements.map((settlement) => {
      const otherProfile = profilesById.get(
        settlement.payer_id === session.user.id
          ? settlement.receiver_id
          : settlement.payer_id
      );
      const otherName = readableProfile(otherProfile);

      return {
        id: settlement.id,
        kind: "settlement" as const,
        createdAt: settlement.settled_at,
        profile: otherProfile ?? null,
        label:
          settlement.payer_id === session.user.id
            ? `You paid ${otherName}`
            : `${otherName} paid you`,
        detail: settlement.note || "Settlement recorded",
        status: "settled",
        amountInPaise: settlement.amount_in_paise
      };
    });

    return [...debtItems, ...settlementItems]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 10);
  }, [dashboard.debtRequests, dashboard.settlements, profilesById, session?.user]);

  const totalOwedToYou = balances.reduce((sum, friend) => {
    return friend.balanceInPaise > 0 ? sum + friend.balanceInPaise : sum;
  }, 0);

  const totalYouOwe = balances.reduce((sum, friend) => {
    return friend.balanceInPaise < 0 ? sum + Math.abs(friend.balanceInPaise) : sum;
  }, 0);

  async function signInWithGoogle() {
    const client = supabase;

    if (!client) {
      return;
    }

    setError(null);
    const redirectTo = getAppOrigin();

    const { error: signInError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (signInError) {
      setError(signInError.message);
    }
  }

  async function signOut() {
    const client = supabase;

    if (!client) {
      return;
    }

    const { error: signOutError } = await client.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }
  }

  function resetMessages() {
    setError(null);
    setFeedback(null);
  }

  function setFailure(cause: unknown) {
    setFeedback(null);
    setError(getErrorMessage(cause));
  }

  async function saveUsername() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const sanitized = formatUsernameCandidate(usernameDraft);

    if (!sanitized || sanitized.length < 3) {
      setError("Pick a username with at least 3 letters or numbers.");
      return;
    }

    resetMessages();

    startSavingUsername(async () => {
      const { error: updateError } = await readyClient
        .from("profiles")
        .update({ username: sanitized })
        .eq("id", session.user.id);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback("Username updated.");
      setIsProfileDialogOpen(false);
      await refreshData();
    });
  }

  async function sendInvite() {
    const client = supabase;

    if (!client || !session?.user || !dashboard.profile) {
      return;
    }

    const readyClient = client;

    const username = formatUsernameCandidate(inviteUsername);

    if (!username) {
      setError("Enter your friend's username.");
      return;
    }

    if (username === dashboard.profile.username) {
      setError("You cannot invite yourself.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { data: targetProfile, error: targetError } = await readyClient
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("username", username)
        .single();

      if (targetError || !targetProfile) {
        setFailure("That username was not found.");
        return;
      }

      const { data: existing, error: existingError } = await readyClient
        .from("friendships")
        .select("id, status")
        .or(
          `and(requester_id.eq.${session.user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${session.user.id})`
        )
        .limit(1);

      if (existingError) {
        setFailure(existingError);
        return;
      }

      if ((existing ?? []).length > 0) {
        setFailure("A friend request or friendship already exists.");
        return;
      }

      const { error: insertError } = await readyClient.from("friendships").insert({
        requester_id: session.user.id,
        addressee_id: targetProfile.id,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setInviteUsername("");
      setFeedback(`Invite sent to @${targetProfile.username}.`);
      await refreshData();
    });
  }

  async function respondToInvite(friendshipId: string, accept: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const patch = accept
        ? { status: "accepted", responded_at: new Date().toISOString() }
        : { status: "blocked", responded_at: new Date().toISOString() };

      const { error: updateError } = await readyClient
        .from("friendships")
        .update(patch)
        .eq("id", friendshipId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(accept ? "Friend request accepted." : "Friend request declined.");
      await refreshData();
    });
  }

  async function createDebt() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const amount = Number(debtForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!debtForm.friendId) {
      setError("Choose a friend first.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    if (!debtForm.reason.trim()) {
      setError("Add a reason so both sides understand the debt.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await readyClient.from("debt_requests").insert({
        creator_id: session.user.id,
        approver_id: debtForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        reason: debtForm.reason.trim(),
        debt_date: debtForm.debtDate,
        due_at: debtForm.dueAt ? new Date(debtForm.dueAt).toISOString() : null,
        status: "pending"
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setDebtForm({
        friendId: debtForm.friendId,
        amount: "",
        reason: "",
        debtDate: new Date().toISOString().slice(0, 10),
        dueAt: ""
      });
      setFeedback("Debt request created and waiting for approval.");
      await refreshData();
    });
  }

  async function respondToDebt(requestId: string, approve: boolean) {
    const client = supabase;

    if (!client) {
      return;
    }

    const readyClient = client;

    resetMessages();

    startMutation(async () => {
      const { error: updateError } = await readyClient
        .from("debt_requests")
        .update(
          approve
            ? { status: "approved", approved_at: new Date().toISOString() }
            : { status: "rejected", rejected_at: new Date().toISOString() }
        )
        .eq("id", requestId);

      if (updateError) {
        setFailure(updateError);
        return;
      }

      setFeedback(approve ? "Debt approved." : "Debt rejected.");
      await refreshData();
    });
  }

  async function createSettlement() {
    const client = supabase;

    if (!client || !session?.user) {
      return;
    }

    const readyClient = client;

    const amount = Number(settlementForm.amount);
    const amountInPaise = Math.round(amount * 100);

    if (!settlementForm.friendId) {
      setError("Choose who received the payment.");
      return;
    }

    if (!amount || amountInPaise <= 0) {
      setError("Enter a valid settlement amount.");
      return;
    }

    resetMessages();

    startMutation(async () => {
      const { error: insertError } = await readyClient.from("settlements").insert({
        payer_id: session.user.id,
        receiver_id: settlementForm.friendId,
        amount_in_paise: amountInPaise,
        currency: "INR",
        note: settlementForm.note.trim() || null
      });

      if (insertError) {
        setFailure(insertError);
        return;
      }

      setSettlementForm({
        friendId: settlementForm.friendId,
        amount: "",
        note: ""
      });
      setFeedback("Settlement recorded.");
      await refreshData();
    });
  }

  const profileNeedsSetup =
    !dashboard.profile?.username || dashboard.profile.username.length < 3;

  useEffect(() => {
    if (!booting && session?.user && dashboard.profile && profileNeedsSetup) {
      setUsernameDraft(dashboard.profile?.username ?? "");
      setIsProfileDialogOpen(true);
    }
  }, [booting, dashboard.profile, profileNeedsSetup, session?.user]);

  useEffect(() => {
    if (!isProfileDialogOpen) {
      setUsernameDraft(dashboard.profile?.username ?? "");
    }
  }, [dashboard.profile?.username, isProfileDialogOpen]);

  if (!envReady) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Setup required</p>
          <h1>Connect Supabase to launch F&B</h1>
          <p className="lede">
            Add your Supabase URL and anon key in <code>.env.local</code>, then
            enable Google auth in the Supabase dashboard.
          </p>
          <div className="panel inline-panel">
            <p>Required variables:</p>
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </div>
        </section>
      </main>
    );
  }

  if (booting) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">F&B</p>
          <h1>Loading your balances</h1>
          <p className="lede">
            Pulling your session, profile, friends, debts, and settlements.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">F&B</p>
          <h1>Shared debt tracking for real friendships</h1>
          <p className="lede">
            Log who paid, who owes, and when it gets cleared. Every debt stays
            pending until the other person approves it, so the balance always
            feels fair.
          </p>

          <div className="hero-card">
            <div>
              <span className="label">Auth</span>
              <strong>Google only</strong>
            </div>
            <div>
              <span className="label">Trust model</span>
              <strong>Two-sided approvals</strong>
            </div>
            <div>
              <span className="label">Launch surface</span>
              <strong>Phone + desktop web</strong>
            </div>
          </div>

          <div className="action-row">
            <button className="primary-button" onClick={signInWithGoogle}>
              Continue with Google
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell app-shell">
      <section className="topbar">
        <div className="topbar-main">
          <div className="identity-lockup">
            <img className="brand-logo" src="/fnb-logo.svg" alt="F&B logo" />
            <div className="brand-copy">
              <p className="eyebrow">F&B</p>
              <h1 className="app-title">Friends and Benefits</h1>
            </div>
          </div>
        </div>

        <aside className="topbar-rail">
          <div className="topbar-actions">
            <button
              aria-busy={refreshing}
              aria-label={refreshing ? "Refreshing data" : "Refresh data"}
              className={`ghost-button topbar-icon-button refresh-button ${
                refreshing ? "button-is-loading" : ""
              }`}
              onClick={refreshData}
              disabled={refreshing}
              title="Refresh"
              type="button"
            >
              <RefreshIcon />
            </button>
            <button
              className="ghost-button danger-ghost-button topbar-compact-button topbar-signout-button"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </aside>
      </section>

      {(error || feedback) && (
        <section className={`banner ${error ? "error-banner" : "success-banner"}`}>
          <p>{error ?? feedback}</p>
        </section>
      )}

      <section className="profile-strip">
        <div className="profile-strip-identity">
          <Avatar profile={dashboard.profile} size="medium" />
          <div className="profile-strip-copy">
            <span className="profile-label">Your profile</span>
            <strong>{dashboard.profile?.full_name ?? session.user.email}</strong>
            <p>@{dashboard.profile?.username ?? "not-set"}</p>
          </div>
        </div>

        <button
          className="primary-button profile-strip-button"
          onClick={openProfileDialog}
          type="button"
        >
          Edit profile
        </button>
      </section>

      {isProfileDialogOpen && (
        <div
          className="dialog-backdrop"
          onClick={() => setIsProfileDialogOpen(false)}
          role="presentation"
        >
          <section
            className="dialog-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2>{profileNeedsSetup ? "Finish your profile" : "Your profile"}</h2>
                <p className="muted">
                  {profileNeedsSetup
                    ? "We generated a starter username, but you should pick one your friends can type easily."
                    : "This username is what your friends use to find you. You can change it anytime."}
                </p>
              </div>
              <button
                aria-label="Close profile dialog"
                className="ghost-button dialog-close-button"
                onClick={() => setIsProfileDialogOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="dialog-profile">
              <Avatar profile={dashboard.profile} size="large" />
              <div>
                <strong>{readableProfile(dashboard.profile)}</strong>
                <p className="muted">@{dashboard.profile?.username ?? "not-set"}</p>
              </div>
            </div>

            <div className="form-grid compact-grid">
              <label>
                <span>Username</span>
                <input
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  placeholder="for example: kiran_07"
                />
              </label>
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                onClick={saveUsername}
                disabled={savingUsername}
              >
                {savingUsername ? "Saving..." : "Save username"}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="stat-grid">
        <article className="stat-card">
          <span>Total friends</span>
          <strong>{balances.length}</strong>
        </article>
        <article className="stat-card success">
          <span>They owe you</span>
          <strong>{formatCurrency(totalOwedToYou)}</strong>
        </article>
        <article className="stat-card warning">
          <span>You owe</span>
          <strong>{formatCurrency(totalYouOwe)}</strong>
        </article>
        <article className="stat-card">
          <span>Pending approvals</span>
          <strong>{pendingApprovals.length}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <h2>Friends</h2>
              <p className="muted">
                Invite friends by their F&B username. Yours is @
                {dashboard.profile?.username ?? "not-set"}.
              </p>
            </div>
          </div>

          <div className="form-grid compact-grid">
            <label>
              <span>Invite by username</span>
              <input
                value={inviteUsername}
                onChange={(event) => setInviteUsername(event.target.value)}
                placeholder="friend_username"
              />
            </label>
          </div>

          <div className="action-row">
            <button className="primary-button" onClick={sendInvite} disabled={mutating}>
              Send invite
            </button>
          </div>

          <div className="stack">
            <div>
              <h3>Your friends</h3>
              {balances.length === 0 ? (
                <p className="empty-state">No accepted friends yet.</p>
              ) : (
                <div className="stack mini-stack">
                  {balances.map((friend) => (
                    <button
                      className={`friend-card ${
                        selectedFriendId === friend.profile.id ? "friend-card-active" : ""
                      }`}
                      key={friend.friendshipId}
                      onClick={() => openStatementDialog(friend.profile.id)}
                    >
                      <PersonIdentity profile={friend.profile} />
                      <div className="friend-card-side">
                        <span
                          className={`amount-badge ${
                            friend.balanceInPaise > 0
                              ? "positive"
                              : friend.balanceInPaise < 0
                                ? "negative"
                                : ""
                          }`}
                        >
                          {formatCurrency(friend.balanceInPaise)}
                        </span>
                        <small>View statement</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3>Incoming invites</h3>
              {incomingInvites.length === 0 ? (
                <p className="empty-state">No incoming invites right now.</p>
              ) : (
                incomingInvites.map((invite) => {
                  const friend = profilesById.get(invite.requester_id);

                  return (
                    <div className="list-card" key={invite.id}>
                      <PersonIdentity profile={friend} />
                      <div className="row-actions">
                        <button
                          className="primary-button"
                          onClick={() => respondToInvite(invite.id, true)}
                          disabled={mutating}
                        >
                          Accept
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => respondToInvite(invite.id, false)}
                          disabled={mutating}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div>
              <h3>Outgoing invites</h3>
              {outgoingInvites.length === 0 ? (
                <p className="empty-state">No pending invites sent.</p>
              ) : (
                outgoingInvites.map((invite) => {
                  const friend = profilesById.get(invite.addressee_id);

                  return (
                    <div className="list-card" key={invite.id}>
                      <PersonIdentity profile={friend} />
                      <span className="pill">Waiting</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="section-head">
            <div>
              <h2>Create debt</h2>
              <p className="muted">
                Add the amount, reason, and optional return time. Your friend must
                approve it.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              <span>Friend</span>
              <FriendPicker
                friends={balances}
                selectedId={debtForm.friendId}
                onSelect={(friendId) =>
                  setDebtForm((current) => ({
                    ...current,
                    friendId
                  }))
                }
                placeholder="Choose a friend"
              />
            </label>

            <label>
              <span>Amount in INR</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={debtForm.amount}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
                placeholder="200"
              />
            </label>

            <label>
              <span>Date</span>
              <input
                type="date"
                value={debtForm.debtDate}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    debtDate: event.target.value
                  }))
                }
              />
            </label>

            <label>
              <span>Return by</span>
              <input
                type="datetime-local"
                value={debtForm.dueAt}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    dueAt: event.target.value
                  }))
                }
              />
            </label>

            <label className="full-span">
              <span>Reason</span>
              <textarea
                rows={3}
                value={debtForm.reason}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    reason: event.target.value
                  }))
                }
                placeholder="Auto fare, dinner, movie tickets, cash loan..."
              />
            </label>
          </div>

          <div className="action-row">
            <button className="primary-button" onClick={createDebt} disabled={mutating}>
              Create debt request
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="section-head">
            <div>
              <h2>Pending approvals</h2>
              <p className="muted">These requests need your decision.</p>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <p className="empty-state">No debt approvals waiting for you.</p>
          ) : (
            <div className="stack">
              {pendingApprovals.map((request) => {
                const creator = profilesById.get(request.creator_id);

                return (
                  <div className="list-card dense" key={request.id}>
                    <div>
                      <PersonIdentity profile={creator} />
                      <p>
                        {formatCurrency(request.amount_in_paise)} for {request.reason}
                      </p>
                      <small>
                        Debt date {dateOnly.format(new Date(request.debt_date))} - Due{" "}
                        {formatDate(request.due_at)}
                      </small>
                    </div>
                    <div className="row-actions">
                      <button
                        className="primary-button"
                        onClick={() => respondToDebt(request.id, true)}
                        disabled={mutating}
                      >
                        Approve
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => respondToDebt(request.id, false)}
                        disabled={mutating}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="section-head">
            <div>
              <h2>Record settlement</h2>
              <p className="muted">
                Use this when you pay someone back directly outside the app.
              </p>
            </div>
          </div>

          <div className="form-grid compact-grid">
            <label>
              <span>Paid to</span>
              <FriendPicker
                friends={balances}
                selectedId={settlementForm.friendId}
                onSelect={(friendId) =>
                  setSettlementForm((current) => ({
                    ...current,
                    friendId
                  }))
                }
                placeholder="Choose a friend"
              />
            </label>

            <label>
              <span>Amount in INR</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={settlementForm.amount}
                onChange={(event) =>
                  setSettlementForm((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
                placeholder="200"
              />
            </label>

            <label className="full-span">
              <span>Note</span>
              <input
                value={settlementForm.note}
                onChange={(event) =>
                  setSettlementForm((current) => ({
                    ...current,
                    note: event.target.value
                  }))
                }
                placeholder="UPI transfer, cash returned, bank transfer..."
              />
            </label>
          </div>

          <div className="action-row">
            <button
              className="primary-button"
              onClick={createSettlement}
              disabled={mutating}
            >
              Record settlement
            </button>
          </div>
        </article>
      </section>

      {isStatementDialogOpen && selectedFriend && (
        <div
          className="dialog-backdrop"
          onClick={() => setIsStatementDialogOpen(false)}
          role="presentation"
        >
          <section
            className="dialog-card statement-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2>Statement</h2>
                <p className="muted">
                  Full record with {readableProfile(selectedFriend.profile)}.
                </p>
              </div>
              <button
                aria-label="Close statement dialog"
                className="ghost-button dialog-close-button"
                onClick={() => setIsStatementDialogOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="statement-shell">
              <div className="statement-header">
                <PersonIdentity profile={selectedFriend.profile} />
                <span
                  className={`amount-badge ${
                    selectedFriend.balanceInPaise > 0
                      ? "positive"
                      : selectedFriend.balanceInPaise < 0
                        ? "negative"
                        : ""
                  }`}
                >
                  {formatCurrency(selectedFriend.balanceInPaise)}
                </span>
              </div>

              {friendStatement.length === 0 ? (
                <p className="empty-state">No records yet with this friend.</p>
              ) : (
                <div className="statement-table-wrap">
                  <table className="statement-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Entry</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {friendStatement.map((entry) => (
                        <tr key={`${entry.kind}-${entry.id}`}>
                          <td>{dateTime.format(new Date(entry.createdAt))}</td>
                          <td>
                            <strong>{entry.title}</strong>
                            <p>{entry.detail}</p>
                          </td>
                          <td>
                            <span className={`pill status-${entry.status}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td>
                            <div className="statement-amounts">
                              <strong>{formatCurrency(entry.amountInPaise)}</strong>
                              <small>
                                Balance impact {formatCurrency(entry.balanceDeltaInPaise)}
                              </small>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Recent activity</h2>
            <p className="muted">Latest debts and settlements across your network.</p>
          </div>
        </div>

        {recentActivity.length === 0 ? (
          <p className="empty-state">No activity yet.</p>
        ) : (
          <div className="stack">
            {recentActivity.map((item) => (
              <div className="list-card dense" key={`${item.kind}-${item.id}`}>
                <div className="person-block">
                  <PersonIdentity profile={item.profile} />
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                  <small>{dateTime.format(new Date(item.createdAt))}</small>
                </div>
                <div className="activity-side">
                  <span className="amount-badge neutral">
                    {formatCurrency(item.amountInPaise)}
                  </span>
                  <span className={`pill status-${item.status}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Avatar({
  profile,
  size = "medium"
}: {
  profile?: Profile | null;
  size?: "small" | "medium" | "large";
}) {
  return (
    <div className={`avatar avatar-${size}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={readableProfile(profile)} />
      ) : (
        <span>{initialsFor(profile)}</span>
      )}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="button-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M16.667 10a6.667 6.667 0 1 1-1.953-4.714"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M13.333 3.333h3.334v3.334"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PersonIdentity({ profile }: { profile?: Profile | null }) {
  return (
    <div className="person-identity">
      <Avatar profile={profile} />
      <div className="person-copy">
        <strong>{readableProfile(profile)}</strong>
        <p>@{profile?.username ?? "unknown"}</p>
      </div>
    </div>
  );
}

function FriendPicker({
  friends,
  selectedId,
  onSelect,
  placeholder
}: {
  friends: FriendSummary[];
  selectedId: string;
  onSelect: (friendId: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selectedFriend =
    friends.find((friend) => friend.profile.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="picker-shell" ref={wrapperRef}>
      <button
        className={`picker-trigger ${open ? "picker-trigger-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selectedFriend ? (
          <div className="picker-value">
            <PersonIdentity profile={selectedFriend.profile} />
            <span className="picker-caret">{open ? "Hide" : "Select"}</span>
          </div>
        ) : (
          <div className="picker-value">
            <span className="picker-placeholder">{placeholder}</span>
            <span className="picker-caret">Select</span>
          </div>
        )}
      </button>

      {open && (
        <div className="picker-menu">
          {friends.length === 0 ? (
            <p className="empty-state">No friends available yet.</p>
          ) : (
            friends.map((friend) => (
              <button
                className="picker-option"
                key={friend.friendshipId}
                onClick={() => {
                  onSelect(friend.profile.id);
                  setOpen(false);
                }}
                type="button"
              >
                <PersonIdentity profile={friend.profile} />
                <small>{friend.profile.username ? `@${friend.profile.username}` : ""}</small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
