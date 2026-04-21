# Aura Tracker Complete Mechanics Reference

Version date: 2026-04-20  
Scope: gameplay systems, economy, progression, social mechanics, moderation, administration, and automation.  
Out of scope: visual style and UI design choices.

This document describes the game as implemented in backend routes, services, sockets, utilities, and Prisma models.

## 1. Game Identity And Core Loop

Aura Tracker is a private multiplayer social gaming platform that combines:
- Arcade and board/card games
- Real-time chat and social systems
- A shared economy (money + aura + market assets)
- Daily progression (quests, pass, streaks, caps)
- Clan competition and wars
- A full life-sim/business simulation (You mode)
- Moderation/legal systems (bans, support, justice)

High-level player loop:
1. Create account and get approved.
2. Play games to earn money and aura.
3. Use economy systems: shop, items, listings, transfers, trading.
4. Progress through quests, streaks, and badges.
5. Engage in social structures: parties, clans, messages, profile systems.
6. Expand into advanced systems: AuraCoin/Polymarket, You mode businesses, legal/court interactions.

## 2. Access, Identity, And Account Lifecycle

### 2.1 Registration And Login
- Account fields include username, email, passwordHash, optional school/class metadata, and optional motivation message.
- Accounts can require admin approval before normal login (isApproved).
- Admin/superadmin/beta/fiscal/judge flags gate access and powers.

### 2.2 Approval Flow
- Registration review records are stored with reviewer and status metadata.
- Motivation messages are preserved for approval decisions.

### 2.3 Referral System
- Each user can have a unique referral code.
- Referral attribution is stored (referredById, referredAt).
- Reward issuance is configurable by setting (referral_reward_amount) and can be toggled.

## 3. Currencies, Assets, And Economic State

## 3.1 Primary Currency Types
- Money: integer, used for purchases, betting, business operations, and many rewards.
- Aura: BigInt social currency, used for gifting/social value and some mechanics.
- AuraCoin balance: floating tradeable asset for market game.
- Additional crypto-like assets: supported through crypto balance and position models.

### 3.2 Shared/Composite Balance
- Some views/actions use shared balance updates to keep distributed views in sync.

### 3.3 Daily Caps And Resets (Economy)
- Aura distribution cap: default 100/day, configurable.
- Game aura cap: default 500/day, configurable.
- Game money cap: default 1000/day, configurable.
- Daily reset logic uses Europe/Paris day boundaries.

## 4. Aura Distribution System

Mechanic intent: social gifting/taking of aura with a daily sender cap.

### 4.1 Transfer Rules
- Players can transfer aura to another user with a short message.
- Self-transfer is blocked.
- Daily sender allowance is enforced using dailyAuraGiven and dailyAuraLimit.
- Transfer record stores sender, receiver, amount, isGift, message, timestamp.

### 4.2 Direction Semantics
- Positive auraAmount is treated as GIVE.
- Negative auraAmount is treated as TAKE.

### 4.3 Skill Coupling
- Positive aura received grants Charisme XP: +1 per 5 aura, clamped min 1 and max 20 per transfer.

### 4.4 Notifications
- Receiver gets a notification describing transfer type, amount, and reason.

## 5. Game Rewards, Score Tracking, And Anti-Farming Controls

## 5.1 Score And Stats Model
- GameStats tracks per-game wins/losses/highScore/totalPlayed.
- GameScoreHistory tracks score events over time.
- Some games use ascending score semantics (lower is better), such as racer/hexgl/minesweeper_speedrun.

## 5.2 Global Daily Reward Caps
- Daily game rewards are synchronized and capped each day in Paris timezone.
- Requested reward is clamped to remaining aura/money allowance.
- Per-game money farming guard uses per-user per-game tracker keys.

## 5.3 Reward Configuration Coverage
Defined in GAME_REWARDS and handlers for:
- doodle_jump
- solitaire
- game_2048
- flappy_bird
- chrome_dino
- snake
- blockblast
- stack_tower
- qs_watermelon
- geometry_dash
- casino
- racer
- hexgl
- tetris
- knife_hit
- goyave_empire
- logic_lab
- fruit_ninja
- minesweeper

