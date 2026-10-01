export { gradeQuizAnswerLocally, normalizeQuizAnswer, fillBlankMatches, unwrapQuizChoice } from '@shared/quiz/quizGrade.js';
export {
  countFillBlanks,
  parseFillBlankParts,
  splitBlankAnswers,
  joinBlankAnswers,
  blanksAllFilled,
  splitCorrectAnswers,
} from '@shared/quiz/fillBlank.js';


export type LocalQuizGrade = {
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  user_answer: string;
};
