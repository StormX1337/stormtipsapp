-- AlterTable
ALTER TABLE "public"."coupons" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';
