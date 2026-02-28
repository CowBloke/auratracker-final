# AuraTracker - Entrepreneur Game Mode
## Game Design Document

---

## Executive Summary

Entrepreneur is a persistent, asynchronous multiplayer economic simulation where players build business empires, compete for market dominance, and shape a shared global economy. Players start with $10,000 and unlimited ambition to become industrial titans controlling sectors from simple retail to complex aerospace manufacturing.

The game supports up to 150 concurrent players in a single persistent world, featuring player specialization systems, AI-controlled market forces, stock trading, banking enterprises, legal battles, and alliance mechanics. Success is measured not by winning conditions but by wealth accumulation, market control, and economic influence.

---

## Core Game Loop

1. Player logs in and checks company status
2. Assigns employees to tasks (production, upgrades, R&D)
3. Monitors market conditions and adjusts strategy
4. Invests in stocks, makes loans, or expands business portfolio
5. Negotiates with other players (trades, alliances, acquisitions)
6. Reviews rankings and news feed for opportunities
7. Logs off while passive income and employee tasks continue

---

## Player Onboarding

### Starting Capital

Every new player receives **$10,000** in starting capital. This is their seed money to launch their first business venture.

### First Business Selection

Players choose from a tiered catalog of starter businesses:

| Tier | Examples | Startup Cost | Base Income/hr |
|------|----------|--------------|----------------|
| Simple | Coffee shop, Retail store | $5,000 | $50 |
| Medium | Restaurant, Gym | $25,000 | $150 |
| Complex | Aerospace, Chip manufacturing | $500,000+ | $2,000+ |

---

## Business & Industry System

### Business Types & Complexity Tiers

Businesses are categorized by complexity, which determines startup cost, employee requirements, profit potential, and upgrade complexity.

| Tier | Sectors | Cost Range | Employees | Key Feature |
|------|---------|------------|-----------|-------------|
| Tier 1 | Retail, Food Service, Consulting | $5k-$50k | 1-5 | Fast setup, low barrier |
| Tier 2 | Real Estate, Software, Logistics | $50k-$200k | 5-15 | Scalable, requires specialization |
| Tier 3 | Manufacturing, Pharmaceuticals, Energy | $200k-$1M | 15-50 | Heavy R&D requirements |
| Tier 4 | Aerospace, Semiconductors, Biotech | $1M+ | 50+ | Elite tier, maximum profit potential |

### Business Progression

Companies evolve through distinct stages:

- **Startup** - Initial phase, limited employees, basic production
- **SME (Small-Medium Enterprise)** - Expanded operations, can hire specialists
- **Corporation** - Multi-location capability, advanced R&D unlocked
- **Conglomerate** - Can own businesses across multiple sectors, massive scale

Progression requires capital investment and employee task completion. Each tier unlocks new capabilities and increases production capacity.

---

## Employee System

### Employee Specializations

Employees have distinct skill specializations that determine which tasks they can perform:

| Specialization | Primary Tasks | Salary Range |
|----------------|---------------|--------------|
| Marketing | Boost market share, customer acquisition, brand awareness campaigns | $100-$500/hr |
| R&D | Develop new products, improve efficiency, unlock advanced upgrades | $150-$800/hr |
| Production | Manufacture products, operate equipment, quality control | $50-$300/hr |
| Finance | Manage investments, analyze stocks, optimize cash flow | $200-$1000/hr |
| Legal | Handle lawsuits, draft contracts, ensure regulatory compliance | $300-$1500/hr |

### Employee Tasks & Automation

Players assign employees to tasks that run asynchronously in real-time:

- **Production Tasks** - Generate products/hour based on business type
- **Upgrade Tasks** - Improve production efficiency, unlock new features (duration: 1-72 hours)
- **R&D Tasks** - Research new products, reduce costs, gain competitive advantages
- **Marketing Tasks** - Boost market share temporarily, attract customers

