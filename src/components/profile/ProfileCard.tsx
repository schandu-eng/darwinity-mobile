import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { InkPanelGradient } from '@/components/brand/InkPanelGradient';
import { boxShadow } from '@/theme/webCompat';
import { REFERRAL_FLOW_ENABLED } from '@/utils/referral';

const CREAM = '#FAF9F6';
const CREAM_MUTED = 'rgba(250, 249, 246, 0.72)';
const LINE = 'rgba(250, 249, 246, 0.14)';
const CARD_SHADOW = boxShadow('0 18px 40px rgba(18, 32, 24, 0.28)', {
  shadowColor: BRAND_COLORS.inkDeep,
  shadowOpacity: 0.28,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
});

export type ProfileCardReferral = {
  code: string;
  percentOff?: number;
  inviteEmail: string;
  onChangeInviteEmail: (value: string) => void;
  onSendInvite: () => void;
  onCopyCode: () => void;
  onShareInvite: () => void;
  isSending: boolean;
  codeCopied: boolean;
  statusMessage?: string | null;
  statusTone?: 'success' | 'error';
};

type ProfileCardProps = {
  initial: string;
  name: string;
  contact: string;
  subscriptionBadgeLabel: string;
  isLoadingBillingPlan: boolean;
  languageLabel: string;
  showCompletionCue?: boolean;
  completionPercent?: number;
  referral?: ProfileCardReferral | null;
  onPress: () => void;
  onChangeLanguage: () => void;
};

const ProfileCard: React.FC<ProfileCardProps> = ({
  initial,
  name,
  contact,
  subscriptionBadgeLabel,
  isLoadingBillingPlan,
  languageLabel,
  showCompletionCue,
  completionPercent,
  referral,
  onPress,
  onChangeLanguage,
}) => {
  const percentOff = referral?.percentOff ?? 10;

  return (
    <InkPanelGradient
      style={[styles.card, CARD_SHADOW]}
      contentStyle={styles.cardContent}
    >
      <TouchableOpacity
        onPress={onPress}
        style={styles.identity}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open account details"
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {isLoadingBillingPlan ? (
              <ActivityIndicator size="small" color={CREAM} />
            ) : (
              <View style={styles.planPill}>
                <Text style={styles.planPillText}>{subscriptionBadgeLabel}</Text>
              </View>
            )}
          </View>
          {contact ? (
            <Text style={styles.contact} numberOfLines={1}>
              {contact}
            </Text>
          ) : null}
          {showCompletionCue ? (
            <Text style={styles.completionHint}>
              Complete your profile · {completionPercent}%
            </Text>
          ) : (
            <Text style={styles.accountHint}>Account details</Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={CREAM_MUTED} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onChangeLanguage}
        style={styles.actionRow}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Language, ${languageLabel}`}
      >
        <MaterialCommunityIcons name="translate" size={20} color={CREAM} />
        <Text style={[styles.actionLabel, styles.actionLabelGrow]}>Language</Text>
        <Text style={styles.actionValue}>{languageLabel}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={CREAM_MUTED} />
      </TouchableOpacity>

      {/* Referral codes temporarily disabled — own-code share / invite UI. */}
      {REFERRAL_FLOW_ENABLED && referral?.code ? (
        <>
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="gift-outline" size={20} color={CREAM} />
            <View style={styles.referralCopy}>
              <Text style={styles.actionLabel}>Referral code</Text>
              <Text style={styles.referralHint} numberOfLines={1}>
                Friends get {percentOff}% off · you earn wallet credit
              </Text>
            </View>
            <TouchableOpacity
              onPress={referral.onCopyCode}
              style={styles.codeChip}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Copy referral code ${referral.code}`}
            >
              <Text style={styles.codeChipText}>{referral.code}</Text>
              <MaterialCommunityIcons
                name={referral.codeCopied ? 'check' : 'content-copy'}
                size={14}
                color={CREAM}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={referral.onShareInvite}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Share invite"
            >
              <MaterialCommunityIcons name="share-variant-outline" size={18} color={CREAM_MUTED} />
            </TouchableOpacity>
          </View>

          <View style={styles.inviteRow}>
            <MaterialCommunityIcons name="email-outline" size={20} color={CREAM} />
            <TextInput
              style={styles.inviteInput}
              value={referral.inviteEmail}
              onChangeText={referral.onChangeInviteEmail}
              placeholder="Friend email"
              placeholderTextColor={CREAM_MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              editable={!referral.isSending}
              onSubmitEditing={() => {
                Keyboard.dismiss();
                referral.onSendInvite();
              }}
              accessibilityLabel="Friend email"
            />
            <TouchableOpacity
              onPress={referral.onSendInvite}
              style={[
                styles.inviteSend,
                referral.isSending ? styles.inviteSendDisabled : null,
              ]}
              activeOpacity={0.8}
              disabled={referral.isSending}
              accessibilityRole="button"
              accessibilityLabel="Send invite"
            >
              {referral.isSending ? (
                <ActivityIndicator size="small" color={BRAND_COLORS.ink} />
              ) : (
                <Text style={styles.inviteSendText}>Invite</Text>
              )}
            </TouchableOpacity>
          </View>
          {referral.statusMessage ? (
            <Text
              style={[
                styles.inviteStatus,
                referral.statusTone === 'error' ? styles.inviteStatusError : null,
              ]}
            >
              {referral.statusMessage}
            </Text>
          ) : null}
        </>
      ) : null}
    </InkPanelGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    marginBottom: 20,
  },
  cardContent: {
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  planPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(250, 249, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(250, 249, 246, 0.22)',
    flexShrink: 0,
  },
  planPillText: {
    fontSize: 11,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
    color: CREAM,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: CREAM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.3,
    color: BRAND_COLORS.ink,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.display.bold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: CREAM,
  },
  contact: {
    fontSize: 14,
    fontFamily: Fonts.body.regular,
    color: CREAM_MUTED,
  },
  accountHint: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
    color: 'rgba(250, 249, 246, 0.55)',
  },
  completionHint: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
    color: CREAM,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  actionLabel: {
    fontSize: 15,
    fontFamily: Fonts.ui.regular,
    color: CREAM,
  },
  actionLabelGrow: {
    flex: 1,
  },
  actionValue: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
    color: CREAM_MUTED,
  },
  referralCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  referralHint: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    color: CREAM_MUTED,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(250, 249, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 249, 246, 0.2)',
    flexShrink: 0,
  },
  codeChipText: {
    fontSize: 13,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.8,
    color: CREAM,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 12,
  },
  inviteInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(250, 249, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 249, 246, 0.18)',
    color: CREAM,
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  inviteSend: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  inviteSendDisabled: {
    opacity: 0.7,
  },
  inviteSendText: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    color: BRAND_COLORS.ink,
  },
  inviteStatus: {
    marginTop: -4,
    marginBottom: 10,
    marginLeft: 32,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    color: CREAM_MUTED,
  },
  inviteStatusError: {
    color: '#F4C7C3',
  },
});

export default ProfileCard;
