type PartyDisplayMember = {
  username: string;
  isLeader: boolean;
};

type PartyDisplayCandidate = {
  name: string | null | undefined;
  maxSize: number;
  members?: PartyDisplayMember[];
};

export function getPartyDisplayName(party: PartyDisplayCandidate): string {
  const explicitName = party.name?.trim();
  if (explicitName) return explicitName;

  const creatorName = party.members?.find((member) => member.isLeader)?.username?.trim();
  if (creatorName) {
    return party.maxSize === 2 ? `Duel de ${creatorName}` : `Groupe de ${creatorName}`;
  }

  return party.maxSize === 2 ? 'Duel du createur' : 'Groupe du createur';
}