### 5.4 Notable Reward Threshold Details
- Doodle Jump: starts at 100 score, tiered multipliers, aura tier bonuses, extra high-score aura bonus.
- 2048: money reward only at very high score threshold (16384+), aura tied to won state and can gain high-score aura bonus.
- Solitaire: win-oriented reward tiers based on computed performance score.
- Racer and HexGL: time-based tiers where lower lap/finish time gives higher rewards.
- Tetris: conservative multiplier design to reduce inflation.
- Casino: special aura thresholds for large multipliers (big and huge wins).

## 6. Daily Quests System

### 6.1 Template Pool And Daily Generation
- Daily quests are generated from a template pool.
- Template examples include:
  - join parties
  - score milestones in Doodle Jump/2048/Flappy Bird
  - play-count quests for Bomb Party, Poker, Petit Bac, Battleship, Solitaire
  - win games
  - play games
- Daily set size: 9 quests.
- For each chosen template, difficulty (target and rewards) is selected from predefined tiers.

### 6.2 Player Selection And Progress
- Player must select exactly 3 quests for the day.
- Re-selection on same day is blocked.
- Per-user quest progress is tracked in dedicated progress rows.

### 6.3 Rewards
- Quests grant configured money and aura rewards.
- Completions can trigger notifications and badge checks.

## 7. Daily Pass System

### 7.1 Claim Cadence
- One claim per local day.
- Streak increments on consecutive-day claims.
- Missed day resets streak to 0.

### 7.2 Reward Composition
Each claim always includes:
- Base money roll in range 80 to 260.
- Base aura roll in range 3 to 16.

Then one bonus outcome:
- 82% chance: item drop (weighted by item price/weight model).
- Otherwise: extra money or aura bonus roll.

### 7.3 Item Eligibility Rules
Excluded from pass drop pool:
- Gift type items
- Expired items
- Certain effect types (custom badge, clan unlock/upgrade/effects assets)
- Owned doodle jump skin duplicates

### 7.4 Rarity Buckets
- Item rarity from price:
  - common below 900
  - rare 900+
  - epic 2200+
  - legendary 4000+
- Currency rarity determined by percentile position inside reward range.

### 7.5 Featured Preview
- Status endpoint returns a rotating weighted featured set (6 items) for preview context.

## 8. Shop, Inventory, Consumables, And Player Marketplace

## 8.1 Shop Categories And Item Types
Default categories:
- COSMETIC
- CONSUMABLE
- UPGRADE

Item types in data model:
- CONSUMABLE
- COSMETIC
- UPGRADE
- GIFT

### 8.2 Purchase Validation
- Expired and unavailable items cannot be purchased.
- Certain items are one-at-a-time or unique-owned (example: Doodle Jump skins).
- Clan-related upgrades require clan membership and often leadership checks.

### 8.3 Consumable Effects
Effect JSON supports multiple recognized keys:
- aura-like fields: bonusAura, auraBonus, aura
- money-like fields: bonusMoney, moneyBonus, money, cash

### 8.4 Special Effect Types In Use
- DOODLE_JUMP_SKIN
- CLAN_TAG_UNLOCK
- CLAN_SLOT_UPGRADE
- CLAN_GAME_MONEY_BOOST
- CLAN_BANNER
- CLAN_PROFILE_PICTURE
- CUSTOM_BADGE
- YOU_ADBLOCK

### 8.5 YOU_ADBLOCK Constraints
- Default duration: 60 minutes.
- Max duration: 30 days.

### 8.6 Inventory
- UserItem tracks quantity and acquisition timestamp per user/item pair.
- Use-item endpoint applies effect logic and updates quantity/state.

### 8.7 Player Marketplace Listings
- Players list inventory items for sale with quantity and unit price.
- Status lifecycle: ACTIVE, SOLD, CANCELLED.
- Listing stats endpoints and buy/cancel actions are implemented.

## 9. Casino Layer

Casino support includes table/game modalities (frontend routes indicate soccer/mines/crash variants). Backend game route includes:
- round lifecycle guardrails (active round TTL)
- house edge constant
- payout multiplier safety limit
- reward hooks tied into economy/stat systems

## 10. AuraCoin Trading System

Mechanic intent: volatile pseudo-market with spot trades and leveraged positions.

