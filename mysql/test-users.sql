-- Удаляем существующих тестовых пользователей
DELETE FROM user_invites WHERE child_id IN (SELECT user_id FROM users WHERE username LIKE 'testuser%');
DELETE FROM invites WHERE code LIKE 'invite-testuser%';
DELETE FROM users WHERE username LIKE 'testuser%';

-- Создаем тестовых пользователей
INSERT INTO users (username, password, email, gender, karma, name, registered_at)
VALUES 
  ('testuser1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'test1@example.com', 0, 0, 'Test User 1', CURRENT_TIMESTAMP),
  ('testuser2', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'test2@example.com', 0, 0, 'Test User 2', CURRENT_TIMESTAMP),
  ('testuser3', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'test3@example.com', 0, 0, 'Test User 3', CURRENT_TIMESTAMP);

-- Создаем инвайты для тестовых пользователей
INSERT INTO invites (code, issued_by, issued_at, issued_count, left_count)
SELECT 
  CONCAT('invite-', username),
  user_id,
  CURRENT_TIMESTAMP,
  1,
  1
FROM users 
WHERE username LIKE 'testuser%';

-- Добавляем записи в user_invites
INSERT INTO user_invites (parent_id, child_id, invited, invite_id)
SELECT 
  0,
  u.user_id,
  CURRENT_TIMESTAMP,
  i.invite_id
FROM users u
JOIN invites i ON i.issued_by = u.user_id
WHERE u.username LIKE 'testuser%'; 