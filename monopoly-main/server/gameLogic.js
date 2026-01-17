/**
 * Monopoly Game Logic
 * Handles all game state management, turns, property transactions, and win conditions
 */

const {
  BOARD_SPACES,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  PLAYER_COLORS,
  COLOR_GROUPS,
  STARTING_MONEY,
  GO_SALARY,
  JAIL_POSITION,
  GO_TO_JAIL_POSITION,
  JAIL_BAIL,
  MAX_HOUSES,
  RAILROAD_RENT
} = require('./gameData');

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Creates a new game instance
 */
function createGame(gameId, hostId, hostName) {
  return {
    id: gameId,
    hostId: hostId,
    status: 'lobby', // lobby, playing, finished
    players: [{
      id: hostId,
      name: hostName,
      color: PLAYER_COLORS[0],
      money: STARTING_MONEY,
      position: 0,
      properties: [],
      inJail: false,
      jailTurns: 0,
      hasGetOutOfJailCard: false,
      bankrupt: false
    }],
    currentPlayerIndex: 0,
    turnPhase: 'waiting', // waiting, rolled, buying, actionRequired
    lastDiceRoll: null,
    doublesCount: 0,
    properties: initializeProperties(),
    chanceCards: shuffleArray([...CHANCE_CARDS]),
    communityChestCards: shuffleArray([...COMMUNITY_CHEST_CARDS]),
    chanceIndex: 0,
    communityChestIndex: 0,
    freeParkingMoney: 0, // House rule: collect money on Free Parking
    currentCard: null, // Currently displayed card
    pendingAction: null, // Action waiting for player response
    gameLog: [],
    winner: null,
    createdAt: Date.now()
  };
}

/**
 * Initialize properties with ownership data
 */
function initializeProperties() {
  const properties = {};
  BOARD_SPACES.forEach(space => {
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      properties[space.id] = {
        ownerId: null,
        houses: 0, // 5 = hotel
        mortgaged: false
      };
    }
  });
  return properties;
}

/**
 * Add a player to the game
 */
function addPlayer(game, playerId, playerName) {
  if (game.status !== 'lobby') {
    return { success: false, error: 'Game already started' };
  }
  if (game.players.length >= 8) {
    return { success: false, error: 'Game is full' };
  }
  if (game.players.find(p => p.id === playerId)) {
    return { success: false, error: 'Already in game' };
  }

  const colorIndex = game.players.length;
  game.players.push({
    id: playerId,
    name: playerName,
    color: PLAYER_COLORS[colorIndex],
    money: STARTING_MONEY,
    position: 0,
    properties: [],
    inJail: false,
    jailTurns: 0,
    hasGetOutOfJailCard: false,
    bankrupt: false
  });

  game.gameLog.push(`${playerName} joined the game`);
  return { success: true };
}

/**
 * Remove a player from the game
 */
function removePlayer(game, playerId) {
  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { success: false, error: 'Player not found' };
  }

  const player = game.players[playerIndex];

  if (game.status === 'playing') {
    // Mark as bankrupt and release properties
    bankruptPlayer(game, player);
  } else {
    // In lobby, just remove
    game.players.splice(playerIndex, 1);
    // Reassign colors
    game.players.forEach((p, i) => {
      p.color = PLAYER_COLORS[i];
    });
  }

  game.gameLog.push(`${player.name} left the game`);
  return { success: true };
}

/**
 * Start the game
 */
function startGame(game) {
  if (game.status !== 'lobby') {
    return { success: false, error: 'Game already started' };
  }
  if (game.players.length < 2) {
    return { success: false, error: 'Need at least 2 players' };
  }

  game.status = 'playing';
  game.currentPlayerIndex = 0;
  game.turnPhase = 'waiting';
  game.gameLog.push('Game started!');
  game.gameLog.push(`${game.players[0].name}'s turn`);

  return { success: true };
}

