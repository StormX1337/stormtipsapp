-- AlterTable
ALTER TABLE "public"."combos" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."fix_odds_plans" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."poll_options" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."polls" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."promotions" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."subscription_plans" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."tips" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';
