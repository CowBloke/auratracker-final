# Monopoly Multiplayer

A fully playable, turn-based Monopoly-style tabletop multiplayer game that runs in a web browser. Supports local Wi-Fi multiplayer with a lobby system.

## Features

### Gameplay
- Complete classic Monopoly board layout (40 spaces)
- All property groups: Brown, Light Blue, Pink, Orange, Red, Yellow, Green, Dark Blue
- 4 Railroads and 2 Utilities
- Chance and Community Chest cards with randomized draws
- Dice rolling system with visual feedback and doubles mechanics
- Full money management (starting funds, rent, buying/selling, mortgages)
- Houses and Hotels with even-building rules
- Jail mechanics (roll doubles, pay bail, or use Get Out of Jail Free card)
- Bankruptcy handling and automatic win condition detection
- Free Parking money collection (house rule)

### Multiplayer
- Local Wi-Fi multiplayer (2-8 players)
- One player hosts, others join via 4-letter game code
- Real-time game state synchronization via WebSockets
- Player disconnect handling with automatic turn management
- Strict turn order enforcement

### User Interface
- Full game board visible in a single window (no scrolling)
- Player status indicators (current turn, money, properties)
- Property ownership markers with player colors
- Visual house/hotel indicators on properties
- Animated dice rolling
- Card display for Chance and Community Chest
- Game log showing all actions
- Property management panel for building/mortgaging

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd monopoly

# Install dependencies
npm install

# Start the server
npm start
```

### Playing the Game

1. **Start the server**: Run `npm start` - the server will display connection URLs
2. **Host creates game**:
   - Open browser to `http://localhost:3000`
   - Enter your name and click "Create Game"
   - Share the 4-letter game code with other players
3. **Players join**:
   - Open browser to the server URL (shown in terminal)
   - Enter name and the game code
   - Click "Join Game"
4. **Start playing**:
   - Host clicks "Start Game" when all players have joined
   - Players take turns rolling dice, buying properties, etc.

## Architecture

```
monopoly/
├── package.json          # Dependencies and scripts
├── server/
│   ├── server.js         # Express + Socket.io server
│   ├── gameLogic.js      # Core game mechanics
│   └── gameData.js       # Board, cards, and property definitions
└── public/
    ├── index.html        # Game UI structure
    ├── style.css         # Complete styling
    └── client.js         # Client-side game logic
```

### Server (`server/`)

**server.js** - Main entry point
- Express HTTP server for static files
- Socket.io for real-time multiplayer communication
- Game session management (create, join, disconnect)
- Broadcasts game state updates to all players

**gameLogic.js** - Core game mechanics
- Turn management and phase tracking
- Dice rolling and movement
- Property purchasing, rent calculation, and ownership
- House/hotel building with even-building rules
- Mortgage/unmortgage functionality
- Chance and Community Chest card execution
- Jail mechanics (doubles, bail, cards)
- Bankruptcy and win condition detection

**gameData.js** - Static game data
- All 40 board spaces with positions and types
- Property prices, rents, and color groups
- 16 Chance cards with actions
- 16 Community Chest cards with actions
- Player colors and game constants

### Client (`public/`)

**index.html** - UI Structure
- Lobby screen (create/join game)
- Waiting room with player list
- Game screen with board, player info, and actions
- Game over modal

**style.css** - Styling
- Responsive board layout using CSS Grid
- Property color coding
- Player tokens and house/hotel indicators
- Animations for dice rolling and card display

**client.js** - Client logic
- Socket.io connection and event handling
- Dynamic board rendering
- Player token positioning
- Action button management based on game state
- Property management UI

## Game Rules Implemented

### Turn Flow
1. Player rolls dice
2. Token moves clockwise around the board
3. Handle landing space (buy property, pay rent, draw card, etc.)
4. Player can manage properties (build, mortgage)
5. Player ends turn (or rolls again if doubles)

### Special Rules
- **Doubles**: Roll again (up to 3 times, then go to jail)
- **Passing GO**: Collect $200
- **Jail**:
  - Pay $50 bail before rolling
  - Use Get Out of Jail Free card
  - Roll doubles to escape
  - Must pay after 3 turns
- **Properties**: Must own all in color group to build
- **Building**: Must build evenly across color group
- **Mortgage**: Can't build while any property in group is mortgaged
- **Bankruptcy**: Transfer assets to creditor or release to bank

### Rent Calculation
- Base rent: Listed on property
- Monopoly: 2x base rent (no houses)
- Houses: Increasing rent per house
- Hotel: Maximum rent
- Railroads: $25/$50/$100/$200 based on count owned
- Utilities: 4x or 10x dice roll based on count owned

## Technical Details

### Networking
- WebSocket-based real-time communication via Socket.io
- Event-driven architecture for minimal latency
- Server authoritative game state (anti-cheat)
- Automatic reconnection handling

### Performance
- Efficient DOM updates (only changed elements)
- CSS Grid for responsive board layout
- No external image dependencies
- Minimal network traffic (delta updates)

## License

MIT