/**
 * Roll dice
 */
function rollDice() {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return { die1, die2, total: die1 + die2, isDoubles: die1 === die2 };
}

/**
 * Handle a player's dice roll
 */
function handleRoll(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (game.turnPhase !== 'waiting') {
    return { success: false, error: 'Already rolled this turn' };
  }
  if (player.bankrupt) {
    return { success: false, error: 'You are bankrupt' };
  }

  const dice = rollDice();
  game.lastDiceRoll = dice;

  // Handle jail
  if (player.inJail) {
    return handleJailRoll(game, player, dice);
  }

  // Check for three doubles = go to jail
  if (dice.isDoubles) {
    game.doublesCount++;
    if (game.doublesCount >= 3) {
      sendToJail(game, player);
      game.gameLog.push(`${player.name} rolled doubles 3 times - Go to Jail!`);
      game.turnPhase = 'rolled';
      game.doublesCount = 0;
      return { success: true, dice, event: 'threeDoubles', message: 'Three doubles! Go to Jail!' };
    }
  } else {
    game.doublesCount = 0;
  }

  // Move player
  const moveResult = movePlayer(game, player, dice.total);
  game.gameLog.push(`${player.name} rolled ${dice.die1} + ${dice.die2} = ${dice.total}`);

  return {
    success: true,
    dice,
    moveResult,
    canRollAgain: dice.isDoubles && !player.inJail
  };
}

/**
 * Handle rolling while in jail
 */
function handleJailRoll(game, player, dice) {
  player.jailTurns++;

  if (dice.isDoubles) {
    // Got out with doubles
    player.inJail = false;
    player.jailTurns = 0;
    game.gameLog.push(`${player.name} rolled doubles and got out of jail!`);

    // Move the player
    const moveResult = movePlayer(game, player, dice.total);
    return {
      success: true,
      dice,
      event: 'escapedJail',
      moveResult,
      message: 'Rolled doubles! You escaped jail!'
    };
  }

  if (player.jailTurns >= 3) {
    // Must pay after 3 turns
    if (player.money >= JAIL_BAIL) {
      player.money -= JAIL_BAIL;
      player.inJail = false;
      player.jailTurns = 0;
      game.gameLog.push(`${player.name} paid $${JAIL_BAIL} bail after 3 turns`);

      const moveResult = movePlayer(game, player, dice.total);
      return {
        success: true,
        dice,
        event: 'forcedBail',
        moveResult,
        message: `Forced to pay $${JAIL_BAIL} bail after 3 turns`
      };
    } else {
      // Can't afford bail - check for bankruptcy
      game.pendingAction = { type: 'mustRaiseFunds', amount: JAIL_BAIL, reason: 'jail bail' };
      game.turnPhase = 'actionRequired';
      return {
        success: true,
        dice,
        event: 'cantAffordBail',
        message: `Can't afford $${JAIL_BAIL} bail - must raise funds or go bankrupt`
      };
    }
  }

  game.turnPhase = 'rolled';
  game.gameLog.push(`${player.name} didn't roll doubles - still in jail (turn ${player.jailTurns}/3)`);
  return {
    success: true,
    dice,
    event: 'stayInJail',
    message: `Still in jail (${player.jailTurns}/3 turns)`
  };
}

/**
 * Move a player forward
 */
function movePlayer(game, player, spaces) {
  const oldPosition = player.position;
  player.position = (player.position + spaces) % 40;

  // Check if passed GO
  let passedGo = false;
  if (player.position < oldPosition && player.position !== 0) {
    player.money += GO_SALARY;
    passedGo = true;
    game.gameLog.push(`${player.name} passed GO and collected $${GO_SALARY}`);
  }

  // Handle landing on space
  const landingResult = handleLanding(game, player);

  return {
    oldPosition,
    newPosition: player.position,
    passedGo,
    ...landingResult
  };
}

/**
 * Move player to specific position
 */
