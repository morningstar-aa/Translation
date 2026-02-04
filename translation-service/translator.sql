/*
 Navicat Premium Dump SQL

 Source Server         : 测试-3
 Source Server Type    : MySQL
 Source Server Version : 50744 (5.7.44-log)
 Source Host           : 203.91.72.194:3306
 Source Schema         : translator

 Target Server Type    : MySQL
 Target Server Version : 50744 (5.7.44-log)
 File Encoding         : 65001

 Date: 30/01/2026 15:05:06
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for activation_codes
-- ----------------------------
DROP TABLE IF EXISTS `activation_codes`;
CREATE TABLE `activation_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(64) NOT NULL COMMENT '激活码字符串',
  `days` int(11) DEFAULT '30' COMMENT '授权有效天数',
  `is_used` tinyint(1) DEFAULT '0' COMMENT '是否已激活 (0:否, 1:是)',
  `used_by` bigint(20) DEFAULT NULL COMMENT '绑定的 Telegram 用户 ID',
  `used_at` datetime DEFAULT NULL COMMENT '用户激活的具体时间',
  `expire_at` datetime DEFAULT NULL COMMENT '授权到期时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '后台生成激活码的时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COMMENT='激活码授权管理表';

-- ----------------------------
-- Records of activation_codes
-- ----------------------------
BEGIN;
INSERT INTO `activation_codes` (`id`, `code`, `days`, `is_used`, `used_by`, `used_at`, `expire_at`, `created_at`) VALUES (1, 'BB41C9796CBD40AA', 365, 1, 7430224386, '2026-01-30 10:14:06', '2027-01-30 10:14:06', '2026-01-30 09:05:21');
COMMIT;

-- ----------------------------
-- Table structure for admins
-- ----------------------------
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL COMMENT '管理员的 Telegram ID',
  `added_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员名单';

-- ----------------------------
-- Records of admins
-- ----------------------------
BEGIN;
COMMIT;

-- ----------------------------
-- Table structure for user_chat_settings
-- ----------------------------
DROP TABLE IF EXISTS `user_chat_settings`;
CREATE TABLE `user_chat_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL COMMENT '所属用户 ID',
  `chat_id` bigint(20) NOT NULL COMMENT '会话 ID',
  `is_enabled` tinyint(1) DEFAULT '1' COMMENT '该会话是否开启翻译 (0:关, 1:开)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_chat_idx` (`user_id`,`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户聊天室翻译设置';

-- ----------------------------
-- Records of user_chat_settings
-- ----------------------------
BEGIN;
COMMIT;

SET FOREIGN_KEY_CHECKS = 1;
