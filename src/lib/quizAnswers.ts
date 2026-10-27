import type { QuestionOption, QuestionType } from '@/types';

/**
 * Some legacy bulk-uploaded rows have `correct_answer` stored as a bare
 * option letter ("A"-"D", optionally with a trailing "." or ")") instead
 * of the actual option id ("option_1" etc). Those rows were imported
 * before the bulk-upload letter-mapping fix and live in D1 as-is - we
 * deliberately do NOT rewrite them there, since old quiz_attempts rows
 * already reference the original option ids and rewriting stored data
 * retroactively risks breaking other things that read it as-is.
 *
 * Instead we resolve the effective correct answer at grading/display
 * time: if `correctAnswer` already matches an option id, use it as-is;
 * if it looks like a bare letter, map it positionally (A=1st option,
 * B=2nd, etc); otherwise fall back to matching against option text.
 */
export function resolveEffectiveCorrectAnswer(
  correctAnswer: string,
  options: QuestionOption[] | null | undefined
): string {
  const raw = (correctAnswer ?? '').trim();
  if (!options || options.length === 0) return raw;

  // Already a valid option id - nothing to resolve.
  if (options.some((o) => o.id === raw)) return raw;

  // Bare letter form: "A", "b", "C.", "d)" etc.
  const letterMatch = raw.match(/^([A-Za-z])[.)]?$/);
  if (letterMatch) {
    const index = letterMatch[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    if (index >= 0 && index < options.length) {
      return options[index].id;
    }
  }

  // Fall back to exact option-text match (case-insensitive).
  const textMatch = options.find(
    (o) => o.text.trim().toLowerCase() === raw.toLowerCase()
  );
  if (textMatch) return textMatch.id;

  // Nothing resolvable - return as-is
  return raw;
}

/** Parses stringified JSON array or comma-separated tokens safely. */
export function parseArrayAnswer(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter split
    }
  }
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parses stringified JSON object safely. */
export function parseObjectAnswer(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (v !== undefined && v !== null) {
            result[k] = String(v).trim().toLowerCase();
          }
        }
        return result;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export interface QuestionGrading {
  isCorrect: boolean;
  marksEarned: number;
  totalMarks: number;
  effectiveCorrectAnswer: string;
}

/**
 * Universal grader for both standard questions (MCQ, True/False, Fill blank)
 * and modern clinical Next-Gen question types (SATA, Ordering, Matrix, Highlight).
 */