function movePlayerTo(game, player, position, collectGo = true) {
  const oldPosition = player.position;

  // Check if passing GO
  let passedGo = false;
  if (collectGo && position < oldPosition && position !== 0) {
    player.money += GO_SALARY;
    passedGo = true;
    game.gameLog.push(`${player.name} passed GO and collected $${GO_SALARY}`);
  }

  player.position = position;
  const landingResult = handleLanding(game, player);

  return { oldPosition, newPosition: position, passedGo, ...landingResult };
}

/**
 * Handle landing on a space
 */
function handleLanding(game, player) {
  const space = BOARD_SPACES[player.position];
  game.turnPhase = 'rolled';

  switch (space.type) {
    case 'go':
      return { spaceType: 'go', message: 'Landed on GO' };

    case 'property':
    case 'railroad':
    case 'utility':
      return handlePropertyLanding(game, player, space);

    case 'tax':
      return handleTax(game, player, space);

    case 'chance':
      return handleChance(game, player);

    case 'communityChest':
      return handleCommunityChest(game, player);

    case 'jail':
      return { spaceType: 'jail', message: 'Just Visiting' };

    case 'freeParking':
      // House rule: collect free parking money
      const collected = game.freeParkingMoney;
      if (collected > 0) {
        player.money += collected;
        game.freeParkingMoney = 0;
        game.gameLog.push(`${player.name} collected $${collected} from Free Parking`);
      }
      return { spaceType: 'freeParking', collected, message: collected > 0 ? `Collected $${collected} from Free Parking` : 'Free Parking' };

    case 'goToJail':
      sendToJail(game, player);
      game.gameLog.push(`${player.name} was sent to Jail!`);
      return { spaceType: 'goToJail', message: 'Go to Jail!' };

    default:
      return { spaceType: 'unknown' };
  }
}

/**
 * Handle landing on a property/railroad/utility
 */
function handlePropertyLanding(game, player, space) {
  const property = game.properties[space.id];

  if (!property.ownerId) {
    // Unowned - can buy
    if (player.money >= space.price) {
      game.turnPhase = 'buying';
      return {
        spaceType: space.type,
        canBuy: true,
        price: space.price,
        message: `${space.name} is available for $${space.price}`
      };
    } else {
      return {
        spaceType: space.type,
        canBuy: false,
        price: space.price,
        message: `${space.name} costs $${space.price} but you only have $${player.money}`
      };
    }
  } else if (property.ownerId === player.id) {
    // Own property
    return {
      spaceType: space.type,
      ownProperty: true,
      message: `You own ${space.name}`
    };
  } else if (property.mortgaged) {
    // Mortgaged - no rent
    return {
      spaceType: space.type,
      mortgaged: true,
      message: `${space.name} is mortgaged - no rent due`
    };
  } else {
    // Pay rent
    const owner = game.players.find(p => p.id === property.ownerId);
    if (owner && !owner.inJail) {
      const rent = calculateRent(game, space, property);
      return handleRentPayment(game, player, owner, rent, space.name);
    }
    return {
      spaceType: space.type,
      message: `Owner is in jail - no rent due`
    };
  }
}

/**
 * Calculate rent for a property
 */
function calculateRent(game, space, property) {
  if (space.type === 'railroad') {
    // Count railroads owned by same owner
    const railroadCount = [5, 15, 25, 35].filter(id =>
      game.properties[id] && game.properties[id].ownerId === property.ownerId
    ).length;
    return RAILROAD_RENT[railroadCount - 1] || 0;
  }

  if (space.type === 'utility') {
    // Utilities: rent based on dice roll
    const utilityCount = [12, 28].filter(id =>
      game.properties[id] && game.properties[id].ownerId === property.ownerId
    ).length;
    const multiplier = utilityCount === 2 ? 10 : 4;
    return game.lastDiceRoll.total * multiplier;
  }

  // Regular property
  if (property.houses === 0) {
    // Check if owner has monopoly (double rent)
    const colorGroup = space.colorGroup;
    const groupProperties = BOARD_SPACES.filter(s => s.colorGroup === colorGroup);
    const ownsAll = groupProperties.every(s =>
      game.properties[s.id] && game.properties[s.id].ownerId === property.ownerId
    );
    return ownsAll ? space.rent[0] * 2 : space.rent[0];
  }

  return space.rent[property.houses];
}

