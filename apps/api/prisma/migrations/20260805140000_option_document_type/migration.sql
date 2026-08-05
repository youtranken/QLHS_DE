-- Document Type trở thành danh mục admin quản lý (chỉ THÊM mới, kèm luồng).
-- Thêm cột flow (chỉ dùng cho kind='documentType') + seed 6 loại hiện có để
-- catalog thành nguồn suy luồng (thay mapFlow hardcode). Hồ sơ cũ không đụng
-- (ticket.flow đã lưu sẵn).
ALTER TABLE "option_item" ADD COLUMN "flow" TEXT;

INSERT INTO "option_item" ("id","kind","value","flow","sort_order","active") VALUES
  (gen_random_uuid(),'documentType','General','General',1,true),
  (gen_random_uuid(),'documentType','Contract','Contract',2,true),
  (gen_random_uuid(),'documentType','VO','Contract',3,true),
  (gen_random_uuid(),'documentType','Annex','Contract',4,true),
  (gen_random_uuid(),'documentType','Budget','Contract',5,true),
  (gen_random_uuid(),'documentType','Payment','Payment',6,true)
ON CONFLICT ("kind","value") DO NOTHING;
