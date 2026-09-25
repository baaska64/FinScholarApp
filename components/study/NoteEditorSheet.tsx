import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import FaceText from './FaceText';
import { FlashcardDeck, NoteKind } from './types';
import {
  NOTE_KINDS,
  NoteDraft,
  NoteRow,
  clozeNumbers,
  clozePlain,
  parseTags,
  renderCloze,
  validateNote,
  wrapCloze,
} from './notes';

interface NoteEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  decks: FlashcardDeck[];
  /** Deck a new note goes into; the picker starts here. */
  deckId: string | null;
  /** The note being edited, or null to add one. */
  note: NoteRow | null;
  /** Remembered between opens so a run of cloze notes stays cloze. */
  defaultKind: NoteKind;
  onSave: (draft: NoteDraft, deckId: string, keepOpen: boolean) => void;
  onDelete?: (note: NoteRow) => void;
}

/**
 * Add / edit a note. The note type is the first thing on the sheet because it
 * changes what the fields mean — the one Anki idea a student has to meet
 * before cloze makes sense — and each type says in a line what it will make.
 * The preview underneath shows the cards themselves, so "one card per blank"
 * is something you watch happen rather than read about.
 */
export default function NoteEditorSheet({
  visible,
  onClose,
  isDark,
  decks,
  deckId,
  note,
  defaultKind,
  onSave,
  onDelete,
}: NoteEditorSheetProps) {
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const [kind, setKind] = useState<NoteKind>(defaultKind);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [showTags, setShowTags] = useState(false);
  const [targetDeck, setTargetDeck] = useState<string | null>(deckId);
  const [error, setError] = useState<string | null>(null);
  const selection = useRef({ start: 0, end: 0 });
  const frontRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    if (note) {
      setKind(note.kind);
      setFront(note.front);
      setBack(note.back);
      setTagsText((note.tags || []).join(' '));
      setShowTags((note.tags || []).length > 0);
    } else {
      setKind(defaultKind);
      setFront('');
      setBack('');
      setTagsText('');
      setShowTags(false);
    }
    setTargetDeck(deckId || decks[0]?.id || null);
    setError(null);
    selection.current = { start: 0, end: 0 };
  }, [visible, note?.noteId]);

  const draft: NoteDraft = { kind, front, back, tags: parseTags(tagsText) };
  const ords = kind === 'cloze' ? clozeNumbers(front) : kind === 'reversed' ? [0, 1] : [0];
  const deckColor = decks.find((d) => d.id === targetDeck)?.color || theme.primary;

  const switchKind = (k: NoteKind) => {
    if (k === kind) return;
    // Leaving cloze: keep the words, drop the {{c1::…}} scaffolding.
    if (kind === 'cloze' && k !== 'cloze' && clozeNumbers(front).length) setFront(clozePlain(front));
    setKind(k);
    setError(null);
  };

  const hide = (same: boolean) => {
    const { start, end } = selection.current;
    if (start === end) {
      setError('Select the word or phrase to hide first, then tap Hide.');
      return;
    }
    const res = wrapCloze(front, start, end, same);
    setFront(res.text);
    selection.current = { start: res.caret, end: res.caret };
    setError(null);
  };

  const save = (keepOpen: boolean) => {
    const problem = validateNote(draft);
    if (problem) {
      setError(problem);
      return;
    }
    if (!targetDeck) {
      setError('Pick a deck for this card.');
      return;
    }
    onSave(draft, targetDeck, keepOpen);
    if (keepOpen) {
      setFront('');
      setBack('');
      setError(null);
      selection.current = { start: 0, end: 0 };
      setTimeout(() => frontRef.current?.focus(), 60);
    }
  };

  const microLabel = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.textTertiary,
  };
  const field = {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBg,
    color: theme.text,
    padding: 14,
    fontFamily: 'Nunito_600SemiBold' as const,
    fontSize: 15,
    textAlignVertical: 'top' as const,
  };

  const countLabel = ords.length === 1 ? '1 card' : `${ords.length} cards`;
  const primaryLabel = note ? 'Save' : kind === 'cloze' && ords.length > 1 ? `Add ${countLabel}` : kind === 'reversed' ? 'Add 2 cards' : 'Add card';
  const labels =
    kind === 'cloze'
      ? { front: 'Text', back: 'Extra · shown with the answer (optional)' }
      : kind === 'typein'
      ? { front: 'Front · the question', back: 'Back · the exact answer to type' }
      : { front: 'Front · the prompt', back: 'Back · the answer' };

  const deckChoices = useMemo(() => decks.filter(Boolean), [decks]);

  return (
    <KeyboardSheet
      visible={visible}
      onClose={onClose}
      title={note ? 'Edit note' : 'Add cards'}
      subtitle={note ? `${note.cards.length} card${note.cards.length !== 1 ? 's' : ''} · edits keep their progress` : undefined}
      icon={note ? 'create-outline' : 'add-circle-outline'}
      tint={tints.grades}
      headerRight={
        note && onDelete ? (
          <TouchableOpacity
            onPress={() => onDelete(note)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete note"
            style={{ width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tints.danger.fill }}
          >
            <Ionicons name="trash-outline" size={15} color={tints.danger.ink} />
          </TouchableOpacity>
        ) : undefined
      }
      footer={
        <View style={{ gap: 4 }}>
          <AnimatedPressable
            onPress={() => save(false)}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            style={{
              paddingVertical: 14,
              borderRadius: Radius.lg,
              alignItems: 'center',
              backgroundColor: theme.primary,
              borderBottomWidth: 3,
              borderBottomColor: theme.primaryDark,
            }}
          >
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: '#ffffff' }}>{primaryLabel}</Text>
          </AnimatedPressable>
          {!note && (
            <TouchableOpacity
              onPress={() => save(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add and start another"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9 }}
            >
              <Ionicons name="add" size={15} color={theme.textSecondary} />
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.textSecondary }}>Add & start another</Text>
            </TouchableOpacity>
          )}
        </View>
      }
    >
      {/* ── Note type ── */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {NOTE_KINDS.map((k) => {
          const active = kind === k.kind;
          return (
            <TouchableOpacity
              key={k.kind}
              onPress={() => switchKind(k.kind)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${k.label}. ${k.desc}`}
              style={{
                flexGrow: 1,
                flexBasis: '45%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingHorizontal: 12,
                height: 38,
                borderRadius: Radius.full,
                backgroundColor: active ? tints.grades.fill : theme.surfaceSecondary,
                borderWidth: 1,
                borderColor: active ? tints.grades.line : theme.cardBorder,
              }}
            >
              <Ionicons name={k.icon as any} size={14} color={active ? tints.grades.ink : theme.textSecondary} />
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: active ? tints.grades.ink : theme.textSecondary }}>
                {k.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginBottom: 16 }}>
        {NOTE_KINDS.find((k) => k.kind === kind)?.desc}
      </Text>

      {/* ── Deck ── */}
      {!note && deckChoices.length > 1 && (
        <>
          <Text style={{ ...microLabel, marginBottom: 8 }}>Deck</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 7 }}>
              {deckChoices.map((d) => {
                const active = d.id === targetDeck;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setTargetDeck(d.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 11,
                      height: 30,
                      borderRadius: Radius.full,
                      backgroundColor: active ? d.color + (isDark ? '30' : '1c') : theme.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: active ? d.color : theme.cardBorder,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.color }} />
                    <Text numberOfLines={1} style={{ maxWidth: 150, fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? theme.text : theme.textSecondary }}>
                      {d.name.split('::').pop()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}

      {/* ── Fields ── */}
      <Text style={{ ...microLabel, marginBottom: 8 }}>{labels.front}</Text>
      <TextInput
        ref={frontRef}
        style={{ ...field, minHeight: kind === 'cloze' ? 104 : 80, marginBottom: kind === 'cloze' ? 8 : 16 }}
        placeholder={kind === 'cloze' ? 'The mitochondria is the powerhouse of the cell.' : kind === 'typein' ? 'Capital of Japan?' : 'What is the capital of France?'}
        placeholderTextColor={theme.textTertiary}
        value={front}
        onChangeText={(t) => {
          setFront(t);
          if (error) setError(null);
        }}
        onSelectionChange={(e) => {
          selection.current = e.nativeEvent.selection;
        }}
        accessibilityLabel={labels.front}
        multiline
      />

      {kind === 'cloze' && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => hide(false)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Hide the selected words on a new card"
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 38,
                borderRadius: Radius.md,
                backgroundColor: tints.grades.fill,
                borderWidth: 1,
                borderColor: tints.grades.line,
              }}
            >
              <Ionicons name="eye-off-outline" size={15} color={tints.grades.ink} />
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: tints.grades.ink }}>Hide · new card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => hide(true)}
              disabled={ords.length === 0}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Hide the selected words on the same card as the last blank"
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 38,
                borderRadius: Radius.md,
                backgroundColor: theme.surfaceSecondary,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                opacity: ords.length === 0 ? 0.45 : 1,
              }}
            >
              <Ionicons name="layers-outline" size={15} color={theme.textSecondary} />
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: theme.textSecondary }}>Hide · same card</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginTop: 7, lineHeight: 16 }}>
            Select words, then tap Hide. Or type {'{{c1::word}}'} yourself — add {'::hint'} before the braces for a hint.
          </Text>
        </View>
      )}

      <Text style={{ ...microLabel, marginBottom: 8 }}>{labels.back}</Text>
      <TextInput
        style={{ ...field, minHeight: kind === 'cloze' ? 56 : 80, marginBottom: 12 }}
        placeholder={kind === 'cloze' ? 'A memory aid, source or example' : kind === 'typein' ? 'Tokyo' : 'Paris'}
        placeholderTextColor={theme.textTertiary}
        value={back}
        onChangeText={(t) => {
          setBack(t);
          if (error) setError(null);
        }}
        accessibilityLabel={labels.back}
        multiline
      />

      {showTags ? (
        <>
          <Text style={{ ...microLabel, marginBottom: 8 }}>Tags</Text>
          <TextInput
            style={{ ...field, paddingVertical: 11, marginBottom: 12 }}
            placeholder="chapter3 formulas"
            placeholderTextColor={theme.textTertiary}
            value={tagsText}
            onChangeText={setTagsText}
            autoCapitalize="none"
            accessibilityLabel="Tags, separated by spaces"
          />
        </>
      ) : (
        <TouchableOpacity
          onPress={() => setShowTags(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 12 }}
        >
          <Ionicons name="pricetag-outline" size={13} color={theme.textSecondary} />
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: theme.textSecondary }}>Add tags</Text>
        </TouchableOpacity>
      )}

      {error ? (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 7,
            paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.md, marginBottom: 12,
            backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line,
          }}
        >
          <Ionicons name="alert-circle-outline" size={15} color={tints.danger.ink} />
          <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: tints.danger.ink }}>{error}</Text>
        </View>
      ) : null}

      {/* ── Preview ── */}
      {(kind === 'cloze' ? ords.length > 0 : front.trim() && back.trim()) ? (
        <View style={{ marginBottom: 6 }}>
          <Text style={{ ...microLabel, marginBottom: 8 }}>Preview · {countLabel}</Text>
          {(kind === 'cloze' ? ords : kind === 'reversed' ? [0, 1] : [0]).map((ord, i) => {
            const segs =
              kind === 'cloze'
                ? renderCloze(front, ord, 'question')
                : [{ text: ord === 1 ? back.trim() : front.trim(), style: 'plain' as const }];
            const ans = kind === 'cloze' ? null : ord === 1 ? front.trim() : back.trim();
            return (
              <View
                key={ord}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  padding: 11,
                  borderRadius: Radius.md,
                  marginBottom: 6,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary,
                  borderLeftWidth: 3,
                  borderLeftColor: deckColor,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11, color: theme.textTertiary, width: 22 }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <FaceText
                    segments={segs}
                    color={deckColor}
                    isDark={isDark}
                    numberOfLines={3}
                    style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 18, color: theme.text }}
                  />
                  {ans ? (
                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                      → {ans}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </KeyboardSheet>
  );
}
