import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import FaceText from './FaceText';
import { CardFaces, typeDiff, typedMatches, DiffPart, kindOf, kindLabel } from './notes';
import { Flashcard } from './types';
import OcclusionImage from './OcclusionImage';
import { maskStates, isLocateOrd, groupOfOrd, maskAt } from './occlusion';

interface ReviewCardProps {
  card: Flashcard;
  faces: CardFaces;
  revealed: boolean;
  onReveal: () => void;
  color: string;
  isDark: boolean;
  /** Queue the card came from, as Anki's session counter colours it. */
  queueLabel: string;
  queueTint: { fill: string; ink: string };
  /** Shown when a session spans more than one deck. */
  deckName?: string;
  typed: string;
  onChangeTyped: (t: string) => void;
}

/**
 * The card under review, laid out the way Anki lays out a card: the question,
 * and on reveal the answer beneath a rule — not a flip. The question stays on
 * screen so the answer is read against it; a flip hides one side to show the
 * other, and on a cloze card it would hide the very sentence being tested.
 * Cloze is the exception that proves it: its back *is* the sentence, with the
 * deletion highlighted in place, so it replaces the front instead.
 */
export default function ReviewCard({
  card,
  faces,
  revealed,
  onReveal,
  color,
  isDark,
  queueLabel,
  queueTint,
  deckName,
  typed,
  onChangeTyped,
}: ReviewCardProps) {
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const kind = kindOf(card);
  const fade = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  // Image occlusion: the box a student tapped on a "where is it?" card, and
  // Anki's "toggle masks" on the answer side.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [wholePicture, setWholePicture] = useState(false);
  useEffect(() => {
    setChosenId(null);
    setWholePicture(false);
  }, [card.id]);

  useEffect(() => {
    if (revealed) {
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [revealed, card.id]);

  const faceStyle = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 21,
    lineHeight: 30,
    color: theme.text,
    textAlign: 'center' as const,
  };

  const diff = revealed && faces.typeTarget !== null ? typeDiff(typed, faces.typeTarget) : null;
  const correct = faces.typeTarget !== null && typedMatches(typed, faces.typeTarget);

  const renderDiff = (parts: DiffPart[]) => (
    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 17, lineHeight: 25, textAlign: 'center' }}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={{
            color: p.kind === 'good' ? tints.attendance.ink : p.kind === 'bad' ? tints.danger.ink : theme.textTertiary,
            backgroundColor: p.kind === 'good' ? undefined : p.kind === 'bad' ? tints.danger.fill : tints.tasks.fill,
            textDecorationLine: p.kind === 'missed' ? 'underline' : 'none',
          }}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );

  const showQuestion = !(revealed && kind === 'cloze');

  return (
    <View
      style={{
        flex: 1,
        borderRadius: Radius['3xl'],
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        // The deck colour doubles as the card's lip, so it reads as an object
        // resting on the page rather than a sheet floating over it.
        borderBottomWidth: 4,
        borderBottomColor: color,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, gap: 6 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: queueTint.fill }}>
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, letterSpacing: 0.6, color: queueTint.ink }}>
            {queueLabel.toUpperCase()}
          </Text>
        </View>
        {kind !== 'basic' && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: theme.surfaceSecondary }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10, letterSpacing: 0.6, color: theme.textSecondary }}>
              {kindLabel(kind).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {card.flagged && <Ionicons name="flag" size={14} color={tints.danger.solid} />}
        {deckName ? (
          <Text numberOfLines={1} style={{ maxWidth: 140, fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textTertiary }}>
            {deckName}
          </Text>
        ) : null}
      </View>

      {kind === 'occlusion' && card.occlusion ? (() => {
        const occ = card.occlusion!;
        const locate = isLocateOrd(card.ord);
        const group = groupOfOrd(card.ord);
        const states = wholePicture && revealed
          ? Object.fromEntries(occ.masks.map((m) => [m.id, m.group === group && !locate ? 'revealed' : 'open'])) as any
          : maskStates(occ, card.ord || 0, revealed ? 'answer' : 'question');
        const chosen = chosenId ? occ.masks.find((m) => m.id === chosenId) : null;
        const locateRight = chosen ? chosen.group === group : null;
        const prompt = faces.question.map((x) => x.text).join('').trim();
        const answer = faces.answer.map((x) => x.text).join('').trim();
        return (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {prompt ? (
              <Text style={{ ...faceStyle, fontSize: locate ? 20 : 17, marginBottom: 12 }}>{prompt}</Text>
            ) : null}

{locate && !revealed ? (
              // Not inside a (disabled) touchable: that would swallow the tap.
              <OcclusionImage
                data={occ}
                states={states}
                showLabels={revealed}
                chosenId={revealed ? chosenId : null}
                isDark={isDark}
                maxHeight={Dimensions.get('window').height * 0.5}
                onPressPoint={locate && !revealed ? (x, y) => {
                  // A tap between boxes is a slip, not an answer: only a box counts.
                  const hit = maskAt(occ.masks, x, y);
                  if (!hit) return;
                  setChosenId(hit.id);
                  onReveal();
                } : undefined}
              />
            ) : (
              <TouchableOpacity activeOpacity={revealed ? 1 : 0.9} disabled={revealed} onPress={onReveal} accessibilityRole="button" accessibilityLabel={revealed ? undefined : 'Show answer'}>
                <OcclusionImage
                data={occ}
                states={states}
                showLabels={revealed}
                chosenId={revealed ? chosenId : null}
                isDark={isDark}
                maxHeight={Dimensions.get('window').height * 0.5}
                onPressPoint={locate && !revealed ? (x, y) => {
                  const hit = maskAt(occ.masks, x, y);
                  setChosenId(hit ? hit.id : null);
                  onReveal();
                } : undefined}
              />
              </TouchableOpacity>
            )}

            {revealed ? (
              <Animated.View style={{ opacity: fade, alignItems: 'center', marginTop: 14, gap: 10 }}>
                {locate ? (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
                    backgroundColor: locateRight ? tints.attendance.fill : tints.danger.fill,
                  }}>
                    <Ionicons name={locateRight ? 'checkmark-circle' : 'close-circle'} size={14} color={locateRight ? tints.attendance.ink : tints.danger.ink} />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: locateRight ? tints.attendance.ink : tints.danger.ink }}>
                      {chosen ? (locateRight ? 'Right spot' : 'Not quite — it is outlined in green') : 'Missed — it is outlined in green'}
                    </Text>
                  </View>
                ) : answer ? (
                  <Text style={{ ...faceStyle, fontFamily: 'Nunito_900Black', fontSize: 19 }}>{answer}</Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => setWholePicture((v) => !v)}
                  activeOpacity={0.75}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: wholePicture }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: Radius.full, backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.cardBorder }}
                >
                  <Ionicons name={wholePicture ? 'eye-off-outline' : 'eye-outline'} size={14} color={theme.textSecondary} />
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.textSecondary }}>{wholePicture ? 'Show the boxes again' : 'Show the whole picture'}</Text>
                </TouchableOpacity>
                {faces.extra ? (
                  <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: theme.textSecondary, textAlign: 'center' }}>{faces.extra}</Text>
                ) : null}
              </Animated.View>
            ) : (
              <Text style={{ textAlign: 'center', marginTop: 12, fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, color: theme.textTertiary }}>
                {locate ? 'Tap the box where it is' : 'What is under the red box? Recall it, then tap to check'}
              </Text>
            )}
          </ScrollView>
        );
      })() : (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 22 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          activeOpacity={revealed ? 1 : 0.85}
          disabled={revealed}
          onPress={onReveal}
          accessibilityRole="button"
          accessibilityLabel={revealed ? undefined : 'Show answer'}
        >
          {showQuestion ? (
            <FaceText segments={faces.question} color={color} isDark={isDark} style={faceStyle} />
          ) : (
            <Animated.View style={{ opacity: fade }}>
              <FaceText segments={faces.answer} color={color} isDark={isDark} style={faceStyle} />
            </Animated.View>
          )}
        </TouchableOpacity>

        {faces.typeTarget !== null && !revealed && (
          <TextInput
            value={typed}
            onChangeText={onChangeTyped}
            onSubmitEditing={onReveal}
            placeholder="Type your answer"
            placeholderTextColor={theme.textTertiary}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Your answer"
            style={{
              marginTop: 22,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: Radius.lg,
              borderWidth: 1.5,
              borderColor: color + '66',
              backgroundColor: theme.inputBg,
              color: theme.text,
              fontFamily: 'Nunito_700Bold',
              fontSize: 16,
              textAlign: 'center',
            }}
          />
        )}

        {revealed && (
          <Animated.View
            style={{
              opacity: fade,
              transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            }}
          >
            {kind !== 'cloze' && (
              <>
                <View style={{ height: 1, backgroundColor: theme.cardBorder, marginVertical: 20, marginHorizontal: 12 }} />
                {diff ? (
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
                        backgroundColor: correct ? tints.attendance.fill : tints.danger.fill,
                      }}
                    >
                      <Ionicons name={correct ? 'checkmark-circle' : 'close-circle'} size={14} color={correct ? tints.attendance.ink : tints.danger.ink} />
                      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: correct ? tints.attendance.ink : tints.danger.ink }}>
                        {typed.trim() ? (correct ? 'Correct' : 'Not quite') : 'No answer typed'}
                      </Text>
                    </View>
                    {typed.trim() && !correct ? (
                      <>
                        {renderDiff(diff.typed)}
                        <Ionicons name="arrow-down" size={14} color={theme.textTertiary} />
                      </>
                    ) : null}
                    {correct || !typed.trim() ? (
                      <FaceText segments={faces.answer} color={color} isDark={isDark} style={faceStyle} />
                    ) : (
                      renderDiff(diff.expected)
                    )}
                  </View>
                ) : (
                  <FaceText segments={faces.answer} color={color} isDark={isDark} style={{ ...faceStyle, fontFamily: 'Nunito_700Bold', fontSize: 19, lineHeight: 28 }} />
                )}
              </>
            )}
            {faces.extra ? (
              <Text
                style={{
                  marginTop: 18,
                  fontFamily: 'Nunito_400Regular',
                  fontSize: 14,
                  lineHeight: 21,
                  color: theme.textSecondary,
                  textAlign: 'center',
                }}
              >
                {faces.extra}
              </Text>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>
      )}

      {!revealed && faces.typeTarget === null && kind !== 'occlusion' && (
        <Text style={{ textAlign: 'center', paddingBottom: 14, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
          Recall the answer, then tap to check
        </Text>
      )}
    </View>
  );
}