### 10.1 Price Engine
- Initial price: 100.
- Tick interval randomized in [3.5s, 8.5s].
- Regime-based stochastic movement with mean reversion and occasional shock events.
- Price floor is enforced.

### 10.2 Execution Model
- Dynamic spread = base spread + volatility premium, capped.
- Slippage combines size impact and random impact, capped.
- Distinct execution price for BUY vs SELL.

### 10.3 Fees
- Buy fee percentage configurable via game setting key.
- Default fee used when setting missing/invalid.
- Absolute minimum fee applies.

### 10.4 Spot Trading
- Buy converts money -> auraCoinBalance after fee and execution pricing.
- Sell converts auraCoinBalance -> money after fee and execution pricing.
- Transactions are persisted with side, price, amount, fee.

### 10.5 Leveraged Positions
- Types: LONG, SHORT.
- Leverage range: 1x to 10x.
- Margin is reserved from user money on open.
- Position stores entry price, exposure in coin units, and margin.

### 10.6 PnL And Liquidation
- PnL computed from price delta times position coinAmount, side-aware.
- Liquidation threshold: margin ratio <= 0.8.
- On liquidation: position closes, marked liquidated, remaining non-negative margin returned.

### 10.7 Visibility Endpoints
- Current price and chart history.
- Personal and global transaction history.
- Open and closed positions with live computed metrics.
- Holder leaderboard by auraCoin balance.

## 11. Polymarket Prediction System

### 11.1 Suggestions
- Users submit suggestions with title/description/image/date.
- Supports both legacy binary odds and multi-option configuration.
- Multi-option constraints: 2 to 4 options, unique keys, valid hex colors, odds > 1.

### 11.2 Event Model
- Events can be filtered by status.
- Events expose betting volume stats by option and aggregate totals.

### 11.3 Admin Moderation
- Admin can create/edit/delete events.
- Admin can approve/reject suggestions.

### 11.4 Betting
- User bets are tracked per event/prediction/amount.
- Global and personal bet history endpoints exist.

### 11.5 Resolution
- Admin resolves events and payout logic is applied to bets.
- Winning/losing outcomes and returned money are persisted on bet records.

## 12. Real-Time Social: Chat, Party, Messages

### 12.1 Realtime Channels
Socket handlers cover:
- global chat
- party systems
- game-specific real-time rooms (poker, bombparty, battleship, puissance4, chess, petitbac, uno, morpion, duel, ai duel, russian roulette, ball arena)

### 12.2 Messaging Systems
- Direct/system conversations with participants and read tracking.
- Reactions, reports, moderation metadata, block lists.

### 12.3 Notification Integration
- Major events can emit notification records and push events.

## 13. Clans, Clan Economy, And Clan Wars

### 13.1 Clan Creation And Baselines
- Clan create cost: 100 money.
- Base max members: 5.
- Slot upgrade can increase max to 7.
- Starting war trophies: 1000.

### 13.2 Clan Assets And Meta
- Clan bank with deposit history.
- Clan images, descriptions, tags.
- Join requests and rank hierarchy actions.
- Clan chat and pump-up feed actions.

### 13.3 Clan Effects
- Consumable/activation effect system with cooldown windows and active effects.
- Includes game money boost effect.

### 13.4 War Structure
- Preparation: 12h.
- Duration: 7 days.
- Target score: 180.
- Minimum members to declare: 3.
- Stamina: 3 attacks per 24h per member.
- Member fortification quota: 2.
- War history limit endpoint context: 5 records.

### 13.5 Defensive And Offensive Mechanics
Defense archetypes:
- FORTRESS
- ARMORY
- BANNER
Each has durability, scaling, and scoring modifiers.

Attack archetypes and war actions include:
- raid/siege/sabotage paths
- dedicated endpoints for fortify and attack
- scoring and log persistence

### 13.6 Nation Layer And Black Market
- Territory map metadata includes global city keys and themed bonuses.
- Alliance request/respond/betray operations are implemented.
- Weekly nation boost purchase exists.
- Black market weapons exist with high prices, disabled slots, and penalty points:
  - PISTOL
  - AK
  - SNIPER

