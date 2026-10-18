// src/lib/db/services/quizService.ts
//
// Thin facade. The implementation lives in ./quiz/* — this file only
// re-exports, so every existing `import { quizService } from '@/lib/db'`
// keeps working with zero call-site changes.

export {
  createQuiz,
  updateQuiz,
  addQuestionsToQuiz,
  getQuizById,
  getQuizByShareSlug,
  deleteQuiz,
} from './quiz/quizCrudService';

export {
  bulkCreateQuizzes,
  findBulkQuizDuplicates,
  type BulkQuizDuplicateReport,
} from './quiz/quizBulkService';

export {
  hashPassword,
  verifyPassword,
  computeExpiryDate,
  regenerateShareLink,
  setQuizVisibility,
  setQuizPassword,
  checkQuizPassword,
  updateQuizStatus,
} from './quiz/quizPasswordService';

export {
  getQuizQuestions,
  listLatestPublicQuizzes,
  listLatestPublicQuizzesPaginated,
  getQuizzesWithStatsByIds,
  listQuizzesByCategories,
  listQuizzesByCategory,
  listQuizzesByCategoryPaginated,
  listQuizzesBySubcategory,
  listQuizzesBySubcategoryPaginated,
  listQuizzesByCreator,
  listPublicQuizzesByCreator,
  adminListAllQuizzes,
} from './quiz/quizQueryService';

export {
  listRelatedQuizzes,
  listRelatedQuizzesByLabel,
} from './quiz/quizRelatedService';
