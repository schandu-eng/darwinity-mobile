import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import {
  buildGameItemsFromStudyNotes,
  GAME_CATALOG,
  MIN_GAME_ITEMS,
  normalizeGeneratedGameItems,
  topicsToStudyDocument,
} from '@shared/study-games/index.js';
import { useContent } from '@/api/queries/content';
import { useAuthStore } from '@/store';
import { learningService } from '@/services/studyHubService';
import { Eye, Gamepad2, NotebookPen, Play, Route, Type } from '@/icons';
import { Fonts } from '@/config/fonts';
import { StudyPillButton } from './StudyPillButton';
import { STUDY_INK, STUDY_PAPER, STUDY_ZINC_500 } from './studyPanelTokens';
import { getEditorBlocks } from '@/utils/notesMarkdown';
import { CityRunGame } from './games/CityRunGame';
import { TypingRushGame } from './games/TypingRushGame';
import { PhantomArenaGame } from './games/PhantomArenaGame';
import { GamesGeneratingScreen } from './games/GamesGeneratingScreen';

type GameId = 'city-run' | 'typing-rush' | 'phantom';

const GAME_ICONS = { 'city-run': Route, 'typing-rush': Type, phantom: Eye } as const;

const GameCardArt: React.FC<{ accent: 'city' | 'orbit' | 'phantom' }> = ({ accent }) => {
  if (accent === 'city') {
    return (
      <View style={[styles.art, { backgroundColor: '#dce8df' }]}>
        <View style={styles.road} />
        <View style={[styles.runner, { left: '46%' }]} />
        <View style={[styles.gate, { left: '22%' }]} />
        <View style={[styles.gate, { right: '18%', backgroundColor: '#3d5646' }]} />
      </View>
    );
  }
  if (accent === 'orbit') {
    return (
      <View style={[styles.art, { backgroundColor: '#d4ebe7' }]}>
        <Text style={styles.typeLine}>
          highlight<Text style={styles.caret}>|</Text>
        </Text>
        <View style={styles.keys}>
          {['A', 'S', 'D'].map((k) => (
            <View key={k} style={styles.key}>
              <Text style={styles.keyText}>{k}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.art, { backgroundColor: '#1a221e' }]}>
      <View style={styles.boss} />
      <View style={styles.orb}>
        <Text style={styles.orbText}>?</Text>
      </View>
    </View>
  );
};

type StudyGamesPanelProps = {
  contentId: number;
  onNavigateToTab?: (tab: 'notes' | 'flashcards') => void;
};

export const StudyGamesPanel: React.FC<StudyGamesPanelProps> = ({
  contentId,
  onNavigateToTab,
}) => {
  const paper = STUDY_PAPER;
  const userId = useAuthStore((s) => s.user?.id);
  const { data: contentData } = useContent(contentId);
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [generatedItems, setGeneratedItems] = useState<ReturnType<typeof normalizeGeneratedGameItems> | null>(null);
  const [generating, setGenerating] = useState(false);
  const generateRef = useRef<Promise<ReturnType<typeof normalizeGeneratedGameItems>> | null>(null);

  const document = getEditorBlocks(contentData?.data?.editor_blocks);
  const topics = contentData?.data?.topics || [];

  const notesItems = useMemo(() => {
    if (Array.isArray(document) && document.length > 0) {
      return buildGameItemsFromStudyNotes(document, { choiceCount: 3 });
    }
    return buildGameItemsFromStudyNotes(topicsToStudyDocument(topics), { choiceCount: 3 });
  }, [document, topics]);

  const playItems = generatedItems?.length ? generatedItems : notesItems;
  const ready = topics.length > 0 || (Array.isArray(document) && document.length > 0) || playItems.length >= MIN_GAME_ITEMS;
  const hasNotes = topics.length > 0 || (Array.isArray(document) && document.length > 0);
  const hasAnyMaterial = hasNotes || notesItems.length > 0;

  const ensureGeneratedItems = useCallback(async () => {
    if ((generatedItems?.length || 0) >= MIN_GAME_ITEMS) return generatedItems || [];
    if (generateRef.current) return generateRef.current;
    if (!userId) {
      return notesItems.length >= MIN_GAME_ITEMS ? notesItems : [];
    }
    setGenerating(true);
    generateRef.current = (async () => {
      try {
        const result = await learningService.generateStudyGameItems(contentId, userId, 16);
        const normalized = normalizeGeneratedGameItems(result.data?.items || [], { choiceCount: 3 });
        if (result.success && normalized.length >= MIN_GAME_ITEMS) {
          setGeneratedItems(normalized);
          return normalized;
        }
        if (notesItems.length >= MIN_GAME_ITEMS) return notesItems;
        throw new Error(result.message || 'Not enough questions yet. Add a bit more to your notes.');
      } catch (err) {
        if (notesItems.length >= MIN_GAME_ITEMS) return notesItems;
        throw err;
      } finally {
        generateRef.current = null;
        setGenerating(false);
      }
    })();
    return generateRef.current;
  }, [contentId, userId, generatedItems, notesItems]);

  const startGame = async (gameId: GameId) => {
    try {
      const items = await ensureGeneratedItems();
      if (!items || items.length < MIN_GAME_ITEMS) {
        Alert.alert('Not ready yet', 'Add a bit more to your notes to unlock play.');
        return;
      }
      setActiveGame(gameId);
    } catch (err) {
      Alert.alert('Could not prepare questions', err instanceof Error ? err.message : 'Try again');
    }
  };

  if (generating && !activeGame) {
    return <GamesGeneratingScreen />;
  }

  if (activeGame) {
    const exit = () => setActiveGame(null);
    const game =
      activeGame === 'city-run' ? (
        <CityRunGame items={playItems} onExit={exit} />
      ) : activeGame === 'typing-rush' ? (
        <TypingRushGame items={playItems} contentId={contentId} onExit={exit} />
      ) : (
        <PhantomArenaGame items={playItems} onExit={exit} />
      );
    return (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={exit}
      >
        <View style={[styles.playHost, { backgroundColor: paper }]}>{game}</View>
      </Modal>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: paper }]} contentContainerStyle={styles.catalog}>
      <View style={styles.toolbar}>
        {ready ? (
          <View style={styles.marks}>
            <View style={styles.marksDot} />
            <Text style={styles.marksText}>{notesItems.length} from notes</Text>
          </View>
        ) : (
          <View />
        )}
        <StudyPillButton
          label="Open Notes"
          variant="secondary"
          icon={NotebookPen}
          onPress={() => onNavigateToTab?.('notes')}
        />
      </View>

      {!hasAnyMaterial ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Gamepad2 size={28} strokeWidth={1.6} color={STUDY_INK} />
          </View>
          <Text style={styles.emptyTitle}>Open Notes to start playing</Text>
          <Text style={styles.emptyCopy}>Games write short quiz-style questions from your notes.</Text>
        </View>
      ) : !ready ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <NotebookPen size={28} strokeWidth={1.6} color={STUDY_INK} />
          </View>
          <Text style={styles.emptyTitle}>Add a bit more to your notes to unlock play</Text>
          <Text style={styles.emptyCopy}>
            Add a couple more key terms or definitions so we can write questions ({notesItems.length}/{MIN_GAME_ITEMS}).
          </Text>
        </View>
      ) : null}

      {GAME_CATALOG.map((game) => {
        const Icon = GAME_ICONS[game.id as GameId];
        const locked = !ready;
        return (
          <TouchableOpacity
            key={game.id}
            disabled={locked}
            onPress={() => void startGame(game.id as GameId)}
            style={[styles.tile, locked && styles.tileLocked]}
            activeOpacity={0.9}
          >
            <GameCardArt accent={game.accent as 'city' | 'orbit' | 'phantom'} />
            <View style={styles.tileBody}>
              <View style={styles.tileMeta}>
                <View style={[styles.tileIcon, { backgroundColor: game.artBg }]}>
                  <Icon size={14} strokeWidth={2} color={game.playColor} />
                </View>
                <Text style={styles.tileMetaText}>{game.meta}</Text>
              </View>
              <Text style={styles.tileTitle}>{game.title}</Text>
              <Text style={styles.tileBlurb}>{game.blurb}</Text>
              <View style={[styles.playChip, { backgroundColor: locked ? '#A1A1AA' : game.playColor }]}>
                {locked ? (
                  <Text style={styles.playChipText}>Locked</Text>
                ) : (
                  <>
                    <Play size={14} strokeWidth={2.25} color="#fff" fill="#fff" />
                    <Text style={styles.playChipText}>Play</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  playHost: { flex: 1 },
  catalog: { paddingBottom: 40, gap: 12 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marksDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5f7f6a' },
  marksText: { fontFamily: Fonts.ui.medium, fontSize: 12, color: STUDY_ZINC_500 },
  empty: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E8EDE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 18, color: STUDY_INK, textAlign: 'center' },
  emptyCopy: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    color: STUDY_ZINC_500,
    textAlign: 'center',
    marginTop: 6,
  },
  tile: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(95,127,106,0.16)',
    backgroundColor: '#fff',
  },
  tileLocked: { opacity: 0.48 },
  art: { height: 118, overflow: 'hidden' },
  road: {
    position: 'absolute',
    left: '11%',
    right: '11%',
    bottom: -18,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#8fad97',
  },
  runner: {
    position: 'absolute',
    bottom: 28,
    width: 18,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1A2F23',
  },
  gate: {
    position: 'absolute',
    bottom: 36,
    width: 28,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#7a9e86',
  },
  typeLine: {
    position: 'absolute',
    left: 20,
    top: 28,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    color: '#1f4f4a',
  },
  caret: { color: '#3d8a80' },
  keys: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', gap: 6 },
  key: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: Fonts.ui.bold, fontSize: 12, color: '#1f4f4a' },
  boss: {
    position: 'absolute',
    left: 28,
    top: 28,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5a2f2f',
  },
  orb: {
    position: 'absolute',
    right: 28,
    bottom: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#b45a5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbText: { color: '#fff', fontFamily: Fonts.ui.bold },
  tileBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tileIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMetaText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#7a8a80',
  },
  tileTitle: {
    fontFamily: Fonts.display.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: '#18261e',
  },
  tileBlurb: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#5f6e66',
    marginTop: 4,
  },
  playChip: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playChipText: { fontFamily: Fonts.ui.bold, fontSize: 13, color: '#fff' },
});

export default StudyGamesPanel;
