SET foreign_key_checks = 0;
SET NAMES utf8mb4;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

CREATE DATABASE `orbitar_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `orbitar_db`;

CREATE USER 'orbitar'@'%' IDENTIFIED BY 'orbitar';
GRANT SELECT, INSERT, UPDATE, DELETE ON orbitar_db.* TO 'orbitar'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_db.* TO 'orbitar'@'%'; -- activity_db does not exist in the original schema, but added in migrations
FLUSH PRIVILEGES;

DROP TABLE IF EXISTS `comment_votes`;
CREATE TABLE `comment_votes` (
  `vote_id` int NOT NULL AUTO_INCREMENT,
  `comment_id` int NOT NULL,
  `voter_id` int NOT NULL,
  `vote` tinyint NOT NULL,
  `voted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vote_id`),
  KEY `comment_id` (`comment_id`),
  KEY `voter_id_comment_id` (`voter_id`,`comment_id`),
  CONSTRAINT `comment_votes_ibfk_2` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`comment_id`),
  CONSTRAINT `comment_votes_ibfk_4` FOREIGN KEY (`voter_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `parent_comment_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `author_id` int NOT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `source` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `rating` int NOT NULL DEFAULT '0',
  `site_id` int NOT NULL,
  PRIMARY KEY (`comment_id`),
  KEY `comments_sort` (`parent_comment_id`,`comment_id`),
  KEY `post_id` (`post_id`),
  KEY `author_id` (`author_id`),
  KEY `site_id` (`site_id`),
  CONSTRAINT `comments_ibfk_4` FOREIGN KEY (`parent_comment_id`) REFERENCES `comments` (`comment_id`),
  CONSTRAINT `comments_ibfk_7` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `comments_ibfk_8` FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `comments_ibfk_9` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `invites`;
CREATE TABLE `invites` (
  `invite_id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `issued_by` int NOT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `issued_count` int NOT NULL DEFAULT '1',
  `left_count` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`invite_id`),
  UNIQUE KEY `code` (`code`),
  KEY `issued_by` (`issued_by`),
  CONSTRAINT `invites_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `invites` (`invite_id`, `code`, `issued_by`, `issued_count`, `left_count`) VALUES
(1, 'initial',	0,	0,	1);

DROP TABLE IF EXISTS `post_votes`;
CREATE TABLE `post_votes` (
  `vote_id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `voter_id` int NOT NULL,
  `vote` tinyint NOT NULL,
  `voted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vote_id`),
  KEY `post_id` (`post_id`),
  KEY `voter_id_post_id` (`voter_id`,`post_id`),
  CONSTRAINT `post_votes_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`),
  CONSTRAINT `post_votes_ibfk_4` FOREIGN KEY (`voter_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `post_id` int NOT NULL AUTO_INCREMENT,
  `site_id` int NOT NULL,
  `author_id` int NOT NULL,
  `rating` int NOT NULL DEFAULT '0',
  `title` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `source` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `commented_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `comments` int NOT NULL DEFAULT '0',
  `last_comment_id` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`post_id`),
  KEY `author_id` (`author_id`),
  KEY `sort_by_comment` (`site_id`,`commented_at` DESC),
  CONSTRAINT `posts_ibfk_4` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `posts_ibfk_5` FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `sites`;
CREATE TABLE `sites` (
  `site_id` int NOT NULL AUTO_INCREMENT,
  `subdomain` varchar(32) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `name` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `owner_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`site_id`),
  UNIQUE KEY `subdomain` (`subdomain`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `sites_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `sites` (`site_id`, `subdomain`, `name`, `owner_id`) VALUES
(1,	'main',	'Главная',	0),
(2,	'idiod',	'idiod',	0);

DROP TABLE IF EXISTS `user_bookmarks`;
CREATE TABLE `user_bookmarks` (
  `bookmark_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `post_id` int NOT NULL,
  `last_comment_id` int NOT NULL DEFAULT '0',
  `bookmark` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`bookmark_id`),
  KEY `user_id` (`user_id`),
  KEY `post_id` (`post_id`),
  CONSTRAINT `user_bookmarks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_bookmarks_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `user_invites`;
CREATE TABLE `user_invites` (
  `parent_id` int NOT NULL,
  `child_id` int NOT NULL,
  `invited` datetime NOT NULL,
  `invite_id` int NOT NULL,
  KEY `parent_id` (`parent_id`),
  KEY `invite_id` (`invite_id`),
  KEY `child_id` (`child_id`),
  CONSTRAINT `user_invites_ibfk_4` FOREIGN KEY (`parent_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_invites_ibfk_6` FOREIGN KEY (`invite_id`) REFERENCES `invites` (`invite_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `user_invites_ibfk_7` FOREIGN KEY (`child_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `user_karma`;
CREATE TABLE `user_karma` (
  `vote_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `voter_id` int NOT NULL,
  `vote` tinyint NOT NULL,
  `voted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vote_id`),
  KEY `user_id` (`user_id`),
  KEY `voter_id` (`voter_id`),
  CONSTRAINT `user_karma_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_karma_ibfk_4` FOREIGN KEY (`voter_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `email` varchar(128) CHARACTER SET latin1 COLLATE latin1_general_ci NOT NULL,
  `twofactor` varchar(64) CHARACTER SET latin1 COLLATE latin1_general_ci DEFAULT NULL,
  `gender` tinyint NOT NULL DEFAULT '0',
  `karma` int NOT NULL DEFAULT '0',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` (`user_id`, `username`, `password`, `email`, `twofactor`, `gender`, `karma`, `name`) VALUES
(0,	'orbitar',	'',	'',	NULL,	0,	0,	'Orbitar');
