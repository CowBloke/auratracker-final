/**
 * Monopoly Game Data
 * Contains all board spaces, property definitions, Chance and Community Chest cards
 */

// Property color groups and their build costs
const COLOR_GROUPS = {
  brown: { houseCost: 50, count: 2 },
  lightBlue: { houseCost: 50, count: 3 },
  pink: { houseCost: 100, count: 3 },
  orange: { houseCost: 100, count: 3 },
  red: { houseCost: 150, count: 3 },
  yellow: { houseCost: 150, count: 3 },
  green: { houseCost: 200, count: 3 },
  darkBlue: { houseCost: 200, count: 2 },
  railroad: { count: 4 },
  utility: { count: 2 }
};

// All 40 board spaces in order (starting from GO)
const BOARD_SPACES = [
  // Bottom row (right to left: 0-10)
  { id: 0, name: "GO", type: "go" },
  { id: 1, name: "Mediterranean Avenue", type: "property", price: 60, colorGroup: "brown", rent: [2, 10, 30, 90, 160, 250] },
  { id: 2, name: "Community Chest", type: "communityChest" },
  { id: 3, name: "Baltic Avenue", type: "property", price: 60, colorGroup: "brown", rent: [4, 20, 60, 180, 320, 450] },
  { id: 4, name: "Income Tax", type: "tax", amount: 200 },
  { id: 5, name: "Reading Railroad", type: "railroad", price: 200 },
  { id: 6, name: "Oriental Avenue", type: "property", price: 100, colorGroup: "lightBlue", rent: [6, 30, 90, 270, 400, 550] },
  { id: 7, name: "Chance", type: "chance" },
  { id: 8, name: "Vermont Avenue", type: "property", price: 100, colorGroup: "lightBlue", rent: [6, 30, 90, 270, 400, 550] },
  { id: 9, name: "Connecticut Avenue", type: "property", price: 120, colorGroup: "lightBlue", rent: [8, 40, 100, 300, 450, 600] },
  { id: 10, name: "Jail / Just Visiting", type: "jail" },

  // Left column (bottom to top: 11-19)
  { id: 11, name: "St. Charles Place", type: "property", price: 140, colorGroup: "pink", rent: [10, 50, 150, 450, 625, 750] },
  { id: 12, name: "Electric Company", type: "utility", price: 150 },
  { id: 13, name: "States Avenue", type: "property", price: 140, colorGroup: "pink", rent: [10, 50, 150, 450, 625, 750] },
  { id: 14, name: "Virginia Avenue", type: "property", price: 160, colorGroup: "pink", rent: [12, 60, 180, 500, 700, 900] },
  { id: 15, name: "Pennsylvania Railroad", type: "railroad", price: 200 },
  { id: 16, name: "St. James Place", type: "property", price: 180, colorGroup: "orange", rent: [14, 70, 200, 550, 750, 950] },
  { id: 17, name: "Community Chest", type: "communityChest" },
  { id: 18, name: "Tennessee Avenue", type: "property", price: 180, colorGroup: "orange", rent: [14, 70, 200, 550, 750, 950] },
  { id: 19, name: "New York Avenue", type: "property", price: 200, colorGroup: "orange", rent: [16, 80, 220, 600, 800, 1000] },
  { id: 20, name: "Free Parking", type: "freeParking" },

  // Top row (left to right: 21-29)
  { id: 21, name: "Kentucky Avenue", type: "property", price: 220, colorGroup: "red", rent: [18, 90, 250, 700, 875, 1050] },
  { id: 22, name: "Chance", type: "chance" },
  { id: 23, name: "Indiana Avenue", type: "property", price: 220, colorGroup: "red", rent: [18, 90, 250, 700, 875, 1050] },
  { id: 24, name: "Illinois Avenue", type: "property", price: 240, colorGroup: "red", rent: [20, 100, 300, 750, 925, 1100] },
  { id: 25, name: "B. & O. Railroad", type: "railroad", price: 200 },
  { id: 26, name: "Atlantic Avenue", type: "property", price: 260, colorGroup: "yellow", rent: [22, 110, 330, 800, 975, 1150] },
  { id: 27, name: "Ventnor Avenue", type: "property", price: 260, colorGroup: "yellow", rent: [22, 110, 330, 800, 975, 1150] },
  { id: 28, name: "Water Works", type: "utility", price: 150 },
  { id: 29, name: "Marvin Gardens", type: "property", price: 280, colorGroup: "yellow", rent: [24, 120, 360, 850, 1025, 1200] },
  { id: 30, name: "Go To Jail", type: "goToJail" },

  // Right column (top to bottom: 31-39)
  { id: 31, name: "Pacific Avenue", type: "property", price: 300, colorGroup: "green", rent: [26, 130, 390, 900, 1100, 1275] },
  { id: 32, name: "North Carolina Avenue", type: "property", price: 300, colorGroup: "green", rent: [26, 130, 390, 900, 1100, 1275] },
  { id: 33, name: "Community Chest", type: "communityChest" },
  { id: 34, name: "Pennsylvania Avenue", type: "property", price: 320, colorGroup: "green", rent: [28, 150, 450, 1000, 1200, 1400] },
  { id: 35, name: "Short Line", type: "railroad", price: 200 },
  { id: 36, name: "Chance", type: "chance" },
  { id: 37, name: "Park Place", type: "property", price: 350, colorGroup: "darkBlue", rent: [35, 175, 500, 1100, 1300, 1500] },
  { id: 38, name: "Luxury Tax", type: "tax", amount: 100 },
  { id: 39, name: "Boardwalk", type: "property", price: 400, colorGroup: "darkBlue", rent: [50, 200, 600, 1400, 1700, 2000] }
];