### 13.7 War Minigames
War-specific endpoints include:
- memory game submission
- bomb game submission
- naval shot system

### 13.8 War Rewards
Winner and loser reward outcomes and trophy changes are integrated into war settlement logic.

## 14. You Mode (Life Sim + Business + Social RPG)

You mode is the most complex subsystem and includes economy, employment, finance, relationships, legal interaction, product commerce, and skills.

### 14.1 Access Control
- You mode has dedicated access middleware and can be gated by settings.

### 14.2 Skill System
- Users have trackable skills with XP and training actions.
- Rewards and actions in multiple systems can grant or penalize skill XP.

### 14.3 Business Creation And Levels
Business types and balancing are centralized in config. Examples include:
- lemonade
- epicerie
- restaurant
- coffee_shop
- agency
- formation
- transfer
- youtube
- medecins
- startup
- bank
- illegal_market

Each type has configured values for creation cost, level requirement, and monthly revenue baseline. Some have item menus, collection cooldown mechanics, or special actions.

### 14.4 Business Operations
Supported mechanics include:
- treasury actions
- transfer business action
- configurable transfer fee rate
- configurable loan rate
- member invitations and HR management
- salary management and automated salary payment schedule
- member leave/sack flows
- business deletion constraints

### 14.5 Shares, Buyouts, And Capital Markets
- Shareholder proposal creation/respond/cancel.
- Share buyback offers.
- Share market listing create/buy/cancel.
- Buyout offer create/respond/cancel.
- Share cap and ownership safety checks are enforced.

### 14.6 Loans
- Loan request/review/repay flows.
- Borrower-side repayment endpoint exists.
- Loan constraints include amount, duration, collateral aura, and role-based permissions.

### 14.7 Banking (Inside You Mode)
- Businesses of bank type can open/manage accounts.
- Account types include courant and epargne.
- Deposit/withdraw endpoints exist at account level.
- Livret epargne upgrade unlock path exists.

### 14.8 Formation (Course Products)
- Formation businesses can manage course products.
- Product actions: create/update/delete/list/buy/access/download.
- Review and rating workflows exist.
- Admin pending-review endpoint exists.
- Review prompt seen-state is tracked.

### 14.9 Support Agent And Business Profile
- Businesses can set support agent.
- Can open support conversation tied to business.
- Business profile patch endpoint supports public info updates.

### 14.10 Relationships, Marriage, Divorce, Fidelity
Implemented relationship mechanics include:
- create relationship
- propose/respond marriage
- propose/respond divorce
- couple shared balance deposit/withdraw
- forget relationship
- make mistress action
- suspect cheating + accusation response flow

### 14.11 Ratings
- Business rating route exists.
- Lawyer rating for cases exists.
- Formation product rating exists.

## 15. Justice / Court System

### 15.1 Core Domain
- plainte filing against a defendant in a supreme_court business.
- admin acceptance/rejection of plaintes.
- accepted plainte can produce a court case with generated case number.

### 15.2 Court Case Structure
- Parties include plaintif, defendant, assigned lawyers, and optional judge role entities.
- Argument submission and retrieval endpoints exist.
- Case status update endpoint exists.
- Verdict endpoint supports finalization data.

### 15.3 Law Firm Discovery
- Law-firm listing endpoint exists (business context for legal representation).

### 15.4 Pending Sanction Flow
- Endpoint exists to create pending sanctions linked to case flow.

## 16. Badges, Achievements, And Cosmetic Identity

### 16.1 Badge Core
- Badge catalog with rarity/background/display metadata.
- User can equip up to two badges.
- UserBadge records awarded badges.

### 16.2 Awarding
- Automated checks and explicit award calls are integrated into gameplay flows.
- Badge award utilities contain condition-based rechecks.

### 16.3 Custom Badge Pipeline
- Custom badge request model and route surface exists.
- Shop effect type CUSTOM_BADGE ties into request eligibility.

## 17. Leaderboards And Rankings

### 17.1 Standard Boards
- Aura and money top players.
- Game-specific high score boards.
- Specialized boards for some game systems.

### 17.2 Overall Rank
- User stores totalScore and overallRank fields.
- Utility for overall classement recalculation exists.

### 17.3 Time-Based Views
- Leaderboard systems include daily/weekly/monthly-style views in specific areas.

