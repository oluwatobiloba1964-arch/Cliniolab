import { resolveEffectiveCorrectAnswer } from '@/lib/quizAnswers';
import type { AttemptResult, Quiz, QuizQuestion } from '@/types';

/**
 * Same grading rules as the server (attemptService.gradeWithoutSaving),
 * done entirely on-device for an offline-saved quiz. correctAnswer is
 * available here because offline payloads embed the full question set.
 */
export function gradeOfflineAttempt(
  quiz: Quiz,
  allQuestions: QuizQuestion[],
  submission: {
    questionIds: string[];
    answers: { questionId: string; submittedAnswer: string | null }[];
    timeTakenSeconds: number;
  }
): AttemptResult {
  const questions = allQuestions.filter((q) => submission.questionIds.includes(q.id));
  const answerMap = new Map(submission.answers.map((a) => [a.questionId, a.submittedAnswer]));

  let marksEarned = 0;
  let totalMarks = 0;
  const perQuestion = questions.map((q) => {
    const submittedAnswer = answerMap.get(q.id) ?? null;
    const effectiveCorrectAnswer = resolveEffectiveCorrectAnswer(q.correctAnswer, q.options);
    const isCorrect =
      submittedAnswer !== null && submittedAnswer.trim().toLowerCase() === effectiveCorrectAnswer.trim().toLowerCase();
    const mark = q.mark ?? quiz.defaultMark;
    totalMarks += mark;
    if (isCorrect) marksEarned += mark;
    return {
      questionId: q.id,
      prompt: q.prompt,
      submittedAnswer,
      correctAnswer: effectiveCorrectAnswer,
      isCorrect,
      explanation: q.explanation,
      incorrectRationale: q.incorrectRationale ?? null,
      options: q.options ?? [],
      mark,
    };
  });

  return {
    attemptId: `offline-${Date.now()}`,
    score: marksEarned,
    totalQuestions: questions.length,
    marksEarned,
    totalMarks,
    showMarks: quiz.showMarks,
    percentage: totalMarks > 0 ? (marksEarned / totalMarks) * 100 : 0,
    countedForLeaderboard: false,
    perQuestion,
  };
}