/**
 * Handle rent payment
 */
function handleRentPayment(game, player, owner, rent, propertyName) {
  if (player.money >= rent) {
    player.money -= rent;
    owner.money += rent;
    game.gameLog.push(`${player.name} paid $${rent} rent to ${owner.name} for ${propertyName}`);
    return {
      spaceType: 'property',
      rentPaid: rent,
      toPlayer: owner.name,
      message: `Paid $${rent} rent to ${owner.name}`
    };
  } else {
    // Can't afford - need to raise funds or go bankrupt
    game.pendingAction = {
      type: 'mustPayRent',
      amount: rent,
      toPlayerId: owner.id,
      propertyName
    };
    game.turnPhase = 'actionRequired';
    return {
      spaceType: 'property',
      mustPay: rent,
      toPlayer: owner.name,
      message: `Owe $${rent} to ${owner.name} - must raise funds!`
    };
  }
}

/**
 * Handle tax space
 */
function handleTax(game, player, space) {
  if (player.money >= space.amount) {
    player.money -= space.amount;
    game.freeParkingMoney += space.amount;
    game.gameLog.push(`${player.name} paid $${space.amount} ${space.name}`);
    return {
      spaceType: 'tax',
      paid: space.amount,
      message: `Paid $${space.amount} ${space.name}`
    };
  } else {
    game.pendingAction = { type: 'mustPayTax', amount: space.amount };
    game.turnPhase = 'actionRequired';
    return {
      spaceType: 'tax',
      mustPay: space.amount,
      message: `Owe $${space.amount} ${space.name} - must raise funds!`
    };
  }
}

/**
 * Handle Chance card
 */
function handleChance(game, player) {
  const card = game.chanceCards[game.chanceIndex];
  game.chanceIndex = (game.chanceIndex + 1) % game.chanceCards.length;
  game.currentCard = { type: 'chance', ...card };

  const result = executeCard(game, player, card);
  game.gameLog.push(`${player.name} drew Chance: ${card.text}`);

  return { spaceType: 'chance', card, ...result };
}

/**
 * Handle Community Chest card
 */
function handleCommunityChest(game, player) {
  const card = game.communityChestCards[game.communityChestIndex];
  game.communityChestIndex = (game.communityChestIndex + 1) % game.communityChestCards.length;
  game.currentCard = { type: 'communityChest', ...card };

  const result = executeCard(game, player, card);
  game.gameLog.push(`${player.name} drew Community Chest: ${card.text}`);

  return { spaceType: 'communityChest', card, ...result };
}

/**
 * Execute a card's action
 */
