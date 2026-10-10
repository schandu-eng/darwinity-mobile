import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store';
import { Fonts } from '@/config/fonts';
import apiClient from '@/api/client';
import { contentEndpoints } from '@/api/endpoints/content';
import ErrorBanner from '@/components/ui/ErrorBanner';

type Props = {
  visible: boolean;
  onClose: () => void;
  contentId: number;
  noteTitle?: string;
};

const STARS = [1, 2, 3, 4, 5] as const;

const NotesShareRateModal: React.FC<Props> = ({ visible, onClose, contentId, noteTitle }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((s) => s.user);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRating(0);
    setRated(false);
    setShareUrl('');
    setBusy(false);
    setError(null);
    contentEndpoints
      .getNoteShare(contentId)
      .then((data) => {
        if (data?.share_url) setShareUrl(data.share_url);
      })
      .catch(() => {});
  }, [visible, contentId]);

  const submitRating = useCallback(
    async (value: number) => {
      if (busy || rated) return;
      setBusy(true);
      setError(null);
      setRating(value);
      try {
        await apiClient.post('/api/feedback', {
          message: `Rated notes ${value} stars`,
          rating: value,
          user_id: user?.id ?? null,
          email: user?.email ?? null,
          source: 'notes_ready_mobile',
          categories: ['notes_quality'],
        });
        setRated(true);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Could not save rating');
        setRating(0);
      } finally {
        setBusy(false);
      }
    },
    [busy, rated, user]
  );

  const enableShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await contentEndpoints.enableNoteShare(contentId);
      const url = data?.share_url || '';
      setShareUrl(url);
      if (url) {
        await Share.share({
          message: Platform.OS === 'ios' ? noteTitle || 'Study notes' : `${noteTitle || 'Study notes'}\n${url}`,
          url: Platform.OS === 'ios' ? url : undefined,
          title: noteTitle || 'Study notes',
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not create share link');
    } finally {
      setBusy(false);
    }
  }, [busy, contentId, noteTitle]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>How are these notes?</Text>
          <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
            Rate the first draft, then share a public read-only link if you want.
          </Text>

          {error ? <ErrorBanner message={error} /> : null}

          <View style={styles.starsRow}>
            {STARS.map((value) => (
              <TouchableOpacity
                key={value}
                disabled={busy || rated}
                onPress={() => submitRating(value)}
                accessibilityLabel={`${value} stars`}
              >
                <MaterialCommunityIcons
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={30}
                  color={value <= rating ? '#D4A017' : theme.colors.outline}
                />
              </TouchableOpacity>
            ))}
          </View>

          {shareUrl ? (
            <View style={styles.linkBox}>
              <TextInput
                editable={false}
                value={shareUrl}
                style={[styles.linkInput, { color: theme.colors.onSurface }]}
              />
              <TouchableOpacity onPress={enableShare} disabled={busy} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Share again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={enableShare}
              disabled={busy}
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Create public link</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={styles.dismiss}>
            <Text style={[styles.dismissText, { color: theme.colors.onSurfaceVariant }]}>
              {rated || shareUrl ? 'Done' : 'Not now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
  },
  body: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: 8,
  },
  secondaryBtnText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  linkBox: {
    gap: 4,
  },
  linkInput: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    paddingVertical: 8,
  },
  dismiss: {
    alignItems: 'center',
    paddingTop: 4,
  },
  dismissText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
});

export default NotesShareRateModal;
