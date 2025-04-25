USE orbitar_db;

DELETE FROM user_invites WHERE child_id IN (SELECT user_id FROM users WHERE username LIKE 'testuser%');
DELETE FROM invites WHERE code LIKE 'invite-testuser%';
DELETE FROM users WHERE username LIKE 'testuser%';

INSERT INTO users (username, password, email, gender, karma, name, registered_at)
VALUES 
  ('testuser1', '$2a$10$otySLU3y9XONpFnPqX.OfeNZrCeq4Ld.zC1RCXPCS4YAEGAlYEstO', 'test1@example.com', 0, 0, 'Test User 1', CURRENT_TIMESTAMP),
  ('testuser2', '$2a$10$K16MyMHXgXY0wtn87bp0VuC31w5sJyjekaeW75hMyinWITbT6ICBO', 'test2@example.com', 0, 0, 'Test User 2', CURRENT_TIMESTAMP),
  ('testuser3', '$2a$10$aFoEqmuFgApaO8hen3G9I.7YxJrPxkoYr6D0ElT2NlhZRHUB8SWJu', 'test3@example.com', 0, 0, 'Test User 3', CURRENT_TIMESTAMP);

INSERT INTO invites (code, issued_by, issued_at, issued_count, left_count)
SELECT 
  CONCAT('invite-', username),
  user_id,
  CURRENT_TIMESTAMP,
  1,
  1
FROM users 
WHERE username LIKE 'testuser%';

INSERT INTO user_invites (parent_id, child_id, invited, invite_id)
SELECT 
  0,
  u.user_id,
  CURRENT_TIMESTAMP,
  i.invite_id
FROM users u
JOIN invites i ON i.issued_by = u.user_id
WHERE u.username LIKE 'testuser%'; 