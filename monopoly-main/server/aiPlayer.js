/**
 * AI Player Logic for Monopoly
 * Implements decision-making for computer-controlled players
 */

const { BOARD_SPACES, COLOR_GROUPS } = require('./gameData');

// AI difficulty levels and their risk tolerance
const AI_PERSONALITIES = {
  conservative: {
    minCashReserve: 300,
    buyThreshold: 0.7, // Will buy if price < 70% of money
    buildThreshold: 0.5,
    mortgageThreshold: 100, // Mortgage when below this cash
    unmortgageThreshold: 500 // Unmortgage when above this cash
  },
  balanced: {
    minCashReserve: 200,
    buyThreshold: 0.85,
    buildThreshold: 0.6,
    mortgageThreshold: 50,
    unmortgageThreshold: 400
  },
  aggressive: {
    minCashReserve: 100,
    buyThreshold: 0.95,
    buildThreshold: 0.75,
    mortgageThreshold: 25,
    unmortgageThreshold: 300
  }
};

/**
 * Get AI decision for buying a property
 */
function shouldBuyProperty(game, player, space) {
  const personality = getPersonality(player);

  // Always buy railroads and utilities if affordable
  if (space.type === 'railroad' || space.type === 'utility') {
    return player.money - space.price >= personality.minCashReserve;
  }

  // Check if we already own properties in this color group
  const colorGroup = space.colorGroup;
  const groupProperties = BOARD_SPACES.filter(s => s.colorGroup === colorGroup);
  const ownedInGroup = groupProperties.filter(s =>
    game.properties[s.id] && game.properties[s.id].ownerId === player.id
  ).length;

  // More likely to buy if we already own properties in this group
  const groupBonus = ownedInGroup > 0 ? 0.2 : 0;

  // Check if buying would complete a monopoly
  const wouldCompleteMonopoly = ownedInGroup === groupProperties.length - 1;
  if (wouldCompleteMonopoly && player.money >= space.price) {
    return true; // Always complete monopolies
  }

  // Standard buying decision
  const priceRatio = space.price / player.money;
  const threshold = personality.buyThreshold + groupBonus;

  return priceRatio <= threshold &&
         player.money - space.price >= personality.minCashReserve;
}

/**
 * Get AI decision for building houses
 */
function getBuildDecisions(game, player) {
  const personality = getPersonality(player);
  const decisions = [];

  // Get all monopolies owned by player
  const monopolies = getPlayerMonopolies(game, player);

  for (const colorGroup of monopolies) {
    const groupProps = BOARD_SPACES.filter(s => s.colorGroup === colorGroup);
    const buildCost = COLOR_GROUPS[colorGroup].houseCost;

    // Find property with least houses that can be built on
    let minHouses = 5;
    let targetProp = null;

    for (const prop of groupProps) {
      const propState = game.properties[prop.id];
      if (!propState.mortgaged && propState.houses < 5 && propState.houses < minHouses) {
        minHouses = propState.houses;
        targetProp = prop;
      }
    }

    // Decide whether to build
    if (targetProp && player.money >= buildCost) {
      const cashAfter = player.money - buildCost;
      if (cashAfter >= personality.minCashReserve) {
        decisions.push({
          action: 'buildHouse',
          propertyId: targetProp.id,
          cost: buildCost
        });
      }
    }
  }

  return decisions;
}

/**
 * Get AI decision for mortgage/unmortgage
 */