function executeCard(game, player, card) {
  switch (card.action) {
    case 'moveTo':
      if (card.collect) {
        player.money += card.collect;
      }
      return movePlayerTo(game, player, card.destination, card.passGo !== false);

    case 'moveBack':
      player.position = (player.position - card.spaces + 40) % 40;
      return handleLanding(game, player);

    case 'collect':
      player.money += card.amount;
      return { collected: card.amount };

    case 'pay':
      if (player.money >= card.amount) {
        player.money -= card.amount;
        game.freeParkingMoney += card.amount;
        return { paid: card.amount };
      } else {
        game.pendingAction = { type: 'mustPayCard', amount: card.amount };
        game.turnPhase = 'actionRequired';
        return { mustPay: card.amount };
      }

    case 'goToJail':
      sendToJail(game, player);
      return { sentToJail: true };

    case 'getOutOfJailCard':
      player.hasGetOutOfJailCard = true;
      return { gotCard: true };

    case 'repairs':
      const repairCost = calculateRepairCost(game, player, card.houseCost, card.hotelCost);
      if (player.money >= repairCost) {
        player.money -= repairCost;
        game.freeParkingMoney += repairCost;
        return { paid: repairCost };
      } else if (repairCost > 0) {
        game.pendingAction = { type: 'mustPayRepairs', amount: repairCost };
        game.turnPhase = 'actionRequired';
        return { mustPay: repairCost };
      }
      return { paid: 0 };

    case 'payEachPlayer':
      const totalToPay = card.amount * (game.players.filter(p => !p.bankrupt && p.id !== player.id).length);
      if (player.money >= totalToPay) {
        game.players.forEach(p => {
          if (!p.bankrupt && p.id !== player.id) {
            p.money += card.amount;
            player.money -= card.amount;
          }
        });
        return { paidEach: card.amount, total: totalToPay };
      } else {
        game.pendingAction = { type: 'mustPayPlayers', amountEach: card.amount, total: totalToPay };
        game.turnPhase = 'actionRequired';
        return { mustPay: totalToPay };
      }

    case 'collectFromEachPlayer':
      game.players.forEach(p => {
        if (!p.bankrupt && p.id !== player.id) {
          const amount = Math.min(p.money, card.amount);
          p.money -= amount;
          player.money += amount;
        }
      });
      return { collectedFrom: card.amount };

    case 'nearestRailroad':
      const railroads = [5, 15, 25, 35];
      let nearestRR = railroads.find(r => r > player.position) || railroads[0];
      return movePlayerTo(game, player, nearestRR, true);

    case 'nearestUtility':
      const utilities = [12, 28];
      let nearestUtil = utilities.find(u => u > player.position) || utilities[0];
      return movePlayerTo(game, player, nearestUtil, true);

    default:
      return {};
  }
}

/**
 * Calculate repair costs
 */
function calculateRepairCost(game, player, houseCost, hotelCost) {
  let cost = 0;
  player.properties.forEach(propId => {
    const prop = game.properties[propId];
    if (prop.houses === 5) {
      cost += hotelCost;
    } else {
      cost += prop.houses * houseCost;
    }
  });
  return cost;
}

/**
 * Send player to jail
 */
function sendToJail(game, player) {
  player.position = JAIL_POSITION;
  player.inJail = true;
  player.jailTurns = 0;
  game.doublesCount = 0;
}

/**
 * Buy property
 */
function buyProperty(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (game.turnPhase !== 'buying') {
    return { success: false, error: 'Cannot buy now' };
  }

  const space = BOARD_SPACES[player.position];
  const property = game.properties[space.id];

  if (property.ownerId) {
    return { success: false, error: 'Property already owned' };
  }
  if (player.money < space.price) {
    return { success: false, error: 'Not enough money' };
  }

  player.money -= space.price;
  property.ownerId = player.id;
  player.properties.push(space.id);
  game.turnPhase = 'rolled';

  game.gameLog.push(`${player.name} bought ${space.name} for $${space.price}`);

  return { success: true, property: space, newBalance: player.money };
}

/**
 * Decline to buy property
 */
function declineBuy(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (game.turnPhase !== 'buying') {
    return { success: false, error: 'Not in buying phase' };
  }

  game.turnPhase = 'rolled';
  const space = BOARD_SPACES[player.position];
  game.gameLog.push(`${player.name} declined to buy ${space.name}`);

  return { success: true };
}

/**
 * Build house on property
 */
