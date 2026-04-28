-- ============================================================
-- OpenCode Client 数据库清空脚本
-- 功能：清空所有数据，保留表结构
-- 使用：sqlite3 opencode_client.db < clear_data.sql
-- ============================================================

-- 清空数据（保留表结构）
DELETE FROM device_chat_messages;
DELETE FROM device_sessions;
DELETE FROM device_connections;
DELETE FROM projects;

-- 重置自增 ID（可选，取消注释即可使用）
-- DELETE FROM sqlite_sequence WHERE name IN ('projects', 'device_connections', 'device_sessions', 'device_chat_messages');

-- 验证结果（可选）
-- SELECT 'projects count:', COUNT(*) FROM projects;
-- SELECT 'device_connections count:', COUNT(*) FROM device_connections;
-- SELECT 'device_sessions count:', COUNT(*) FROM device_sessions;
-- SELECT 'device_chat_messages count:', COUNT(*) FROM device_chat_messages;
