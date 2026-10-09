-- Sitewide controls for browser-only learning tools. No tables or columns are added.
INSERT OR IGNORE INTO feature_flags (key, enabled, label) VALUES
('smart_revision_queue', 1, 'Learning Tools: Smart Revision Queue'),
('article_study_mode', 1, 'Learning Tools: Article Study Mode'),
('topic_knowledge_maps', 1, 'Learning Tools: Topic Knowledge Maps');
