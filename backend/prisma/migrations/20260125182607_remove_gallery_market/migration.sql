-- Remove Gallery and Market system tables

-- Drop MarketListing table first (has foreign keys)
DROP TABLE IF EXISTS "MarketListing";

-- Drop ArtPackagePurchase table
DROP TABLE IF EXISTS "ArtPackagePurchase";

-- Drop UserGallery table
DROP TABLE IF EXISTS "UserGallery";

-- Drop PaintingCopy table (has foreign key to Painting)
DROP TABLE IF EXISTS "PaintingCopy";

-- Drop Painting table
DROP TABLE IF EXISTS "Painting";
