Auratracker – Gallery Feature Design Document
1. Feature Overview

The Gallery is a long-term progression and passive income system within Auratracker.
Players collect digital paintings of varying rarities, display them publicly on their profile, and earn daily money from NPC visitors based on the size and quality of their collection.

Paintings are introduced and managed by administrators and are obtained primarily through daily art packages or via a player-owned market.

2. Paintings & Rarities
2.1 Rarity Types

Paintings exist in three rarities, independent of the artwork itself (the same artwork can exist in different rarities):

Rarity	Copies Available	Visual Effect	Notes
Common	3 copies	Black & white filter	Always monochrome
Rare	2 copies	Full color	Standard presentation
Golden	1 copy	Golden color treatment	Unique + revenue multiplier

Golden paintings are unique.

Rarity is assigned at acquisition, not tied to the artwork.

There are no accessibility toggles for visual effects.

3. Art Packages (Daily Acquisition)
3.1 Package Structure

Every day, players have access to three art packages, all pulling from the same hidden rarity pool:

Package	Cost
Package I	$500
Package II	$1000
Package III	$1500

All packages contain exactly one painting

Rarity odds are hidden

Packages are identical in content; price scaling exists to:

Limit access for newer players

Allow wealthier players to acquire more paintings per day

Packages reset globally once per day

Duplicate paintings are allowed

4. Player Gallery & Storage
4.1 Gallery Rules

Each player gallery can display up to 20 paintings

All paintings placed in the gallery are publicly visible

The gallery is accessible directly from a player’s profile

Gallery should be customisable in color and position of paintings on the wall.

4.2 Warehouse

Players have a warehouse that stores all owned paintings

Paintings must be manually moved from the warehouse into the gallery

Only paintings in the gallery count toward NPC income

4.3 Painting Metadata

When hovering over a painting, the following is shown:

Artwork title

Artist

Description / lore

Rarity

Copy number (e.g., “2 of 3”)

5. NPC Visits & Revenue Generation
5.1 Daily Visits

Once per day, players can open their gallery to NPCs

NPCs visit only once per day

If the gallery is empty, no revenue is generated

5.2 Revenue Calculation

NPC income is calculated using:

Total number of paintings displayed

Rarity of each painting

Quantity vs variety

Golden paintings apply a multiplier to total income

There is:

No daily cap

No boosts or temporary modifiers

No streak bonuses

6. Player-Owned Market (REQUIRED SYSTEM)
6.1 Purpose

The Player-Owned Market is a core dependency of the gallery system and must be implemented.

Because:

Duplicate paintings are allowed

Painting copies are limited (3 / 2 / 1)

Players must have a way to trade, sell, and redistribute paintings

Without this system, the gallery economy cannot function properly.

6.2 Market Capabilities

Players must be able to:

Sell paintings to other players for money

Buy paintings listed by other players

Transfer ownership securely through the market

Admins do not set prices — the economy is fully player-driven.

6.3 Market Scope (Beyond Paintings)

The market is not limited to paintings.

Players can also sell:

Aura boosts

Name color changes

Other cosmetic or status items (future-proofed)

This makes the market a global trading hub, not a gallery-only feature.

6.4 Restrictions

No direct trading outside the market

No gifting

No system-controlled buybacks

No conversion of paintings into currency outside the market

7. Admin Controls & Content Management

Admins can:

Add paintings at any time

Vault paintings (remove from acquisition pools)

View analytics on:

Paintings in circulation

Ownership distribution

Rarity spread

Admins cannot:

Change rarity distribution after release

Reassign rarity to existing paintings

Force-remove paintings from players

8. Anti-Exploitation Rules

No alt-account protections tied to gallery income

No diminishing returns

No account-age scaling

Paintings can only change hands via the player-owned market

9. Tutorial & Player Education

A mandatory tutorial must explain:

Painting rarities and visuals

Gallery limits and warehouse usage

Daily NPC visits

Art packages and pricing logic

The importance of the player-owned market

Tooltips and hover explanations should reinforce this information in-game.

10. Non-Goals (Explicitly Excluded)

The Gallery system does not include:

Prestige or leveling

Collection bonuses

Social interactions (likes, comments, ratings)

Gallery customization

Events or seasonal mechanics

11. Summary

The Gallery is:

A passive, long-term income system

A controlled-scarcity collectible feature

Deeply dependent on a player-driven market economy

🚨 The Player-Owned Market is not optional — it is a foundational system required for:

Duplicate handling

Economic balance

Long-term player interaction