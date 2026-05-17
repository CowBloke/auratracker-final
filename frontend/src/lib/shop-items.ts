// Hardcoded shop item definitions — edit freely.
// Arc en ciel excluded. ADblock price bumped.

export type ShopItemCategory = 'COSMETIC' | 'CLAN_UPGRADES' | 'DOODLE_SKIN' | 'UPGRADE';

export interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  type: ShopItemCategory;
  price: number;
  imageUrl: string | null;
  effect: Record<string, unknown>;
  expiresAt: string | null;
  /** If set, this item can be crafted by businesses and bought on the items market. */
  craftableResourceType?: string;
}

export const SHOP_ITEM_DEFS: ShopItemDef[] = [
  // ── Cosmétiques ──────────────────────────────────────────────────────────
  {
    id: 'adblock',
    name: 'ADblock',
    description: 'Bloque les publicités pendant 60 minutes.',
    type: 'COSMETIC',
    price: 500,
    imageUrl:
      'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fcdn.pnggallery.com%2Fwp-content%2Fuploads%2Fadblock-logo-01.png&f=1&nofb=1&ipt=57ebca1a4b44c807f042bd85350df0c5174a161b9c7c39185df1695a6ff1b296',
    effect: { type: 'YOU_ADBLOCK', durationMinutes: 60 },
    expiresAt: null,
    craftableResourceType: 'ADBLOCK_TOKEN',
  },
  {
    id: 'jus_malakoukou',
    name: 'Jus de malakoukou',
    description: 'Change ta bannière de profil.',
    type: 'COSMETIC',
    price: 10000,
    imageUrl: '/api/uploads/items/1774610183701-4551f1b4-ae03-424f-bbb9-4ce9ed31b5a8.png',
    effect: { type: 'PROFILE_BANNER' },
    expiresAt: null,
    craftableResourceType: 'JUICE_MALAKOUKOU',
  },
  {
    id: 'badge_perso',
    name: 'Badge personnalisé',
    description:
      "Vous permet de proposer un badge personnalisé. Le badge doit être accepté par l'admin d'abord ; en cas de refus, vous serez remboursé.",
    type: 'COSMETIC',
    price: 150000,
    imageUrl: '/api/uploads/items/1774423042264-0ea333be-a908-4e31-85ec-baa0d6378f3b.png',
    effect: { type: 'CUSTOM_BADGE' },
    expiresAt: null,
  },
  {
    id: 'jus_abricot',
    name: "Jus d'abricot",
    description: 'Change ta photo de profil.',
    type: 'COSMETIC',
    price: 100,
    imageUrl:
      'https://imgs.search.brave.com/K6wRuusBZppArHJO9F2di6s_PQu6ycQ3ZOKB31roLXY/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9ib3V0/aXF1ZS5iZXJuaWVl/dHZpbmNlbnQuZnIv/NjYtcGR0XzM2MC9q/dXMtZGUtZnJ1aXQt/YWJyaWNvdC0xbC5q/cGc',
    effect: { type: 'PROFILE_PICTURE', value: '' },
    expiresAt: null,
    craftableResourceType: 'JUICE_ABRICOT',
  },
  {
    id: 'jus_gingembre',
    name: 'Jus de gingembre',
    description: 'Change la couleur de ton pseudo.',
    type: 'COSMETIC',
    price: 100,
    imageUrl:
      'https://imgs.search.brave.com/Jdbnf6DEsYFoqedp4YZpaDE_Szcv7ScLfggZROJSEEA/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3RpL3Bob3Rv/cy1ncmF0dWl0ZS90/Mi8zODE1MzI5LXZl/cnJlLWRlLWp1cy1k/ZS1naW5nZW1icmUt/ZnJhaXMtZXQtY2hh/dWQtcGhvdG8uanBn',
    effect: { type: 'USERNAME_COLOR', value: '' },
    expiresAt: null,
    craftableResourceType: 'JUICE_GINGEMBRE',
  },
  // ── Upgrades ─────────────────────────────────────────────────────────────
  {
    id: 'jus_goyave',
    name: 'Jus de Goyave',
    description: '+10 aura permanent.',
    type: 'UPGRADE',
    price: 1000000,
    imageUrl:
      'https://imgs.search.brave.com/2l18OpI8q8_rHmtHCIf0o025oBHoNhPc7nG20zaDfhc/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tLm1l/ZGlhLWFtYXpvbi5j/b20vaW1hZ2VzL0kv/NzF5bXF6SXNBMUwu/anBn',
    effect: { type: 'BONUS_AURA', bonusAura: 10 },
    expiresAt: null,
    craftableResourceType: 'JUICE_GOYAVE',
  },
  {
    id: 'jus_papaye',
    name: 'Jus de papaye',
    description: '+100 argent.',
    type: 'UPGRADE',
    price: 10000,
    imageUrl:
      'https://imgs.search.brave.com/ojR2FUN6TKABVkGehejVngZBelGLh-D_OGZFfQo_qZI/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tLm1l/ZGlhLWFtYXpvbi5j/b20vaW1hZ2VzL0kv/NDE5WHZpdHh2eEwu/anBn',
    effect: { type: 'BONUS_MONEY', bonusMoney: 100 },
    expiresAt: null,
    craftableResourceType: 'JUICE_PAPAYE',
  },
  // ── Améliorations de clan ─────────────────────────────────────────────────
  {
    id: 'clan_banner',
    name: 'Bannière de clan',
    description: "Ajoute une photo qui s'affichera quand le clan est sélectionné sur la page clan.",
    type: 'CLAN_UPGRADES',
    price: 1000,
    imageUrl:
      'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fcdn.pixabay.com%2Fphoto%2F2017%2F08%2F19%2F04%2F05%2Finternational-2657342_1280.png&f=1&nofb=1&ipt=27b4dfe33cd766d936d168c33fe4317dc8d439e02d110cf3b92b80491f1a74e4',
    effect: { type: 'CLAN_BANNER' },
    expiresAt: null,
  },
  {
    id: 'clan_slot',
    name: '+1 membre clan',
    description:
      "Ajoute un slot membre supplémentaire au clan. Un clan ne peut l'acheter qu'une fois. S'applique automatiquement.",
    type: 'CLAN_UPGRADES',
    price: 20000,
    imageUrl: '/api/uploads/items/1774093075126-2a84b078-a73b-405c-8f72-d1454809aa65.png',
    effect: { type: 'CLAN_SLOT_UPGRADE' },
    expiresAt: null,
  },
  {
    id: 'clan_tag',
    name: 'Tag de Clan',
    description: 'Permet de donner un tag à tous les membres du clan avec un style customisable.',
    type: 'CLAN_UPGRADES',
    price: 5000,
    imageUrl: '/api/uploads/items/1773423397272-b9251f08-2ae7-4a17-a791-d84aed2b2bd0.webp',
    effect: { type: 'CLAN_TAG_UNLOCK', value: '' },
    expiresAt: null,
  },
  // ── Skins Doodle Jump ─────────────────────────────────────────────────────
  {
    id: 'skin_mj',
    name: 'MJ',
    description: 'Skin DJ',
    type: 'DOODLE_SKIN',
    price: 100,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1774611777658-cb9e0c67-8d64-4f43-ae84-72ea1c172886.png',
      shopType: 'static',
    },
    expiresAt: null,
  },
  {
    id: 'skin_rv_chemise',
    name: 'RV chemise',
    description: 'Encore ce bg sur une troisième photo — skin Doodle Jump.',
    type: 'DOODLE_SKIN',
    price: 100000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773668020853-6a4d5ef9-b15d-4131-9a35-466596c5ff29.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_herve2',
    name: 'Hervé le bg 2',
    description: 'Deuxième photo de Hervé le bg.',
    type: 'DOODLE_SKIN',
    price: 1000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773667738316-7e7f6e63-92b9-45bc-800b-5fcd0074f726.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_doodle',
    name: 'Doodle Jump',
    description: 'Skin Doodle Jump classique.',
    type: 'DOODLE_SKIN',
    price: 1500,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773427341488-5f462c1c-f562-4ada-9454-6d9072ecf98b.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_herve',
    name: 'Hervé de Sailly',
    description: 'RV le bg.',
    type: 'DOODLE_SKIN',
    price: 10000,
    imageUrl: '/api/uploads/items/1773387397739-b5b165da-1273-4690-a9be-9f6d83ea3d28.jpg',
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773387500120-65dbf8b3-dc3e-4291-8f6d-2230e6fa899a.jpg',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_scooby',
    name: 'Scooby Doo',
    description: 'Un skin DJ.',
    type: 'DOODLE_SKIN',
    price: 8000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773410205012-bb14af3a-3daa-4d79-beb7-af13979c014a.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_chien',
    name: 'Chien drôle',
    description: 'Un skin Doodle Jump.',
    type: 'DOODLE_SKIN',
    price: 3000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773409138070-82209b73-667f-444c-b7ab-d2d840858cb7.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_netanyahu',
    name: 'Netanyahu',
    description: 'Skin Doodle Jump.',
    type: 'DOODLE_SKIN',
    price: 2000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1773045834176-68fb74c5-d9aa-477e-88f8-becf1491f7ec.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_cat',
    name: 'Cat',
    description: 'Skin DJ.',
    type: 'DOODLE_SKIN',
    price: 1000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl:
        'https://images.rawpixel.com/image_png_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTExL2ZsMTUyNDUzMTY5NDctaW1hZ2Utam9iMTQzMl8xLnBuZw.png',
    },
    expiresAt: null,
  },
  {
    id: 'skin_donald',
    name: 'Donald',
    description: 'Skin DJ.',
    type: 'DOODLE_SKIN',
    price: 1000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1774806385587-5c313d22-c884-48c3-bc41-bf4c6648377a.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_stormtrooper',
    name: 'Stormtrooper',
    description: 'Skin Doodle Jump.',
    type: 'DOODLE_SKIN',
    price: 1000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1774806330330-33f9e627-4d77-4aa8-8c8b-29c84dc58835.png',
    },
    expiresAt: null,
  },
  {
    id: 'skin_flappy',
    name: 'Flappy bird',
    description: 'Skin.',
    type: 'DOODLE_SKIN',
    price: 1000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl:
        'https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=1200,height=1200,fit=cover,f=png/5e0df231478aa0a331a4718d09dd91a2/flappy-bird.png',
      shopType: 'rotating',
    },
    expiresAt: null,
  },
  {
    id: 'skin_chatgpt',
    name: 'ChatGPT',
    description: 'Un skin ChatGPT pour Doodle Jump.',
    type: 'DOODLE_SKIN',
    price: 10000,
    imageUrl: null,
    effect: {
      type: 'DOODLE_JUMP_SKIN',
      skinImageUrl: '/api/uploads/items/1772971231582-9a29d7fb-faa7-4e62-be91-b100cacb5381.png',
    },
    expiresAt: null,
  },
];

/** Items that can be crafted by businesses and bought on the items market. */
export const CRAFTABLE_ITEMS = SHOP_ITEM_DEFS.filter((i) => !!i.craftableResourceType);

/** Resource types that correspond to craftable items. */
export const ITEM_RESOURCE_TYPES = new Set(
  CRAFTABLE_ITEMS.map((i) => i.craftableResourceType as string),
);
