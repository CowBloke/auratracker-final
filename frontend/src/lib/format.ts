/** Formatage unique des nombres et de la monnaie du jeu (l'euro, comme dans la barre du haut). */

export const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatMoney = (value: number, digits = 0) => `${formatNumber(value, digits)} €`;

/** Montant avec signe explicite pour les gains et pertes : « +1 200 € », « -300 € ». */
export const formatSignedMoney = (value: number, digits = 0) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatMoney(Math.abs(value), digits)}`;

/** Montant abrégé pour les grandes valeurs : « 1,2 M € ». */
export const formatCompactMoney = (value: number, digits = 1) => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${formatNumber(value / 1e9, 2)} Md €`;
  if (abs >= 1e6) return `${formatNumber(value / 1e6, 2)} M €`;
  if (abs >= 1e3) return `${formatNumber(value / 1e3, digits)} k €`;
  return formatMoney(value);
};

/** Récompenses de fin de partie : « +120 € · +5 aura » (chaîne vide s'il n'y a rien à afficher). */
export const formatRewards = (rewards: { money: number; aura: number } | null | undefined) => {
  if (!rewards) return '';
  return [rewards.money > 0 ? `+${formatMoney(rewards.money)}` : '', rewards.aura > 0 ? `+${formatNumber(rewards.aura)} aura` : '']
    .filter(Boolean)
    .join(' · ');
};