export function gradeQuestionAnswer(
  question: {
    id?: string;
    type?: QuestionType;
    correctAnswer: string;
    options?: QuestionOption[] | null;
    mark?: number | null;
  },
  submittedAnswer: string | null | undefined,
  defaultMark = 1
): QuestionGrading {
  const mark = question.mark ?? defaultMark;
  const type = question.type ?? 'mcq';

  // 1. SELECT ALL THAT APPLY (SATA)
  if (type === 'sata') {
    const correctIds = parseArrayAnswer(question.correctAnswer);
    const submittedIds = parseArrayAnswer(submittedAnswer);

    if (correctIds.length === 0) {
      return {
        isCorrect: false,
        marksEarned: 0,
        totalMarks: mark,
        effectiveCorrectAnswer: question.correctAnswer,
      };
    }

    const correctSet = new Set(correctIds);
    const submittedSet = new Set(submittedIds);

    let hits = 0;
    let falsePositives = 0;

    for (const id of submittedSet) {
      if (correctSet.has(id)) {
        hits++;
      } else {
        falsePositives++;
      }
    }

    // NCLEX standard scoring rule: hits minus false positives, bounded at 0
    const netPoints = Math.max(0, hits - falsePositives);
    const isExact =
      correctIds.length === submittedIds.length &&
      falsePositives === 0 &&
      hits === correctIds.length;

    const marksEarned = isExact
      ? mark
      : Math.round((netPoints / correctIds.length) * mark * 10) / 10;

    return {
      isCorrect: isExact || marksEarned >= mark,
      marksEarned,
      totalMarks: mark,
      effectiveCorrectAnswer: JSON.stringify(correctIds),
    };
  }

  // 2. CLINICAL DRAG & DROP / ORDERING
  if (type === 'ordering') {
    const correctIds = parseArrayAnswer(question.correctAnswer);
    const submittedIds = parseArrayAnswer(submittedAnswer);

    if (correctIds.length === 0 || submittedIds.length === 0) {
      return {
        isCorrect: false,
        marksEarned: 0,
        totalMarks: mark,
        effectiveCorrectAnswer: question.correctAnswer,
      };
    }

    const isExact =
      correctIds.length === submittedIds.length &&
      correctIds.every((id, idx) => id === submittedIds[idx]);

    // Partial credit: proportion of items in the exact correct sequence position
    let inPositionCount = 0;
    const compareLength = Math.min(correctIds.length, submittedIds.length);
    for (let i = 0; i < compareLength; i++) {
      if (correctIds[i] === submittedIds[i]) {
        inPositionCount++;
      }
    }

    const marksEarned = isExact
      ? mark
      : Math.round((inPositionCount / correctIds.length) * mark * 10) / 10;

    return {
      isCorrect: isExact || marksEarned >= mark,
      marksEarned,
      totalMarks: mark,
      effectiveCorrectAnswer: JSON.stringify(correctIds),
    };
  }

  // 3. CLINICAL MATRIX / GRID
  if (type === 'matrix') {
    const correctMap = parseObjectAnswer(question.correctAnswer);
    const submittedMap = parseObjectAnswer(submittedAnswer);
    const rowKeys = Object.keys(correctMap);

    if (rowKeys.length === 0) {
      return {
        isCorrect: false,
        marksEarned: 0,
        totalMarks: mark,
        effectiveCorrectAnswer: question.correctAnswer,
      };
    }

    let correctRows = 0;
    for (const key of rowKeys) {
      if (submittedMap[key] && submittedMap[key] === correctMap[key]) {
        correctRows++;
      }
    }

    const isExact = correctRows === rowKeys.length;
    const marksEarned = isExact
      ? mark
      : Math.round((correctRows / rowKeys.length) * mark * 10) / 10;

    return {
      isCorrect: isExact || marksEarned >= mark,
      marksEarned,
      totalMarks: mark,
      effectiveCorrectAnswer: JSON.stringify(correctMap),
    };
  }

  // 4. HIGHLIGHTING CLINICAL RED FLAGS
  if (type === 'highlight') {
    const correctIds = parseArrayAnswer(question.correctAnswer);
    const submittedIds = parseArrayAnswer(submittedAnswer);

    if (correctIds.length === 0) {
      return {
        isCorrect: false,
        marksEarned: 0,
        totalMarks: mark,
        effectiveCorrectAnswer: question.correctAnswer,
      };
    }

    const correctSet = new Set(correctIds);
    const submittedSet = new Set(submittedIds);

    let hits = 0;
    let falseAlarms = 0;

    for (const id of submittedSet) {
      if (correctSet.has(id)) {
        hits++;
      } else {
        falseAlarms++;
      }
    }

    const netPoints = Math.max(0, hits - falseAlarms);
    const isExact =
      correctIds.length === submittedIds.length &&
      falseAlarms === 0 &&
      hits === correctIds.length;

    const marksEarned = isExact
      ? mark
      : Math.round((netPoints / correctIds.length) * mark * 10) / 10;

    return {
      isCorrect: isExact || marksEarned >= mark,
      marksEarned,
      totalMarks: mark,
      effectiveCorrectAnswer: JSON.stringify(correctIds),
    };
  }

  // 5. STANDARD TYPES: MCQ, TRUE/FALSE, FILL IN THE BLANK
  const effectiveCorrectAnswer = resolveEffectiveCorrectAnswer(question.correctAnswer, question.options);
  const isCorrect =
    submittedAnswer !== null &&
    submittedAnswer !== undefined &&
    submittedAnswer.trim().toLowerCase() === effectiveCorrectAnswer.trim().toLowerCase();

  return {
    isCorrect,
    marksEarned: isCorrect ? mark : 0,
    totalMarks: mark,
    effectiveCorrectAnswer,
  };
}

/** Formats answers for user-facing review screens without raw JSON strings. */
export function formatAnswerDisplay(
  type: QuestionType | undefined,
  rawValue: string | null | undefined,
  options: QuestionOption[] | null | undefined
): string {
  if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
    return 'Not answered';
  }

  const optMap = new Map((options ?? []).map((o, idx) => [o.id, { text: o.text, letter: String.fromCharCode(65 + idx) }]));

  if (type === 'sata') {
    const ids = parseArrayAnswer(rawValue);
    if (ids.length === 0) return 'None selected';
    return ids
      .map((id) => {
        const found = optMap.get(id);
        return found ? `${found.letter}: ${found.text}` : id;
      })
      .join(', ');
  }

  if (type === 'ordering') {
    const ids = parseArrayAnswer(rawValue);
    if (ids.length === 0) return 'No sequence specified';
    return ids
      .map((id, index) => {
        const found = optMap.get(id);
        return `${index + 1}. ${found ? found.text : id}`;
      })
      .join(' -> ');
  }

  if (type === 'matrix') {
    const map = parseObjectAnswer(rawValue);
    const entries = Object.entries(map);
    if (entries.length === 0) return 'No selections made';
    return entries
      .map(([rowId, col]) => {
        const found = optMap.get(rowId);
        const colLabel =
          col === 'indicated'
            ? 'Indicated'
            : col === 'contraindicated'
            ? 'Contraindicated'
            : 'Not Related';
        return `${found ? found.text : rowId}: ${colLabel}`;
      })
      .join(' | ');
  }

  if (type === 'highlight') {
    const ids = parseArrayAnswer(rawValue);
    if (ids.length === 0) return 'No findings highlighted';
    return ids
      .map((id) => {
        const found = optMap.get(id);
        return found ? found.text : id;
      })
      .join(', ');
  }

  // MCQ / True False / Fill Blank
  const match = (options ?? []).find((o) => o.id === rawValue);
  return match ? match.text : rawValue;
}
