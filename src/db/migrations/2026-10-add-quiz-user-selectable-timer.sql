-- Allows quiz creators to choose a fixed time limit or let each learner choose one before starting.
ALTER TABLE quizzes ADD COLUMN time_limit_mode TEXT NOT NULL DEFAULT 'fixed';
