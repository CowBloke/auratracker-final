# Resource System Plan — AuraTracker You Mode

Version: 2026-04-21  
Status: Approved, implementation in progress  
Scope: Business resource production, employee mini-games, crafting, storage, marketplace revamp, cross-system hooks.  
Out of scope (deferred): skill system integration.

---

## 1. Resource Taxonomy

| Resource | Tier | Primary Purpose |
|---|---|---|
| Wood | Raw | Build structures, basic businesses |
| Stone | Raw | Build structures, upgrade storage |
| Iron | Raw | Craft tools, equipment |
| Food | Raw | Restaurants, NPC wages, war stamina |
| Cloth | Raw | Agency products, cosmetics |
| Concrete | Refined (Stone+) | Advanced buildings, warehouses |
| Steel | Refined (Iron+) | Equipment, clan fortifications |
| Fuel | Refined | 24h production boost for any business |
| Paper | Refined (Wood+) | Formation courses, media |
| Luxury Goods | Finished | Market sales, aura-multiplied gifting |
| Medicine | Finished | Medecins output, war recovery |
| Data | Finished | Startup/youtube output, Polymarket edge |
| Contraband | Special | Clan war fuel, black market weapons |

Resources are stored per-business. Base capacity: 50 units total per business.

---

## 2. Business Reclassification

### New Producer Types (raw extractors)
| Type | Produces | Notes |
|---|---|---|
| `farm` | Food | Starter tier, level 1+ |
| `sawmill` | Wood | Basic extractor, level 1+ |
| `quarry` | Stone → Concrete (level 2+) | Stone raw, Concrete refined |
| `iron_mine` | Iron → Steel (level 3+) | Iron raw, Steel refined |
| `fuel_refinery` | Fuel | Requires Iron + Stone input |
| `textile_mill` | Cloth | Feeds agency |

`lemonade` remains as cosmetic alias for `farm`.

### Existing Types Reclassified
| Business | Role | Produces / Consumes |
|---|---|---|
| lemonade/farm | Producer | Food |
| epicerie | Crafter | Food → Luxury Goods |
| restaurant | Producer + Crafter | Consumes Food → Money + XP |
| coffee_shop | Producer | Food (small), Luxury Goods |
| agency | Crafter | Cloth → Luxury Goods |
| formation | Service | Paper (small), course products unchanged |
| youtube | Producer | Data, Paper |
| medecins | Crafter | Produces Medicine → money/XP |
| startup | Crafter | Data + Steel → new items |
| bank | Service | Nothing — financial only (special mini-game, see section 4) |
| illegal_market | Producer | Contraband — daily seizure risk |
| transfer | Service | Nothing — logistics/transport only |

---

## 3. Recipe System

One unified format for crafting items, building businesses, and constructing structures.

```
Recipe {
  inputs:       [{ resource: string, qty: number }]
  moneyCost:    number  // can be 0
  levelRequired: number
  output: {
    type: "structure" | "item" | "business"
    id:   string
  }
  productionTime: "instant" | number  // hours
}
```

### Example Recipes

**Build a Restaurant:**
- Wood ×30, Stone ×20, Concrete ×10, Food ×5 + 2000 money

**Build a Silo:**
- Wood ×20, Stone ×10 + 500 money

**Build a Warehouse:**
- Concrete ×30, Steel ×10 + 2000 money

**Craft Healing Potion (existing consumable):**
- Medicine ×3, Food ×1 + 50 money → item added to business inventory

**Craft Luxury Gift Box (new item):**
- Luxury Goods ×2, Paper ×1 + 100 money

**Black Market Weapon (PISTOL):**
- Contraband ×20 + money cost (existing)

Money no longer buys businesses directly — you buy resources from the market, then fulfill the recipe.

---

## 4. Production & Employee Mini-Games

### Human Employees — Daily Mini-Games
- Each employee has 1 production slot per day.
- Completing the mini-game = full quota produced.
- Skipping = 50% auto-production (no total punishment for missed days).
- Mini-game archetypes by business type:
  - **Timing** — tap/click at the right moment (sawmill, mine, quarry)
  - **Sorting** — drag items to correct bins (epicerie, restaurant, farm)
  - **Memory** — match pairs (formation, medecins, startup)
  - **Clicker burst** — rapid clicks in a time window (iron_mine, fuel_refinery)
  - **Finance puzzle** — allocate funds to maximize return (bank — rewards vault fructification, not resources)

### NPC Employees
- Hireable at 2× human salary.
- Always produce at 70% of human quota — fully automated, no mini-game.
- Cap at employee level 2 (cannot be promoted further).
- Unlocked at business level 3.