Tasks follow this flow: Player assigns employee → Task runs for X hours → Player collects reward when complete. Employees remain assigned until reassigned or task completes.

---

## Market & Economic System

### Supply & Demand Mechanics

Each business sector operates on a supply/demand model:

- **Production Rate:** Each company produces X products/hour
- **Sector Competition:** More players in a sector = lower profit per unit
- **Market Saturation:** Base sector demand (AI-controlled) divided by total sector production
- **Price Automation:** Prices adjust automatically based on saturation level

*Example:* If the tech sector has 50 companies producing 1000 units/hour total, and base demand is 800 units/hour, the sector is oversaturated. Profit margins decrease by the saturation ratio (800/1000 = 0.8x multiplier).

### Market Share Calculation

Market share in a sector is determined by company net worth relative to total sector net worth. Net worth includes:

- Cash on hand
- Business asset value (properties, equipment, inventory)
- Stock portfolio value
- Outstanding loans (negative value)

### AI-Controlled Companies

AI companies serve three purposes:

1. **Market Stabilizers** - Prevent monopolistic control by maintaining baseline competition
2. **Acquisition Targets** - Players can buy AI companies to expand rapidly
3. **Aggressive Competitors** - Some AI companies aggressively expand, forcing players to adapt

AI companies operate on simplified logic: they invest profits into expansion, occasionally launch new ventures, and respond to market conditions. They cannot initiate legal battles but can be sued.

---

## Stock Market & Financial Systems

### Company Valuation

Public companies are valued using a hybrid formula:

**Company Value = (Hourly Revenue × 24 × 365 × Multiplier) + Total Assets**

- **Multiplier** ranges from 1.5x to 5x based on growth trajectory, sector performance, and investor confidence
- **Total Assets** include cash, properties, equipment, inventory, and subsidiary values

### Stock Trading Mechanics

Players can:

- Issue IPO (Initial Public Offering) to raise capital by selling company shares
- Buy shares in other player companies (public only)
- Buy shares in AI companies
- Attempt hostile takeovers by acquiring majority stake (51%+)
- Receive dividends from owned shares quarterly

### Banking System

Banks are player-owned businesses with unique mechanics:

- **Loan Issuance:** Banks can offer loans to other players with custom interest rates and terms
- **Savings Accounts:** Players deposit money, banks pay interest (bank sets rate)
- **Investment Services:** Banks can manage portfolios for clients (fee-based)
- **Default Risk:** If borrowers default, banks absorb the loss

Player-to-player direct loans are also possible outside the banking system, allowing informal financing and venture capital arrangements.

---

## Player Specialization System

### Skill Tracks

Players choose a specialization that unlocks unique business upgrades:

| Specialization | Unique Upgrades & Benefits |
|----------------|----------------------------|
| Manufacturing | Automated production lines, reduced material costs, quality assurance systems |
| Technology | AI-driven analytics, software automation, digital product development |
| Logistics | Supply chain optimization, faster deliveries, international expansion capabilities |
| Finance | Advanced stock trading strategies, reduced loan interest rates, investment fund management |
| Marketing | Viral campaigns, brand partnerships, market manipulation tactics |

### Skill Progression

Players gain proficiency by completing relevant upgrades. Each specialization has 10 mastery levels:

- **Novice (Level 1-2):** Basic upgrades unlocked
- **Skilled (Level 3-5):** Intermediate upgrades, 5% efficiency bonus
- **Expert (Level 6-8):** Advanced upgrades, 15% efficiency bonus
- **Master (Level 9-10):** Elite upgrades, 30% efficiency bonus, can mentor others

Cross-specialization collaboration is encouraged. For example, a Logistics Master can partner with a Manufacturing Expert to create highly efficient supply chains.

---

## Legal System

### Filing Legal Actions

Players can initiate lawsuits against competitors by hiring lawyers (high fixed cost: $50,000 - $500,000 depending on case complexity).

