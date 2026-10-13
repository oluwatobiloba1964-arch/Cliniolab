#!/usr/bin/env node
// Backfill script - run ONCE after applying
// src/db/migrations/2026-10-add-dedup-normalization.sql
//
// That migration adds normalized_title (quizzes), and subcategory_id +
// normalized_prompt (questions), but can't fill them in for rows that
// already existed - the normalization (lowercasing, stripping accents and
// punctuation, collapsing whitespace - see src/lib/utils/normalizeText.ts)
// isn't something plain SQL can reproduce. This script reads existing rows
// through `wrangler d1 execute --json`, computes the same normalization in
// Node, and writes the UPDATEs to a .sql file you then run the same way
// you already run migrations - no new credentials or API access needed.
//
// Usage:
//   node scripts/backfill-dedup-normalization.mjs
//   npx wrangler d1 execute cliniolab --remote --file=./scripts/backfill-output/quizzes.sql
//   npx wrangler d1 execute cliniolab --remote --file=./scripts/backfill-output/questions.sql
//
// Safe to re-run: every statement is an UPDATE keyed by id, so running it
// again just recomputes the same values.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// Keep this in sync with src/lib/utils/normalizeText.ts - copied here
// because this script runs standalone, outside the Next.js/TS build.
function normalizeForDedup(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runD1Query(sql) {
  const out = execSync(
    `npx wrangler d1 execute cliniolab --remote --json --command ${JSON.stringify(sql)}`,
    { maxBuffer: 1024 * 1024 * 256 }
  ).toString();
  const parsed = JSON.parse(out);
  // wrangler --json returns an array of { results, success, ... }
  return parsed[0]?.results ?? [];
}

mkdirSync('scripts/backfill-output', { recursive: true });

console.log('Reading quizzes...');
const quizzes = runD1Query('SELECT id, title FROM quizzes');
const quizStatements = quizzes.map(
  (q) =>
    `UPDATE quizzes SET normalized_title = ${sqlQuote(normalizeForDedup(q.title))} WHERE id = ${sqlQuote(q.id)};`
);
writeFileSync('scripts/backfill-output/quizzes.sql', quizStatements.join('\n') + '\n');
console.log(`Wrote ${quizStatements.length} quiz updates to scripts/backfill-output/quizzes.sql`);

console.log('Reading questions...');
const questions = runD1Query(
  `SELECT q.id AS id, q.prompt AS prompt, qz.subcategory_id AS subcategory_id
   FROM questions q JOIN quizzes qz ON qz.id = q.quiz_id`
);
const questionStatements = questions.map(
  (q) =>
    `UPDATE questions SET subcategory_id = ${sqlQuote(q.subcategory_id)}, normalized_prompt = ${sqlQuote(normalizeForDedup(q.prompt))} WHERE id = ${sqlQuote(q.id)};`
);
writeFileSync('scripts/backfill-output/questions.sql', questionStatements.join('\n') + '\n');
console.log(`Wrote ${questionStatements.length} question updates to scripts/backfill-output/questions.sql`);

console.log('\nNow run:');
console.log('  npx wrangler d1 execute cliniolab --remote --file=./scripts/backfill-output/quizzes.sql');
console.log('  npx wrangler d1 execute cliniolab --remote --file=./scripts/backfill-output/questions.sql');
