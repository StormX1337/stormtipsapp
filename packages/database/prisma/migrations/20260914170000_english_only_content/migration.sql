-- English becomes the only language the product ships.
--
-- Content was authored in German with an English override in `translations`.
-- This promotes each stored `en` override into the column it overrode, so the
-- base column now holds the English text, and then removes the column that
-- carried the second language.
--
-- An override that is absent or blank leaves the column untouched: a row that
-- was never translated keeps the text it has rather than turning blank.

-- ── text fields ──────────────────────────────────────────────────────────────
UPDATE "public"."products" SET
  "name"        = COALESCE(NULLIF("translations"->'en'->>'name', ''), "name"),
  "tagline"     = COALESCE(NULLIF("translations"->'en'->>'tagline', ''), "tagline"),
  "description" = COALESCE(NULLIF("translations"->'en'->>'description', ''), "description");

-- `benefits` is a text[], so the override is unpacked rather than cast.
UPDATE "public"."products" SET
  "benefits" = ARRAY(SELECT jsonb_array_elements_text("translations"->'en'->'benefits'))
WHERE jsonb_typeof("translations"->'en'->'benefits') = 'array'
  AND jsonb_array_length("translations"->'en'->'benefits') > 0;

UPDATE "public"."subscription_plans" SET
  "name"        = COALESCE(NULLIF("translations"->'en'->>'name', ''), "name"),
  "description" = COALESCE(NULLIF("translations"->'en'->>'description', ''), "description"),
  "highlight"   = COALESCE(NULLIF("translations"->'en'->>'highlight', ''), "highlight");

UPDATE "public"."fix_odds_plans" SET
  "name"        = COALESCE(NULLIF("translations"->'en'->>'name', ''), "name"),
  "description" = COALESCE(NULLIF("translations"->'en'->>'description', ''), "description");

UPDATE "public"."coupons" SET
  "description" = COALESCE(NULLIF("translations"->'en'->>'description', ''), "description");

UPDATE "public"."promotions" SET
  "title"    = COALESCE(NULLIF("translations"->'en'->>'title', ''), "title"),
  "subtitle" = COALESCE(NULLIF("translations"->'en'->>'subtitle', ''), "subtitle"),
  "body"     = COALESCE(NULLIF("translations"->'en'->>'body', ''), "body"),
  "ctaLabel" = COALESCE(NULLIF("translations"->'en'->>'ctaLabel', ''), "ctaLabel");

UPDATE "public"."polls" SET
  "question"    = COALESCE(NULLIF("translations"->'en'->>'question', ''), "question"),
  "description" = COALESCE(NULLIF("translations"->'en'->>'description', ''), "description");

UPDATE "public"."poll_options" SET
  "label" = COALESCE(NULLIF("translations"->'en'->>'label', ''), "label");

UPDATE "public"."markets" SET
  "name"        = COALESCE(NULLIF("translations"->'en'->>'name', ''), "name"),
  "description" = COALESCE(NULLIF("translations"->'en'->>'description', ''), "description");

UPDATE "public"."tips" SET
  "title"    = COALESCE(NULLIF("translations"->'en'->>'title', ''), "title"),
  "analysis" = COALESCE(NULLIF("translations"->'en'->>'analysis', ''), "analysis");

UPDATE "public"."combos" SET
  "title"    = COALESCE(NULLIF("translations"->'en'->>'title', ''), "title"),
  "subtitle" = COALESCE(NULLIF("translations"->'en'->>'subtitle', ''), "subtitle"),
  "analysis" = COALESCE(NULLIF("translations"->'en'->>'analysis', ''), "analysis");

-- ── the column that carried the second language ──────────────────────────────
ALTER TABLE "public"."products"           DROP COLUMN "translations";
ALTER TABLE "public"."subscription_plans" DROP COLUMN "translations";
ALTER TABLE "public"."fix_odds_plans"     DROP COLUMN "translations";
ALTER TABLE "public"."coupons"            DROP COLUMN "translations";
ALTER TABLE "public"."promotions"         DROP COLUMN "translations";
ALTER TABLE "public"."polls"              DROP COLUMN "translations";
ALTER TABLE "public"."poll_options"       DROP COLUMN "translations";
ALTER TABLE "public"."markets"            DROP COLUMN "translations";
ALTER TABLE "public"."tips"               DROP COLUMN "translations";
ALTER TABLE "public"."combos"             DROP COLUMN "translations";

-- Every account is English now; the column drives nothing else.
ALTER TABLE "public"."users" ALTER COLUMN "language" SET DEFAULT 'en';
UPDATE "public"."users" SET "language" = 'en';