function buildHouse(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  const space = BOARD_SPACES[propertyId];
  const property = game.properties[propertyId];

  if (!space || space.type !== 'property') {
    return { success: false, error: 'Not a buildable property' };
  }
  if (property.ownerId !== playerId) {
    return { success: false, error: 'You do not own this property' };
  }
  if (property.mortgaged) {
    return { success: false, error: 'Property is mortgaged' };
  }
  if (property.houses >= 5) {
    return { success: false, error: 'Maximum buildings reached' };
  }

  // Check if player owns all properties in color group
  const colorGroup = space.colorGroup;
  const groupProperties = BOARD_SPACES.filter(s => s.colorGroup === colorGroup);
  const ownsAll = groupProperties.every(s =>
    game.properties[s.id] && game.properties[s.id].ownerId === playerId
  );

  if (!ownsAll) {
    return { success: false, error: 'Must own all properties in color group' };
  }

  // Check for even building (can't be more than 1 house ahead)
  const minHouses = Math.min(...groupProperties.map(s => game.properties[s.id].houses));
  if (property.houses > minHouses) {
    return { success: false, error: 'Must build evenly across color group' };
  }

  // Check if any property in group is mortgaged
  if (groupProperties.some(s => game.properties[s.id].mortgaged)) {
    return { success: false, error: 'Cannot build while any property in group is mortgaged' };
  }

  const buildCost = COLOR_GROUPS[colorGroup].houseCost;
  if (player.money < buildCost) {
    return { success: false, error: 'Not enough money' };
  }

  player.money -= buildCost;
  property.houses++;

  const buildingType = property.houses === 5 ? 'hotel' : 'house';
  game.gameLog.push(`${player.name} built a ${buildingType} on ${space.name} for $${buildCost}`);

  return { success: true, houses: property.houses, newBalance: player.money };
}

/**
 * Sell house from property
 */
function sellHouse(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  const space = BOARD_SPACES[propertyId];
  const property = game.properties[propertyId];

  if (!space || space.type !== 'property') {
    return { success: false, error: 'Not a buildable property' };
  }
  if (property.ownerId !== playerId) {
    return { success: false, error: 'You do not own this property' };
  }
  if (property.houses === 0) {
    return { success: false, error: 'No buildings to sell' };
  }

  // Check for even selling
  const colorGroup = space.colorGroup;
  const groupProperties = BOARD_SPACES.filter(s => s.colorGroup === colorGroup);
  const maxHouses = Math.max(...groupProperties.map(s => game.properties[s.id].houses));
  if (property.houses < maxHouses) {
    return { success: false, error: 'Must sell evenly across color group' };
  }

  const sellPrice = COLOR_GROUPS[colorGroup].houseCost / 2;
  player.money += sellPrice;
  property.houses--;

  game.gameLog.push(`${player.name} sold a building from ${space.name} for $${sellPrice}`);

  return { success: true, houses: property.houses, newBalance: player.money };
}

/**
 * Mortgage property
 */
function mortgageProperty(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  const space = BOARD_SPACES[propertyId];
  const property = game.properties[propertyId];

  if (!property || property.ownerId !== playerId) {
    return { success: false, error: 'You do not own this property' };
  }
  if (property.mortgaged) {
    return { success: false, error: 'Property already mortgaged' };
  }
  if (property.houses > 0) {
    return { success: false, error: 'Must sell all buildings first' };
  }

  const mortgageValue = Math.floor(space.price / 2);
  player.money += mortgageValue;
  property.mortgaged = true;

  game.gameLog.push(`${player.name} mortgaged ${space.name} for $${mortgageValue}`);

  return { success: true, mortgaged: true, newBalance: player.money };
}

/**
 * Unmortgage property
 */
function unmortgageProperty(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  const space = BOARD_SPACES[propertyId];
  const property = game.properties[propertyId];

  if (!property || property.ownerId !== playerId) {
    return { success: false, error: 'You do not own this property' };
  }
  if (!property.mortgaged) {
    return { success: false, error: 'Property is not mortgaged' };
  }

  const unmortgageCost = Math.floor(space.price / 2 * 1.1); // 10% interest
  if (player.money < unmortgageCost) {
    return { success: false, error: 'Not enough money' };
  }

  player.money -= unmortgageCost;
  property.mortgaged = false;

  game.gameLog.push(`${player.name} unmortgaged ${space.name} for $${unmortgageCost}`);

  return { success: true, mortgaged: false, newBalance: player.money };
}

