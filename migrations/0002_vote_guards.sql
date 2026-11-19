-- 并发与数据完整性保护

-- 有人在某选项上投过票时，不允许删除该选项。
-- 这样管理员在“确认无人投票”后、真正写入修改前的极小窗口内
-- 即使有票进来，修改也会整体回滚，而不是留下孤儿票。
CREATE TRIGGER prevent_option_delete_with_votes
BEFORE DELETE ON options
WHEN EXISTS (SELECT 1 FROM votes WHERE option_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'option_has_votes');
END;

-- 截止后再写入的票直接拒绝，覆盖应用层检查之后的竞争窗口。
CREATE TRIGGER prevent_vote_when_closed
BEFORE INSERT ON votes
WHEN EXISTS (
  SELECT 1
  FROM polls
  WHERE id = NEW.poll_id
    AND (
      closed_at IS NOT NULL
      OR (deadline_at IS NOT NULL AND deadline_at <= NEW.created_at)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'poll_closed');
END;

-- 保证票只会落在同一场投票的选项上。
CREATE TRIGGER verify_vote_option_poll
BEFORE INSERT ON votes
WHEN NOT EXISTS (
  SELECT 1
  FROM options
  WHERE id = NEW.option_id AND poll_id = NEW.poll_id
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_option');
END;
