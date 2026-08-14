-- Hai khả năng độc lập cho documentType luồng Contract, admin bật/tắt ở bảng
-- ma trận: requires_contract_no (popup bắt buộc nhập Contract No ở ga Received by
-- DCC2) + allow_skip (hiện checkbox "Skip to Completed"). Loại không bật cờ nào →
-- gửi thẳng Accounting, contract_no giữ 'N/A'. Cộng-cột, không đụng dữ liệu cũ.
ALTER TABLE "option_item"
  ADD COLUMN "requires_contract_no" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allow_skip" BOOLEAN NOT NULL DEFAULT false;

-- Seed CHỈ built-in chắc chắn tên: Contract cần Contract No, Budget cho Skip.
-- Các loại admin thêm (Contract Liquidation, Application form…) do admin tự tick
-- trong bảng ma trận sau khi deploy (tên có thể lệch, không seed mù).
UPDATE "option_item" SET "requires_contract_no" = true
  WHERE "kind" = 'documentType' AND "flow" = 'Contract' AND "value" = 'Contract';
UPDATE "option_item" SET "allow_skip" = true
  WHERE "kind" = 'documentType' AND "flow" = 'Contract' AND "value" = 'Budget';