### Legal Battle Types

- **Anti-Competitive Practices:** Sue companies for monopolistic behavior
- **Contract Breach:** Enforce partnership agreements, supplier contracts
- **Patent Disputes:** Challenge R&D-derived advantages
- **Hostile Takeover Defense:** Block unwanted acquisitions

### Resolution Mechanics

Legal battles resolve based on:

- Evidence strength (automated based on game data)
- Lawyer quality (higher cost = better odds)
- Random factor (20% variance to prevent deterministic outcomes)

Cases take 24-72 real-time hours to resolve. Winners receive damages/injunctions; losers pay court costs.

---

## Multiplayer & Social Features

### Alliances & Partnerships

Players can form official alliances with shared benefits:

- **Resource Sharing:** Pool capital for large ventures
- **Joint Ventures:** Co-own businesses, split profits
- **Market Coordination:** Avoid sector saturation by coordinating entry
- **Legal Protection:** Alliance members can pool resources to defend against lawsuits

### Trading & Negotiation

Direct player-to-player transactions include:

- Cash transfers
- Stock swaps
- Business acquisitions/sales
- Loan agreements
- Contract arrangements (supply deals, exclusivity agreements)

All trades are logged in the news feed and can be scrutinized by other players.

### Company Rankings

Global leaderboards display:

- **Top 50 Companies by Net Worth**
- **Sector Leaders** (largest in each industry)
- **Fastest Growing Companies** (month-over-month % growth)
- **Most Profitable** (highest revenue/hour)

### News Feed

A global activity stream displays major economic events:

- Company IPOs and stock listings
- Major acquisitions (>$1M value)
- Legal battle filings and outcomes
- Bankruptcies and business closures
- New sector entries by major players
- Alliance formations and dissolutions

---

## Technical Considerations

### Scalability for 150 Players

To support 150 concurrent players in a single persistent world:

- **Asynchronous Processing:** All tasks, production, and transactions occur server-side with timestamp-based calculations
- **Caching:** Market calculations update every 5 minutes to prevent real-time recalculations on every action
- **Database Optimization:** Indexed queries for company lookups, stock prices, and leaderboards
- **Event Queue:** Major actions (trades, lawsuits, IPOs) queue for batch processing

### Asynchronous Gameplay

Players can log in at any time and continue making progress:

- Offline income accumulation (capped at 72 hours to prevent infinite accumulation)
- Task completion notifications via email/push notifications
- Market snapshots show changes since last login

### Anti-Exploitation Measures

- **Multi-Account Prevention:** IP tracking, device fingerprinting, behavior analysis
- **Trade Limits:** New players (<7 days old) cannot receive transfers >$50k to prevent wealth funneling
- **AI Company Protection:** Cannot be sold between players to prevent market manipulation

---

## Future Considerations

### Economic Events (Phase 2)

Once the core economy is stable, introduce periodic events:

- Sector booms (temporary 2x profit in random sector)
- Recessions (global profit reduction)
- Technological breakthroughs (unlock new business types)
- Regulatory changes (new legal restrictions or opportunities)

### Advanced Features (Phase 3)

- **Real Estate System:** Purchase physical properties for office space, warehouses, retail locations
- **Global Expansion:** Open businesses in different regions with varying costs/profits
- **Employee Poaching:** Steal skilled employees from competitors
- **Corruption Mechanics:** Bribe officials, sabotage competitors (high risk/reward)

---

## Conclusion

The Entrepreneur game mode transforms AuraTracker into a living economic ecosystem where player decisions ripple through interconnected markets. By emphasizing specialization, asynchronous progression, and emergent player interactions, the mode creates depth without requiring constant attention.

Success in Entrepreneur is not about beating the game—it's about outmaneuvering human competitors, identifying market inefficiencies, and building an empire that endures through changing economic conditions. The persistent world ensures every session offers new opportunities and challenges as the global economy evolves.
