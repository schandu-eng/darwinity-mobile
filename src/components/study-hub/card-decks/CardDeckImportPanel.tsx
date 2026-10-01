import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Fonts } from '@/config/fonts';
import { StudyPillButton } from '../StudyPillButton';
import {
  CARD_SEP_PRESETS,
  TERM_SEP_PRESETS,
  importPlaceholderExample,
  parseQuizletImport,
} from './cardDeckImportParse';
import {
  STUDY_BORDER,
  STUDY_INK,
  STUDY_PAPER,
  STUDY_ZINC_500,
  studySubStyle,
  studyTitleStyle,
} from '../studyPanelTokens';

type Props = {
  importing?: boolean;
  onCancel: () => void;
  onImport: (cards: Array<{ front: string; back: string }>) => void;
};

const CardDeckImportPanel: React.FC<Props> = ({ importing = false, onCancel, onImport }) => {
  const [rawText, setRawText] = useState('');
  const [termSepId, setTermSepId] = useState('tab');
  const [termCustom, setTermCustom] = useState('-');
  const [cardSepId, setCardSepId] = useState('newline');
  const [cardCustom, setCardCustom] = useState(';');

  const parsed = useMemo(
    () =>
      parseQuizletImport(rawText, {
        termSepId,
        termCustom,
        cardSepId,
        cardCustom,
      }),
    [rawText, termSepId, termCustom, cardSepId, cardCustom]
  );

  const previewCards = parsed.cards.slice(0, 8);
  const canImport = parsed.cards.length > 0 && !parsed.error && !importing;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.kicker, { color: STUDY_INK }]}>Import</Text>
      <Text style={[studyTitleStyle, { color: STUDY_INK }]}>Import your data</Text>
      <Text style={[studySubStyle, { color: STUDY_ZINC_500, marginBottom: 16 }]}>
        Paste from Word, Excel, Google Docs, or Quizlet. We’ll split it into cards.
      </Text>

      <TextInput
        value={rawText}
        onChangeText={setRawText}
        editable={!importing}
        multiline
        textAlignVertical="top"
        placeholder={importPlaceholderExample(termSepId)}
        placeholderTextColor="#A1A1AA"
        style={styles.textarea}
      />

      <View style={styles.sepGrid}>
        <SepGroup
          name="Between term and definition"
          options={TERM_SEP_PRESETS}
          value={termSepId}
          onChange={setTermSepId}
          customValue={termCustom}
          onCustomChange={setTermCustom}
          disabled={importing}
        />
        <SepGroup
          name="Between cards"
          options={CARD_SEP_PRESETS}
          value={cardSepId}
          onChange={setCardSepId}
          customValue={cardCustom}
          onCustomChange={setCardCustom}
          disabled={importing}
        />
      </View>

      <Text style={styles.previewHead}>
        Preview {parsed.cards.length} card{parsed.cards.length === 1 ? '' : 's'}
      </Text>
      {parsed.skipped > 0 ? (
        <Text style={styles.skipped}>
          Skipped {parsed.skipped} incomplete line{parsed.skipped === 1 ? '' : 's'}
        </Text>
      ) : null}

      {parsed.error ? (
        <Text style={styles.error}>{parsed.error}</Text>
      ) : previewCards.length === 0 ? (
        <Text style={styles.emptyPreview}>Nothing to preview yet.</Text>
      ) : (
        <View style={styles.previewList}>
          {previewCards.map((card, index) => (
            <View key={`${index}-${card.front.slice(0, 24)}`} style={styles.previewRow}>
              <Text style={styles.previewFront} numberOfLines={2}>
                {String(index + 1).padStart(2, '0')}  {card.front}
              </Text>
              <Text style={styles.previewBack} numberOfLines={2}>
                {card.back}
              </Text>
            </View>
          ))}
          {parsed.cards.length > previewCards.length ? (
            <Text style={styles.more}>+{parsed.cards.length - previewCards.length} more</Text>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        <StudyPillButton label="Cancel import" variant="secondary" onPress={onCancel} disabled={importing} />
        <StudyPillButton
          label={parsed.cards.length > 0 ? `Import ${parsed.cards.length}` : 'Import'}
          onPress={() => onImport(parsed.cards)}
          disabled={!canImport}
          loading={importing}
        />
      </View>
    </ScrollView>
  );
};

function SepGroup({
  name,
  options,
  value,
  onChange,
  customValue,
  onCustomChange,
  disabled,
}: {
  name: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.sepGroup}>
      <Text style={styles.sepLegend}>{name}</Text>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            disabled={disabled}
            onPress={() => onChange(opt.id)}
            style={[styles.sepOption, selected && styles.sepOptionOn]}
          >
            <View style={[styles.radio, selected && styles.radioOn]} />
            <Text style={styles.sepLabel}>{opt.label}</Text>
            {opt.id === 'custom' ? (
              <TextInput
                value={customValue}
                onChangeText={(next) => {
                  onChange('custom');
                  onCustomChange(next);
                }}
                editable={!disabled}
                maxLength={8}
                placeholder="…"
                style={styles.customInput}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  kicker: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    borderRadius: 16,
    padding: 14,
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    color: STUDY_INK,
    backgroundColor: '#fff',
  },
  sepGrid: { marginTop: 16, gap: 16 },
  sepGroup: {
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    borderRadius: 16,
    padding: 12,
    backgroundColor: STUDY_PAPER,
  },
  sepLegend: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: STUDY_ZINC_500,
    marginBottom: 8,
  },
  sepOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  sepOptionOn: { backgroundColor: 'rgba(63,107,79,0.08)' },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#A1A1AA',
  },
  radioOn: { borderColor: STUDY_INK, backgroundColor: STUDY_INK },
  sepLabel: { fontFamily: Fonts.ui.regular, fontSize: 14, color: STUDY_INK, flex: 1 },
  customInput: {
    width: 56,
    height: 28,
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    backgroundColor: '#fff',
    color: STUDY_INK,
  },
  previewHead: {
    marginTop: 20,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    color: STUDY_INK,
  },
  skipped: { marginTop: 4, fontSize: 12, color: '#B45309' },
  error: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    fontSize: 14,
  },
  emptyPreview: {
    marginTop: 8,
    paddingVertical: 28,
    textAlign: 'center',
    color: '#A1A1AA',
    fontSize: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: STUDY_BORDER,
    borderRadius: 12,
  },
  previewList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#fff',
  },
  previewRow: { paddingVertical: 8, paddingHorizontal: 8, gap: 2 },
  previewFront: { fontFamily: Fonts.ui.medium, fontSize: 13, color: STUDY_INK },
  previewBack: { fontFamily: Fonts.ui.regular, fontSize: 13, color: STUDY_ZINC_500 },
  more: { textAlign: 'center', fontSize: 12, color: '#A1A1AA', paddingVertical: 6 },
  actions: { marginTop: 24, gap: 10 },
});

export default CardDeckImportPanel;