function getFinancialDecisions(game, player) {
  const personality = getPersonality(player);
  const decisions = [];

  // Need to mortgage?
  if (player.money < personality.mortgageThreshold) {
    // Find properties to mortgage (prefer those not in monopolies)
    const propsToMortgage = player.properties
      .map(id => ({ id, space: BOARD_SPACES[id], state: game.properties[id] }))
      .filter(p => !p.state.mortgaged && p.state.houses === 0)
      .sort((a, b) => {
        // Prefer mortgaging non-monopoly properties
        const aInMonopoly = isInMonopoly(game, player, a.id);
        const bInMonopoly = isInMonopoly(game, player, b.id);
        if (aInMonopoly !== bInMonopoly) return aInMonopoly ? 1 : -1;
        // Then prefer lower value properties
        return (a.space.price || 0) - (b.space.price || 0);
      });

    if (propsToMortgage.length > 0) {
      decisions.push({
        action: 'mortgage',
        propertyId: propsToMortgage[0].id
      });
    }
  }

  // Can unmortgage?
  if (player.money > personality.unmortgageThreshold) {
    const propsToUnmortgage = player.properties
      .map(id => ({ id, space: BOARD_SPACES[id], state: game.properties[id] }))
      .filter(p => p.state.mortgaged)
      .sort((a, b) => {
        // Prefer unmortgaging monopoly properties first
        const aInMonopoly = wouldCompleteMonopoly(game, player, a.id);
        const bInMonopoly = wouldCompleteMonopoly(game, player, b.id);
        if (aInMonopoly !== bInMonopoly) return aInMonopoly ? -1 : 1;
        return (b.space.price || 0) - (a.space.price || 0);
      });

    for (const prop of propsToUnmortgage) {
      const unmortgageCost = Math.floor(prop.space.price / 2 * 1.1);
      if (player.money - unmortgageCost >= personality.minCashReserve) {
        decisions.push({
          action: 'unmortgage',
          propertyId: prop.id
        });
        break;
      }
    }
  }

  return decisions;
}

/**
 * Get AI decision for jail
 */
function shouldPayBail(game, player) {
  const personality = getPersonality(player);

  // Always use jail card if available
  if (player.hasGetOutOfJailCard) {
    return { action: 'useCard' };
  }

  // Early game: stay in jail is often good
  const totalProperties = Object.values(game.properties).filter(p => p.ownerId).length;
  const earlyGame = totalProperties < 15;

  if (earlyGame && player.jailTurns < 2) {
    return { action: 'stay' }; // Try to roll doubles
  }

  // Late game or low on cash: pay bail if affordable
  if (player.money >= 50 && player.money - 50 >= personality.minCashReserve) {
    return { action: 'payBail' };
  }

  return { action: 'stay' };
}

/**
 * Check if player should declare bankruptcy or try to survive
 */
function shouldDeclareBankruptcy(game, player, amountOwed) {
  // Calculate total asset value
  let totalAssets = player.money;

  for (const propId of player.properties) {
    const prop = game.properties[propId];
    const space = BOARD_SPACES[propId];

    if (!prop.mortgaged) {
      totalAssets += Math.floor(space.price / 2);
    }

    // Houses can be sold at half price
    if (prop.houses > 0 && space.colorGroup) {
      const houseValue = COLOR_GROUPS[space.colorGroup].houseCost / 2;
      totalAssets += prop.houses * houseValue;
    }
  }

  // If we can pay the debt, don't go bankrupt
  return totalAssets < amountOwed;
}

// Helper functions

function getPersonality(player) {
  // Assign personality based on player index or random
  const personalities = Object.keys(AI_PERSONALITIES);
  const index = player.aiPersonalityIndex || 0;
  return AI_PERSONALITIES[personalities[index % personalities.length]];
}

function getPlayerMonopolies(game, player) {
  const monopolies = [];
  const colorGroups = ['brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue'];

  for (const colorGroup of colorGroups) {
    const groupProps = BOARD_SPACES.filter(s => s.colorGroup === colorGroup);
    const ownsAll = groupProps.every(s =>
      game.properties[s.id] && game.properties[s.id].ownerId === player.id
    );
    if (ownsAll) {
      monopolies.push(colorGroup);
    }
  }

  return monopolies;
}

function isInMonopoly(game, player, propertyId) {
  const space = BOARD_SPACES[propertyId];
  if (!space.colorGroup) return false;

  const groupProps = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
  return groupProps.every(s =>
    game.properties[s.id] && game.properties[s.id].ownerId === player.id
  );
}