## 18. Support, Suggestions, Inbox, And Ads

### 18.1 Support
- Dedicated support messaging routes and conversation/reporting mechanics.

### 18.2 Suggestions
- Suggestion creation, voting, comments, ratings workflow.

### 18.3 Inbox And Notification Center
- In-app notification storage with read/archive state.
- Push subscription model is supported.

### 18.4 Ads
- Business and system ad flows exist through dedicated routes/models.

## 19. Moderation, Safety, And Governance

### 19.1 Ban System
- Ban records and appeal records exist.
- Temporary and permanent outcomes are represented.

### 19.2 Warnings And Sanctions
- AdminWarning model exists.
- PendingSanction model supports legal/admin sanction proposals and review lifecycle.

### 19.3 Blocks And Reports
- User block relations and message report structures are present.

### 19.4 Maintenance And Feature Gating
- Global maintenance mode with message/end date.
- Per-page block list and page-specific block messages.
- Default landing page setting.
- Game visibility/beta/new IDs toggles.

## 20. Automation And Scheduled Jobs

Schedulers run in server runtime and execute regular economy/progression maintenance.

### 20.1 Daily Aura And Game Limit Sync
- User daily counters are reset/synced based on Paris day key.

### 20.2 Daily Business Revenue
- Non-bank businesses can receive daily credited revenue.
- Shareholder payouts are computed and distributed before treasury remainder.

### 20.3 Daily Bank Revenue
- Banks accrue compounded daily gains.
- Livret unlock can increase effective bank rate.
- Account-level interest for courant/epargne balances is credited.
- Shareholders can receive dividend-style payouts.

### 20.4 Daily Salaries
- Separate scheduler runs business salary payments.

### 20.5 Daily Tax And Other Jobs
- Additional scheduled systems include tax and specialized game rewards.

## 21. Data Model Coverage (Major Entities)

Major model groups in schema include:
- Identity and auth: User, RegistrationReview
- Economy and shop: Item, UserItem, MarketplaceListing, Transfer
- Games: GameStats, GameScoreHistory, DailyRacerRun, PolytrackRecord, BombPartyStats
- Clans and war: Clan, ClanMember, ClanWar, ClanWarAttack, ClanWarFortification, clan event models
- You mode/business: Business, BusinessMember, BusinessLoan, BusinessInvestment, shareholder and transfer models, BankAccount, FormationProduct models
- Relationships/legal: Relationship, MarriageProposal, DivorceProposal, CheatingAccusation, Plainte, CourtCase, CourtParty, CourtArgument, PendingSanction
- Trading/prediction: AuraCoinPrice/Transaction/Position, PolymarketEvent/Suggestion/Bet, crypto models
- Social comms: chat/message/direct message/conversation/report/reaction models, notifications
- Cosmetic/progression: Badge, UserBadge, custom badge requests

## 22. Route Surface Inventory (By System)

Implemented backend route families:
- auth
- economy
- marketplace
- games
- leaderboards
- users
- admin
- auracoin
- market-room
- suggestions
- bombparty
- uploads
- maintenance
- clans
- polymarket
- pass
- quests
- solitaire
- notifications
- badges
- custom-badges
- support
- clash
- polytrack
- changelog
- you
- ads
- messages
- justice
- braquageLegal

## 23. Known Partial Or Emerging Areas

These areas have code presence but may be in-progress, partially wired, or less exposed than core loops:
- Aura Scroll models exist and may be partially routed depending on branch/version.
- Some nation/alliance meta mechanics in clans are present but strategically evolving.
- Relationship side mechanics (mistress/cheating) are implemented at action level and can continue to evolve in balancing.
- Advanced startup/business subloops have validation and action scaffolding that may be expanded.

## 24. Practical Definition Of "Everything" In This Game

From a mechanics perspective, Aura Tracker is not a single minigame. It is a compound online game platform with:
- Multi-genre gameplay
- Persistent account progression
- Shared social economy
- Structured daily progression systems
- Player-to-player and clan-level competition
- Market simulation and leveraged trading
- A deep business and legal roleplay sim
- Moderation and governance systems required for a private community game

That combination is the core identity of the game content.
