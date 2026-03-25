-- Migration: Add optionsConfig to polymarket tables
-- Safe to run on production: both columns are nullable, zero data loss

ALTER TABLE "PolymarketSuggestion" ADD COLUMN "optionsConfig" TEXT;
ALTER TABLE "PolymarketEvent" ADD COLUMN "optionsConfig" TEXT;
