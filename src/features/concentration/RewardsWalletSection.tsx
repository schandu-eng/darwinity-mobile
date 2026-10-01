import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { Fonts } from '@/config/fonts';

import {
  focusEndpoints,
  type WalletBalance,
  type WalletInboxItem,
} from '@/api/endpoints/concentration';

/** Rewards wallet is web / Android only — App Store IAP must not show plan-credit or upload redeem. */
export const LoyaltyWalletSection: React.FC = () => {
  if (Platform.OS === 'ios') return null;
  return <LoyaltyWalletSectionBody />;
};

const LoyaltyWalletSectionBody: React.FC = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [inbox, setInbox] = useState<WalletInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [spending, setSpending] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [w, i] = await Promise.all([
        focusEndpoints.getWallet(userId),
        focusEndpoints.getInbox(userId, true),
      ]);
      setWallet(w);
      setInbox(i.items);
    } catch (e) {
      console.warn('Could not load rewards wallet:', e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const spend = useCallback(
    async (sinkId: 'upload_pack' | 'plan_credit') => {
      if (!userId || spending) return;
      setSpending(true);
      try {
        const result = await focusEndpoints.spend(
          userId,
          sinkId,
          `${sinkId}-${userId}-${Date.now()}`
        );
        if (sinkId === 'plan_credit') {
          Alert.alert(
            'Plan credit',
            result?.message ||
              `${Number(result?.pending_wallet_credit_amount || 0).toFixed(2)} reserved for your next bill.`
          );
        } else {
          Alert.alert('Spent', 'Upload pack applied to your quota.');
        }
        await load();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Spend failed';
        Alert.alert('Could not spend', msg);
      } finally {
        setSpending(false);
      }
    },
    [userId, spending, load]
  );

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const pending = Number(wallet?.pending_wallet_credit_amount || 0);
  const currency = wallet?.currency || 'INR';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Rewards wallet
      </Text>
      <Text style={[styles.sectionSub, { color: theme.colors.onSurfaceVariant }]}>
        Earn from Focus checkpoints. Redeem for uploads or apply plan credit toward
        your next web subscription charge.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Balance</Text>
        <Text style={[styles.balance, { color: theme.colors.onSurface }]}>
          {wallet ? `${wallet.balance.toFixed(2)} ${currency}` : '-'}
        </Text>
        {pending > 0 ? (
          <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 13 }}>
            {pending.toFixed(2)} {currency} reserved for next bill
          </Text>
        ) : null}
        <TouchableOpacity
          style={[styles.spendBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => void spend('upload_pack')}
          disabled={spending}
        >
          <Text style={[styles.spendText, { color: theme.colors.onPrimary }]}>
            {spending ? 'Working…' : 'Redeem for uploads'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.spendBtn,
            {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: theme.colors.primary,
            },
          ]}
          onPress={() => void spend('plan_credit')}
          disabled={spending}
        >
          <Text style={[styles.spendText, { color: theme.colors.primary }]}>
            Apply to next bill
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.inboxTitle, { color: theme.colors.onSurface }]}>Inbox</Text>
      {inbox.length === 0 ? (
        <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 14 }}>
          No rewards yet. Complete Focus checkpoints to earn.
        </Text>
      ) : (
        inbox.map((item) => (
          <View
            key={String(item.id)}
            style={[styles.row, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{item.title}</Text>
            <Text style={{ color: theme.colors.primary, fontFamily: Fonts.ui.medium }}>
              +{item.amount.toFixed(2)} {item.currency}
            </Text>
            {item.created_at ? (
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 24, gap: 8 },
  sectionTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 18 },
  sectionSub: { fontFamily: Fonts.ui.regular, fontSize: 13, marginBottom: 4 },
  card: { borderRadius: 14, padding: 16, gap: 8 },
  label: { fontFamily: Fonts.ui.regular, fontSize: 13 },
  balance: { fontFamily: Fonts.ui.bold, fontSize: 28 },
  spendBtn: { marginTop: 8, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  spendText: { fontFamily: Fonts.ui.semiBold, fontSize: 14 },
  inboxTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 16, marginTop: 8 },
  row: { borderRadius: 12, padding: 12, gap: 4, marginTop: 4 },
  rowTitle: { fontFamily: Fonts.ui.medium, fontSize: 15 },
});

export default LoyaltyWalletSection;