function wouldCompleteMonopoly(game, player, propertyId) {
  const space = BOARD_SPACES[propertyId];
  if (!space.colorGroup) return false;

  const groupProps = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
  const ownedCount = groupProps.filter(s =>
    game.properties[s.id] &&
    (game.properties[s.id].ownerId === player.id || s.id === propertyId)
  ).length;

  return ownedCount === groupProps.length;
}

/**
 * Execute AI turn with delays for visibility
 */
async function executeAITurn(game, player, gameLogic, broadcastUpdate) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // AI thinking delay
  await delay(1000);

  // Handle jail first
  if (player.inJail) {
    const jailDecision = shouldPayBail(game, player);

    if (jailDecision.action === 'useCard' && player.hasGetOutOfJailCard) {
      gameLogic.useJailCard(game, player.id);
      broadcastUpdate();
      await delay(500);
    } else if (jailDecision.action === 'payBail' && player.money >= 50) {
      gameLogic.payBail(game, player.id);
      broadcastUpdate();
      await delay(500);
    }
  }

  // Roll dice
  if (game.turnPhase === 'waiting') {
    const rollResult = gameLogic.handleRoll(game, player.id);
    broadcastUpdate();
    await delay(1500);

    if (!rollResult.success) {
      return;
    }
  }

  // Handle buying phase
  if (game.turnPhase === 'buying') {
    const space = BOARD_SPACES[player.position];

    if (shouldBuyProperty(game, player, space)) {
      gameLogic.buyProperty(game, player.id);
    } else {
      gameLogic.declineBuy(game, player.id);
    }
    broadcastUpdate();
    await delay(1000);
  }

  // Handle action required (debts)
  if (game.turnPhase === 'actionRequired' && game.pendingAction) {
    const amountOwed = game.pendingAction.amount;

    // Try to raise funds through mortgaging
    while (player.money < amountOwed && player.properties.length > 0) {
      const decisions = getFinancialDecisions(game, player);
      const mortgageDecision = decisions.find(d => d.action === 'mortgage');

      if (mortgageDecision) {
        gameLogic.mortgageProperty(game, player.id, mortgageDecision.propertyId);
        broadcastUpdate();
        await delay(500);
      } else {
        break;
      }
    }

    // Try to pay or go bankrupt
    if (player.money >= amountOwed) {
      gameLogic.resolvePayment(game, player.id);
    } else {
      gameLogic.declareBankruptcy(game, player.id, game.pendingAction.toPlayerId);
    }
    broadcastUpdate();
    await delay(1000);
  }

  // Building phase (after rolled, before ending turn)
  if (game.turnPhase === 'rolled' && !player.bankrupt) {
    const buildDecisions = getBuildDecisions(game, player);

    for (const decision of buildDecisions.slice(0, 3)) { // Max 3 builds per turn
      if (decision.action === 'buildHouse') {
        const result = gameLogic.buildHouse(game, player.id, decision.propertyId);
        if (result.success) {
          broadcastUpdate();
          await delay(700);
        }
      }
    }

    // Unmortgage if we have extra cash
    const financialDecisions = getFinancialDecisions(game, player);
    for (const decision of financialDecisions) {
      if (decision.action === 'unmortgage') {
        const result = gameLogic.unmortgageProperty(game, player.id, decision.propertyId);
        if (result.success) {
          broadcastUpdate();
          await delay(700);
        }
      }
    }
  }

  // End turn
  if (game.turnPhase === 'rolled' && !player.bankrupt) {
    await delay(500);
    const endResult = gameLogic.endTurn(game, player.id);
    broadcastUpdate();

    // If rolled doubles, continue AI turn
    if (endResult.rollAgain) {
      await delay(1000);
      await executeAITurn(game, player, gameLogic, broadcastUpdate);
    }
  }
}

module.exports = {
  shouldBuyProperty,
  getBuildDecisions,
  getFinancialDecisions,
  shouldPayBail,
  shouldDeclareBankruptcy,
  executeAITurn,
  AI_PERSONALITIES
};