// Chance cards
const CHANCE_CARDS = [
  { id: 1, text: "Advance to GO. Collect $200.", action: "moveTo", destination: 0, collect: 200 },
  { id: 2, text: "Advance to Illinois Avenue. If you pass GO, collect $200.", action: "moveTo", destination: 24, passGo: true },
  { id: 3, text: "Advance to St. Charles Place. If you pass GO, collect $200.", action: "moveTo", destination: 11, passGo: true },
  { id: 4, text: "Advance to nearest Utility. If unowned, you may buy it. If owned, throw dice and pay 10x amount thrown.", action: "nearestUtility" },
  { id: 5, text: "Advance to nearest Railroad. Pay owner twice the normal rent.", action: "nearestRailroad" },
  { id: 6, text: "Bank pays you dividend of $50.", action: "collect", amount: 50 },
  { id: 7, text: "Get Out of Jail Free.", action: "getOutOfJailCard" },
  { id: 8, text: "Go back 3 spaces.", action: "moveBack", spaces: 3 },
  { id: 9, text: "Go to Jail. Do not pass GO, do not collect $200.", action: "goToJail" },
  { id: 10, text: "Make general repairs on all your property: $25 per house, $100 per hotel.", action: "repairs", houseCost: 25, hotelCost: 100 },
  { id: 11, text: "Pay poor tax of $15.", action: "pay", amount: 15 },
  { id: 12, text: "Take a trip to Reading Railroad. If you pass GO, collect $200.", action: "moveTo", destination: 5, passGo: true },
  { id: 13, text: "Advance to Boardwalk.", action: "moveTo", destination: 39 },
  { id: 14, text: "You have been elected Chairman of the Board. Pay each player $50.", action: "payEachPlayer", amount: 50 },
  { id: 15, text: "Your building loan matures. Collect $150.", action: "collect", amount: 150 },
  { id: 16, text: "You have won a crossword competition. Collect $100.", action: "collect", amount: 100 }
];

// Community Chest cards
const COMMUNITY_CHEST_CARDS = [
  { id: 1, text: "Advance to GO. Collect $200.", action: "moveTo", destination: 0, collect: 200 },
  { id: 2, text: "Bank error in your favor. Collect $200.", action: "collect", amount: 200 },
  { id: 3, text: "Doctor's fees. Pay $50.", action: "pay", amount: 50 },
  { id: 4, text: "From sale of stock you get $50.", action: "collect", amount: 50 },
  { id: 5, text: "Get Out of Jail Free.", action: "getOutOfJailCard" },
  { id: 6, text: "Go to Jail. Do not pass GO, do not collect $200.", action: "goToJail" },
  { id: 7, text: "Holiday fund matures. Collect $100.", action: "collect", amount: 100 },
  { id: 8, text: "Income tax refund. Collect $20.", action: "collect", amount: 20 },
  { id: 9, text: "It is your birthday. Collect $10 from every player.", action: "collectFromEachPlayer", amount: 10 },
  { id: 10, text: "Life insurance matures. Collect $100.", action: "collect", amount: 100 },
  { id: 11, text: "Hospital fees. Pay $100.", action: "pay", amount: 100 },
  { id: 12, text: "School fees. Pay $50.", action: "pay", amount: 50 },
  { id: 13, text: "Receive $25 consultancy fee.", action: "collect", amount: 25 },
  { id: 14, text: "You are assessed for street repairs: $40 per house, $115 per hotel.", action: "repairs", houseCost: 40, hotelCost: 115 },
  { id: 15, text: "You have won second prize in a beauty contest. Collect $10.", action: "collect", amount: 10 },
  { id: 16, text: "You inherit $100.", action: "collect", amount: 100 }
];

// Player token colors
const PLAYER_COLORS = [
  { name: "Red", hex: "#e74c3c" },
  { name: "Blue", hex: "#3498db" },
  { name: "Green", hex: "#2ecc71" },
  { name: "Yellow", hex: "#f1c40f" },
  { name: "Purple", hex: "#9b59b6" },
  { name: "Orange", hex: "#e67e22" },
  { name: "Cyan", hex: "#1abc9c" },
  { name: "Pink", hex: "#fd79a8" }
];

// Color group CSS colors for properties
const COLOR_GROUP_CSS = {
  brown: "#8B4513",
  lightBlue: "#87CEEB",
  pink: "#FF69B4",
  orange: "#FFA500",
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#008000",
  darkBlue: "#00008B",
  railroad: "#000000",
  utility: "#FFFFFF"
};

// Starting money for each player
const STARTING_MONEY = 1500;

// GO salary
const GO_SALARY = 200;

// Jail position
const JAIL_POSITION = 10;

// Go to Jail position
const GO_TO_JAIL_POSITION = 30;

// Bail amount
const JAIL_BAIL = 50;

// Maximum houses per property (before hotel)
const MAX_HOUSES = 4;

// Railroad rent based on number owned
const RAILROAD_RENT = [25, 50, 100, 200];

module.exports = {
  BOARD_SPACES,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  PLAYER_COLORS,
  COLOR_GROUPS,
  COLOR_GROUP_CSS,
  STARTING_MONEY,
  GO_SALARY,
  JAIL_POSITION,
  GO_TO_JAIL_POSITION,
  JAIL_BAIL,
  MAX_HOUSES,
  RAILROAD_RENT
};