/**
 * Pay bail to get out of jail
 */
function payBail(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (!player.inJail) {
    return { success: false, error: 'Not in jail' };
  }
  if (player.money < JAIL_BAIL) {
    return { success: false, error: 'Not enough money' };
  }

  player.money -= JAIL_BAIL;
  player.inJail = false;
  player.jailTurns = 0;

  game.gameLog.push(`${player.name} paid $${JAIL_BAIL} bail`);

  return { success: true, newBalance: player.money };
}

/**
 * Use Get Out of Jail Free card
 */
function useJailCard(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (!player.inJail) {
    return { success: false, error: 'Not in jail' };
  }
  if (!player.hasGetOutOfJailCard) {
    return { success: false, error: 'No Get Out of Jail Free card' };
  }

  player.hasGetOutOfJailCard = false;
  player.inJail = false;
  player.jailTurns = 0;

  game.gameLog.push(`${player.name} used Get Out of Jail Free card`);

  return { success: true };
}

/**
 * End turn
 */
function endTurn(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (game.turnPhase === 'waiting') {
    return { success: false, error: 'Must roll dice first' };
  }
  if (game.turnPhase === 'actionRequired') {
    return { success: false, error: 'Must resolve pending action first' };
  }

  // Check if can roll again (doubles)
  if (game.lastDiceRoll && game.lastDiceRoll.isDoubles && !player.inJail && game.doublesCount > 0) {
    // Reset for another roll
    game.turnPhase = 'waiting';
    game.gameLog.push(`${player.name} rolled doubles - roll again!`);
    return { success: true, rollAgain: true };
  }

  // Move to next player
  game.currentCard = null;
  game.doublesCount = 0;

  // Find next non-bankrupt player
  let nextIndex = game.currentPlayerIndex;
  do {
    nextIndex = (nextIndex + 1) % game.players.length;
  } while (game.players[nextIndex].bankrupt && nextIndex !== game.currentPlayerIndex);

  game.currentPlayerIndex = nextIndex;
  game.turnPhase = 'waiting';
  game.lastDiceRoll = null;

  const nextPlayer = game.players[nextIndex];
  game.gameLog.push(`${nextPlayer.name}'s turn`);

  // Check win condition
  const activePlayers = game.players.filter(p => !p.bankrupt);
  if (activePlayers.length === 1) {
    game.status = 'finished';
    game.winner = activePlayers[0];
    game.gameLog.push(`${activePlayers[0].name} wins the game!`);
    return { success: true, gameOver: true, winner: activePlayers[0] };
  }

  return { success: true, nextPlayer: nextPlayer.name };
}

/**
 * Declare bankruptcy
 */
function declareBankruptcy(game, playerId, toPlayerId = null) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  game.gameLog.push(`${player.name} declared bankruptcy!`);

  if (toPlayerId) {
    // Bankrupt to another player - transfer assets
    const creditor = game.players.find(p => p.id === toPlayerId);
    if (creditor) {
      creditor.money += player.money;
      player.properties.forEach(propId => {
        game.properties[propId].ownerId = creditor.id;
        creditor.properties.push(propId);
      });
      game.gameLog.push(`${player.name}'s assets transferred to ${creditor.name}`);
    }
  } else {
    // Bankrupt to bank - release properties
    player.properties.forEach(propId => {
      game.properties[propId].ownerId = null;
      game.properties[propId].houses = 0;
      game.properties[propId].mortgaged = false;
    });
    game.gameLog.push(`${player.name}'s properties returned to bank`);
  }

  bankruptPlayer(game, player);

  // Clear pending action if this was the current player
  if (getCurrentPlayer(game)?.id === playerId) {
    game.pendingAction = null;
    game.turnPhase = 'rolled';
  }

  // Check win condition
  const activePlayers = game.players.filter(p => !p.bankrupt);
  if (activePlayers.length === 1) {
    game.status = 'finished';
    game.winner = activePlayers[0];
    game.gameLog.push(`${activePlayers[0].name} wins the game!`);
    return { success: true, gameOver: true, winner: activePlayers[0] };
  }

  return { success: true };
}

