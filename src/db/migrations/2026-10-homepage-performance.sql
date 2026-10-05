-- Homepage / quiz / flashcard performance indexes.
CREATE INDEX IF NOT EXISTS idx_questions_quiz_sort ON questions(quiz_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_completed ON quiz_attempts(quiz_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_started ON quiz_attempts(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_set_sort ON flashcards(set_id, sort_order);
