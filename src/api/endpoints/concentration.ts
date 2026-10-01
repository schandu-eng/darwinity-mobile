import apiClient from '../client';

export type FocusSegment = {
  from: string;
  to: string;
  screen: string;
};

export type FocusEventPayload = {
  client_event_id: string;
  event_type: 'card_deck_review' | 'quiz_correct' | 'pomodoro_complete';
  occurred_at?: string;
  payload?: Record<string, unknown>;
};

export type CheckpointGrant = {
  checkpoint_code: string;
  amount: number;
  currency: string;
  balance: number;
  lot_id: number;
  inbox_id: number;
  expires_at: string;
};

export type FinalizeFocusResponse = {
  session: {
    id: string;
    status: string;
    active_seconds: number;
    period_key: string;
  };
  replayed: boolean;
  loyalty: LoyaltyMe;
  checkpoints_reached: CheckpointGrant[];
  wallet: WalletBalance;
};

export type LoyaltyMe = {
  period_key: string;
  period_start: string;
  period_end: string;
  L: number;
  H_time: number;
  H_fc: number;
  H_quiz: number;
  pomodoros_completed?: number;
  pomodoros_lifetime?: number;
  pomo_bonus_L?: number;
  fc_reviews?: number;
  quiz_correct?: number;
  dwell_seconds?: number;
  dwell_hours?: number;
  amount_for_cap: number;
  currency: string;
  can_earn: boolean;
  is_paid: boolean;
  checkpoints_claimed: string[];
  next_checkpoint: {
    code: string;
    min_L: number;
    percent: number;
    remaining_L: number;
  } | null;
  weights: {
    time: number;
    flashcards: number;
    quiz: number;
    pomodoro_bonus?: number;
  };
};

export type WalletBalance = {
  balance: number;
  currency: string;
  pending_wallet_credit_amount?: number;
  wallet_auto_apply?: boolean;
  lots: Array<{
    id: number;
    amount_remaining: number;
    amount_initial: number;
    currency: string;
    checkpoint_code: string;
    earned_at: string | null;
    expires_at: string | null;
  }>;
};

export type WalletInboxItem = {
  id: number;
  title: string;
  body: string | null;
  amount: number;
  currency: string;
  checkpoint_code: string | null;
  seen_at: string | null;
  created_at: string | null;
};

export type LoyaltyHistory = {
  periods: Array<{
    period_key: string;
    period_start: string;
    period_end: string;
    L: number;
    H_time: number;
    H_fc: number;
    H_quiz: number;
    amount_for_cap: number;
    currency: string;
    checkpoints_claimed: string[];
  }>;
  daily: Array<{
    date: string;
    active_seconds: number;
    dwell_seconds?: number;
    fc_reviews: number;
    quiz_correct: number;
    L_delta: number;
    pages?: Array<{
      content_id: string;
      page_type: string;
      content_title?: string | null;
      dwell_seconds: number;
    }>;
  }>;
};

export const focusEndpoints = {
  startSession: async (userId: number, sessionId: string) => {
    const { data } = await apiClient.post('/api/v1/concentration/sessions', {
      user_id: userId,
      session_id: sessionId,
    });
    return data;
  },

  finalizeSession: async (
    sessionId: string,
    body: {
      user_id: number;
      active_seconds: number;
      segments?: FocusSegment[];
      events?: FocusEventPayload[];
      started_at?: string;
      ended_at?: string;
    }
  ): Promise<FinalizeFocusResponse> => {
    const { data } = await apiClient.post<FinalizeFocusResponse>(
      `/api/v1/concentration/sessions/${sessionId}/finalize`,
      body
    );
    return data;
  },

  getLoyaltyMe: async (userId: number): Promise<LoyaltyMe> => {
    const { data } = await apiClient.get<LoyaltyMe>('/api/v1/concentration/loyalty/me', {
      params: { user_id: userId },
    });
    return data;
  },

  getLoyaltyHistory: async (userId: number): Promise<LoyaltyHistory> => {
    const { data } = await apiClient.get<LoyaltyHistory>('/api/v1/concentration/loyalty/history', {
      params: { user_id: userId },
    });
    return data;
  },

  ingestDwell: async (
    userId: number,
    events: Array<{
      client_event_id: string;
      content_id: string;
      page_type: string;
      content_title?: string;
      st: number;
      et: number;
      dt: number;
      pt?: string;
    }>
  ) => {
    const { data } = await apiClient.post('/api/v1/concentration/dwell', {
      user_id: userId,
      events,
    });
    return data as { accepted: number; skipped: number; added_ms: number };
  },

  getWallet: async (userId: number): Promise<WalletBalance> => {
    const { data } = await apiClient.get<WalletBalance>('/api/v1/concentration/wallet', {
      params: { user_id: userId },
    });
    return data;
  },

  getInbox: async (userId: number, includeSeen = true): Promise<{ items: WalletInboxItem[] }> => {
    const { data } = await apiClient.get<{ items: WalletInboxItem[] }>('/api/v1/concentration/wallet/inbox', {
      params: { user_id: userId, include_seen: includeSeen },
    });
    return data;
  },

  ackInbox: async (userId: number, inboxId: number) => {
    const { data } = await apiClient.post(`/api/v1/concentration/wallet/inbox/${inboxId}/ack`, {
      user_id: userId,
    });
    return data;
  },

  spend: async (userId: number, sinkId: string, idempotencyKey: string) => {
    const { data } = await apiClient.post('/api/v1/concentration/wallet/spend', {
      user_id: userId,
      sink_id: sinkId,
      idempotency_key: idempotencyKey,
    });
    return data;
  },

  getSinks: async () => {
    const { data } = await apiClient.get('/api/v1/concentration/wallet/sinks');
    return data as {
      sinks: Array<{ id: string; label: string; cost: number; uploads?: number; description: string }>;
    };
  },
};