/**
 * Mark player as bankrupt
 */
function bankruptPlayer(game, player) {
  player.bankrupt = true;
  player.money = 0;
  player.properties = [];

  // If current player, advance turn
  if (getCurrentPlayer(game)?.id === player.id) {
    game.pendingAction = null;
    endTurn(game, player.id);
  }
}

/**
 * Resolve pending payment
 */
function resolvePayment(game, playerId) {
  const player = getCurrentPlayer(game);
  if (!player || player.id !== playerId) {
    return { success: false, error: 'Not your turn' };
  }
  if (!game.pendingAction) {
    return { success: false, error: 'No pending action' };
  }

  const action = game.pendingAction;

  if (player.money < action.amount) {
    return { success: false, error: 'Still not enough money' };
  }

  switch (action.type) {
    case 'mustPayRent':
      const owner = game.players.find(p => p.id === action.toPlayerId);
      if (owner) {
        player.money -= action.amount;
        owner.money += action.amount;
        game.gameLog.push(`${player.name} paid $${action.amount} rent to ${owner.name}`);
      }
      break;

    case 'mustPayTax':
    case 'mustPayCard':
    case 'mustPayRepairs':
      player.money -= action.amount;
      game.freeParkingMoney += action.amount;
      game.gameLog.push(`${player.name} paid $${action.amount}`);
      break;

    case 'mustPayPlayers':
      game.players.forEach(p => {
        if (!p.bankrupt && p.id !== player.id) {
          p.money += action.amountEach;
          player.money -= action.amountEach;
        }
      });
      game.gameLog.push(`${player.name} paid $${action.amountEach} to each player`);
      break;

    case 'mustRaiseFunds':
      player.money -= action.amount;
      player.inJail = false;
      player.jailTurns = 0;
      game.gameLog.push(`${player.name} paid $${action.amount} bail`);
      break;
  }

  game.pendingAction = null;
  game.turnPhase = 'rolled';

  return { success: true };
}

/**
 * Get current player
 */
function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

/**
 * Get public game state (safe to send to clients)
 */
function getGameState(game) {
  return {
    id: game.id,
    status: game.status,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      money: p.money,
      position: p.position,
      properties: p.properties,
      inJail: p.inJail,
      jailTurns: p.jailTurns,
      hasGetOutOfJailCard: p.hasGetOutOfJailCard,
      bankrupt: p.bankrupt,
      isAI: p.isAI || false
    })),
    currentPlayerIndex: game.currentPlayerIndex,
    turnPhase: game.turnPhase,
    lastDiceRoll: game.lastDiceRoll,
    properties: game.properties,
    freeParkingMoney: game.freeParkingMoney,
    currentCard: game.currentCard,
    pendingAction: game.pendingAction,
    gameLog: game.gameLog.slice(-20), // Last 20 log entries
    winner: game.winner
  };
}

module.exports = {
  createGame,
  addPlayer,
  removePlayer,
  startGame,
  handleRoll,
  buyProperty,
  declineBuy,
  buildHouse,
  sellHouse,
  mortgageProperty,
  unmortgageProperty,
  payBail,
  useJailCard,
  endTurn,
  declareBankruptcy,
  resolvePayment,
  getCurrentPlayer,
  getGameState,
  BOARD_SPACES
};
