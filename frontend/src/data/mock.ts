export const dashboardMockPublicParties = [
  {
    id: 'mock-party-1',
    name: 'Nebula Rush',
    memberCount: 4,
    maxSize: 6,
    isPublic: true,
    selectedGame: {
      gameName: 'Bomb Party',
    },
  },
  {
    id: 'mock-party-2',
    name: 'Turbo Trackers',
    memberCount: 3,
    maxSize: 5,
    isPublic: true,
    selectedGame: {
      gameName: 'Racer',
    },
  },
  {
    id: 'mock-party-3',
    name: 'Mind Arena',
    memberCount: 2,
    maxSize: 4,
    isPublic: true,
    selectedGame: {
      gameName: '2048',
    },
  },
];

export const dashboardMockClanWars = [
  {
    id: 'mock-war-1',
    status: 'ACTIVE',
    startsAt: '2026-03-29T08:00:00.000Z',
    endsAt: '2026-03-30T08:00:00.000Z',
    targetScore: 180,
    attackerScore: 122,
    defenderScore: 117,
    scoreGap: 5,
    attackerClan: {
      id: 'mock-clan-1',
      name: 'Les Nebuleux',
      imageUrl: '/images/mock/clan-nebula.svg',
    },
    defenderClan: {
      id: 'mock-clan-2',
      name: 'Orbit Exchange',
      imageUrl: '/images/mock/jared-rice-qzgmZKsyVsQ-unsplash.jpg',
    },
  },
  {
    id: 'mock-war-2',
    status: 'PREPARING',
    startsAt: '2026-03-29T22:00:00.000Z',
    endsAt: '2026-03-30T22:00:00.000Z',
    targetScore: 200,
    attackerScore: 0,
    defenderScore: 0,
    scoreGap: 0,
    attackerClan: {
      id: 'mock-clan-3',
      name: 'Voltage Drift',
      imageUrl: '/images/mock/nir-himi-gSIjbABf9sc-unsplash.jpg',
    },
    defenderClan: {
      id: 'mock-clan-4',
      name: 'Support Squad',
      imageUrl: '/images/mock/matthew-mosbauer-7DV_dT3JuLs-unsplash.jpg',
    },
  },
];