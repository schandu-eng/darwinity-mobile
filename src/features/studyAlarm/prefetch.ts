import { learningEndpoints } from '@/api/endpoints/studyHub';
import { cardDeckV2Service } from '@/services/cardDeckV2Service';
import {
  STUDY_ALARM_GOAL,
  isTextCard,
  type CachedCardItem,
  type CachedQuizItem,
  type StudyAlarmCache,
  type StudyAlarmMode,
} from './logic';
import { unwrapQuizChoice } from '@/study-hub/quizGrade';

function asQuizItem(
  id: number,
  question: Record<string, unknown> | null | undefined
): CachedQuizItem | null {
  if (!question) return null;
  const text = String(question.question || '').trim();
  const correct = unwrapQuizChoice(question.correct_answer).trim();
  if (!text || !correct) return null;
  const options = Array.isArray(question.options)
    ? question.options.map(unwrapQuizChoice).filter(Boolean)
    : [];
  return {
    id,
    question: text,
    question_type: String(question.question_type || 'multiple_choice'),
    options,
    correct_answer: correct,
    explanation: question.explanation == null ? null : String(question.explanation),
  };
}

async function prefetchQuiz(contentId: number, userId: number): Promise<CachedQuizItem[]> {
  const items: CachedQuizItem[] = [];
  const seen = new Set<string>();
  const push = (item: CachedQuizItem | null) => {
    if (!item || seen.has(item.question) || items.length >= STUDY_ALARM_GOAL) return;
    seen.add(item.question);
    items.push(item);
  };

  try {
    const starred = await learningEndpoints.listStarredQuizQuestions(contentId, userId);
    for (const row of starred.items || []) {
      push(asQuizItem(row.id, row.question as Record<string, unknown>));
    }
  } catch {
    /* optional */
  }

  if (items.length >= STUDY_ALARM_GOAL) return items.slice(0, STUDY_ALARM_GOAL);

  try {
    const sessions = await learningEndpoints.listQuizSessions(contentId, userId);
    for (const session of sessions.items) {
      if (items.length >= STUDY_ALARM_GOAL) break;
      try {
        const review = await learningEndpoints.reviewQuizSession(session.session_id, userId);
        for (const row of review.history || []) {
          push(asQuizItem(row.id, row.question as unknown as Record<string, unknown>));
        }
      } catch {
        /* try next set */
      }
    }
  } catch {
    /* optional */
  }

  return items.slice(0, STUDY_ALARM_GOAL);
}

async function prefetchCards(contentId: number, userId: number): Promise<CachedCardItem[]> {
  const result = await cardDeckV2Service.getDeck(contentId, userId, null);
  const flashcards = result.data?.flashcards || [];
  const items: CachedCardItem[] = [];
  for (const card of flashcards) {
    if (!isTextCard(card) || card.id == null) continue;
    items.push({ id: card.id, front: card.front, back: card.back });
    if (items.length >= STUDY_ALARM_GOAL) break;
  }
  return items;
}

export async function prefetchStudyAlarmItems(
  mode: StudyAlarmMode,
  contentId: number,
  userId: number
): Promise<StudyAlarmCache> {
  if (mode === 'quiz') {
    const quizzes = await prefetchQuiz(contentId, userId);
    if (quizzes.length < STUDY_ALARM_GOAL) {
      throw new Error(
        'This note needs at least 10 quiz questions. Finish a 10-question quiz on it first.'
      );
    }
    return { mode, contentId, quizzes, cards: [], savedAt: Date.now() };
  }
  const cards = await prefetchCards(contentId, userId);
  if (cards.length < STUDY_ALARM_GOAL) {
    throw new Error('This note needs at least 10 text flashcards before the alarm can use it.');
  }
  return { mode, contentId, quizzes: [], cards, savedAt: Date.now() };
}
