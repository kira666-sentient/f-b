"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  label: string;
  detail: string;
  status: string;
  amountInPaise: number;
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
    } = readyClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError(null);
      setFeedback(null);

      startMutation(async () => {
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

        try {
          await ensureProfile(nextSession.user);
          await loadDashboard(nextSession.user.id);
        } catch (cause: unknown) {
          setError(getErrorMessage(cause));
        }
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

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

  async function loadDashboard(userId: string) {
    const client = supabase;

    if (!client) {
      return;
    }

    setRefreshing(true);

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
      setRefreshing(false);
      throw profileResult.error;
    }

    if (friendshipsResult.error) {
      setRefreshing(false);
      throw friendshipsResult.error;
    }

    if (debtsResult.error) {
      setRefreshing(false);
      throw debtsResult.error;
    }

    if (settlementsResult.error) {
      setRefreshing(false);
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
        setRefreshing(false);
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
    setUsernameDraft((profileResult.data?.username as string | null) ?? "");
    setRefreshing(false);
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
    Boolean(session?.user) &&
    (!dashboard.profile?.username || dashboard.profile.username.length < 3);

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
        <div>
          <p className="eyebrow">F&B</p>
          <h1 className="app-title">Friends and Benefits</h1>
          <p className="top-copy">
            Welcome back, {dashboard.profile?.full_name ?? session.user.email}.
          </p>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button" onClick={refreshData} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="ghost-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>

      {(error || feedback) && (
        <section className={`banner ${error ? "error-banner" : "success-banner"}`}>
          <p>{error ?? feedback}</p>
        </section>
      )}

      {profileNeedsSetup && (
        <section className="panel">
          <h2>Finish your profile</h2>
          <p className="muted">
            Your friends will find you by username. Keep it short and easy to type.
          </p>
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
              <p className="muted">Invite friends by their F&B username.</p>
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
              <h3>Incoming invites</h3>
              {incomingInvites.length === 0 ? (
                <p className="empty-state">No incoming invites right now.</p>
              ) : (
                incomingInvites.map((invite) => {
                  const friend = profilesById.get(invite.requester_id);

                  return (
                    <div className="list-card" key={invite.id}>
                      <div>
                        <strong>{readableProfile(friend)}</strong>
                        <p>@{friend?.username ?? "unknown"}</p>
                      </div>
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
                      <div>
                        <strong>{readableProfile(friend)}</strong>
                        <p>@{friend?.username ?? "unknown"}</p>
                      </div>
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
              <select
                value={debtForm.friendId}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    friendId: event.target.value
                  }))
                }
              >
                <option value="">Choose a friend</option>
                {balances.map((friend) => (
                  <option key={friend.profile.id} value={friend.profile.id}>
                    {readableProfile(friend.profile)}
                  </option>
                ))}
              </select>
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
                      <strong>{readableProfile(creator)}</strong>
                      <p>
                        {formatCurrency(request.amount_in_paise)} for {request.reason}
                      </p>
                      <small>
                        Debt date {dateOnly.format(new Date(request.debt_date))} · Due{" "}
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
              <select
                value={settlementForm.friendId}
                onChange={(event) =>
                  setSettlementForm((current) => ({
                    ...current,
                    friendId: event.target.value
                  }))
                }
              >
                <option value="">Choose a friend</option>
                {balances.map((friend) => (
                  <option key={friend.profile.id} value={friend.profile.id}>
                    {readableProfile(friend.profile)}
                  </option>
                ))}
              </select>
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

      <section className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <h2>Balances</h2>
              <p className="muted">Positive means they owe you. Negative means you owe them.</p>
            </div>
          </div>

          {balances.length === 0 ? (
            <p className="empty-state">
              Accept a friend invite or send one to start tracking balances.
            </p>
          ) : (
            <div className="stack">
              {balances.map((friend) => (
                <div className="list-card" key={friend.friendshipId}>
                  <div>
                    <strong>{readableProfile(friend.profile)}</strong>
                    <p>@{friend.profile.username ?? "unknown"}</p>
                  </div>
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
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
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
                  <div>
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
        </article>
      </section>
    </main>
  );
}
