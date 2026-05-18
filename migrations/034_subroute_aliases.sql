-- subroute_aliases — maps 配送區域 (driver-typed delivery area, e.g. 永和)
-- to 計價區域 / billing_area (e.g. 雙北) which lines up with the
-- vendor_rate_rules.destination_area column. Used by the LINE quick text
-- trip parser: token like 「冷鏈永和10」 lookups 永和 → 雙北 → finds the
-- 冷鏈 rate rule whose destination_area = 雙北.
--
-- alias is the unique key; billing_area is the canonical area name.

CREATE TABLE IF NOT EXISTS public.subroute_aliases (
  alias        text PRIMARY KEY,
  billing_area text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subroute_aliases_billing_area_idx
  ON public.subroute_aliases (billing_area);

-- Seed from 配送區域對照表.csv (provided 2026-05-18)
INSERT INTO public.subroute_aliases (alias, billing_area) VALUES
  ('基隆','基隆'),('七堵','基隆'),
  ('中正','雙北'),('大同','雙北'),('中山','雙北'),('松山','雙北'),('大安','雙北'),
  ('萬華','雙北'),('信義','雙北'),('士林','雙北'),('北投','雙北'),('內湖','雙北'),
  ('南港','雙北'),('文山','雙北'),('萬里','雙北'),('金山','雙北'),('板橋','雙北'),
  ('汐止','雙北'),('深坑','雙北'),('瑞芳','雙北'),('貢寮','雙北'),('新店','雙北'),
  ('永和','雙北'),('中和','雙北'),('土城','雙北'),('三峽','雙北'),('樹林','雙北'),
  ('鶯歌','雙北'),('三重','雙北'),('新莊','雙北'),('泰山','雙北'),('林口','雙北'),
  ('蘆洲','雙北'),('五股','雙北'),('八里','雙北'),
  ('淡水','淡水/三芝'),('三芝','淡水/三芝'),
  ('宜蘭','宜蘭-北'),('頭城','宜蘭-北'),('礁溪','宜蘭-北'),('三星','宜蘭-北'),
  ('蘇澳','宜蘭-南'),
  ('桃園','桃園-北'),('龜山','桃園-北'),('蘆竹','桃園-北'),
  ('中壢','桃園-南'),('平鎮','桃園-南'),('龍潭','桃園-南'),('楊梅','桃園-南'),
  ('新屋','桃園-南'),('觀音','桃園-南'),('八德','桃園-南'),('大溪','桃園-南'),
  ('大園','桃園-南')
ON CONFLICT (alias) DO UPDATE SET
  billing_area = EXCLUDED.billing_area,
  updated_at   = now();