### Daily Production Formula (per employee)
```
output = base_rate × level_multiplier × participation_factor
  where participation_factor = 1.0 (human played) | 0.7 (NPC) | 0.5 (human skipped)
```

### Employee Levels
- Each completed mini-game grants the employee XP.
- Level 1–5 scale for humans; level 1–2 cap for NPCs.
- Higher level = higher base_rate multiplier.
- Sacking a leveled employee triggers a cooldown before they re-enter the hire pool.

---

## 5. Storage

### Per-Business Base Capacity
50 units total across all resource types.

### Silo (buildable structure)
- Recipe: Wood ×20, Stone ×10 + 500 money
- Adds 150 capacity.
- Max 3 per business.
- Unlocks at business level 2.

### Warehouse (advanced structure)
- Recipe: Concrete ×30, Steel ×10 + 2000 money
- Adds 500 capacity.
- Max 1 per business.
- Unlocks at business level 4.

### Borrow Mechanic
- Rent unused capacity from another player's warehouse for X money/day.
- Lending player earns passive income; borrower gains overflow storage.
- Either party can cancel with 24h notice.

---

## 6. Business Levels → Unlocks

| Level | Unlocks |
|---|---|
| 1 | Base resource production |
| 2 | Silo buildable, second employee slot |
| 3 | Advanced recipes, NPC hire |
| 4 | Warehouse buildable, employee level cap raised |
| 5 | Bulk market orders (export listing), Fuel boost available |

### Player Level → Business Type Gates
- Raw extractors (farm, sawmill, quarry, iron_mine): level 1+
- Service businesses (bank, formation, transfer): level 3+
- Crafters (startup, agency): level 4+
- illegal_market: level 5+ (with seizure risk)

---

## 7. Cross-System Interactions

### Contraband × Clan Wars
| Mechanic | Detail |
|---|---|
| Declare war | Requires minimum contraband stockpile in clan vault (e.g. 50 units) |
| Attack boost | Spend contraband on an attack turn for a damage multiplier |
| Black market weapons | PISTOL/AK/SNIPER now cost contraband (in addition to money) |
| Sabotage | New war action: burn contraband to shut down enemy production business for 24h |
| War loot | Winner receives % of loser's contraband stockpile |
| Clan vault | Members can donate contraband to clan vault |
| illegal_market seizure | Enemy can raid and loot stock if business is targeted during war |

### Food × Clan Wars
- Clan can store Food in clan vault.
- Before an attack, member consumes Food to restore 1 extra stamina slot per 12h instead of 24h.

### Steel + Concrete × Clan Fortifications
- Upgrading FORTRESS/ARMORY/BANNER defense archetypes costs Steel and Concrete in addition to money.

### Medicine × War Recovery
- Players with heavy losses can use Medicine to partially restore stamina faster.

### Luxury Goods × Aura
- Gifting a Luxury Good alongside an aura transfer multiplies the aura amount (+50 per Luxury Good).

### Data × Polymarket
- youtube/startup at level 3+: spend Data for a "market research" daily action — reveals current bet distribution 1 tick early.

### Paper × Formation
- Publishing or updating a formation course requires Paper as an input.

### Fuel × Production Speed
- Any business can consume Fuel to guarantee 100% production that day regardless of mini-game completion.

### Resources × Daily Quests
- New quest templates: "Produce 30 Wood", "Sell 20 Food on the market", "Complete 3 employee mini-games today".

---

## 8. Revamped Marketplace

The current `Market.tsx` becomes a full exchange: Resources | Items | Business Listings (buyouts).

### Resource Tab Features
- Filter: resource type, tier, price/unit range, min/max quantity, seller
- Sort: price/unit, total quantity, newest listing, seller rating
- Search: by seller name or resource name
- Price history chart per resource (reuse AuraCoin chart component)
- Bulk buy: fill an order up to a set budget
- Pending orders: place a buy order at a target price

### Admin Bootstrapping
- Admins own initial production businesses and seed the market with starter resources.
- New players purchase from the live market — no starter pack, so they immediately interact with the economy.

---

## 9. Skills (Deferred)

Skill system integration is out of scope for this implementation phase.

---

## 10. Implementation Order (Frontend-First)

1. **Revamped Marketplace UI** — independent of new backend, mock with seeded data
2. **Business stock panel** — resource inventory display on business page
3. **Recipe / crafting UI** — recipe list, ingredient checker, craft button
4. **Employee mini-game UI** — daily slot interface per employee
5. **Storage management UI** — build silo/warehouse, borrow/lend panel
6. **NPC hiring UI** — hire panel in employee management
7. **Backend: Prisma schema** — resources, storage, recipes, employee levels
8. **Backend: routes + scheduler updates** — production, crafting, storage, market
