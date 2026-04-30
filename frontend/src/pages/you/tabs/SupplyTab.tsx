import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Briefcase,
  Building2,
  Check,
  Gavel,
  GraduationCap,
  Hammer,
  Landmark,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Tag,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import {
  youApi,
  type YouBusiness,
  type YouBusinessMember,
  type YouBusinessType,
  type YouPlayer,
  type YouSupplyBusiness,
  type YouConstructionMaterial,
  type YouSupplyContract,
  type YouSupplyInventory,
  type YouSupplyOffer,
  type YouSupplyResourceType,
  type YouSupplyState,
} from '@/services/api';
import { CreateBusinessModal, InvitePlayersModal, ManageBusinessModal } from '../components/modals';

type Selection = { kind: 'business'; id: string } | null;
type NodeSelection =
  | { kind: 'inventory'; business: YouSupplyBusiness; inventory: YouSupplyInventory }
  | { kind: 'construction-material'; business: YouSupplyBusiness; material: YouConstructionMaterial }
  | { kind: 'offer'; business: YouSupplyBusiness; offer: YouSupplyOffer }
  | { kind: 'contract'; business: YouSupplyBusiness; contract: YouSupplyContract }
  | { kind: 'loan' | 'case' | 'formation' | 'startup' | 'account' | 'transfer' | 'team'; business: YouSupplyBusiness; item: any }
  | null;
type Vec2 = { x: number; y: number };
type Positions = Record<string, Vec2>;

const CARD_SIZE = 118;
const CONSTRUCTION_STRIPES = 'repeating-linear-gradient(135deg, #facc15 0 8px, #111827 8px 16px)';
const RESOURCE_HEX: Record<string, string> = {
  WOOD: '#fbbf24', STONE: '#94a3b8', IRON: '#a1a1aa', FOOD: '#4ade80',
  CLOTH: '#fb7185', CONCRETE: '#9ca3af', STEEL: '#60a5fa', FUEL: '#fb923c',
  PAPER: '#facc15', LUXURY_GOODS: '#a78bfa', MEDICINE: '#34d399', DATA: '#22d3ee',
  CONTRABAND: '#f87171',
};

const BIZ_COLOR: Record<string, string> = {
  lemonade: '#22c55e',
  farm: '#22c55e',
  sawmill: '#f59e0b',
  quarry: '#64748b',
  iron_mine: '#71717a',
  fuel_refinery: '#f97316',
  textile_mill: '#fb7185',
  restaurant: '#e11d48',
  coffee_shop: '#a16207',
  epicerie: '#84cc16',
  youtube: '#ef4444',
  medecins: '#10b981',
  startup: '#3b82f6',
  agency: '#8b5cf6',
  bank: '#eab308',
  transfer: '#14b8a6',
  formation: '#6366f1',
  law_firm: '#06b6d4',
  illegal_market: '#dc2626',
  supreme_court: '#0f172a',
};
const BIZ_MONO: Record<string, string> = {
  lemonade: 'LM',
  farm: 'FM',
  sawmill: 'SW',
  quarry: 'QR',
  iron_mine: 'IR',
  fuel_refinery: 'RF',
  textile_mill: 'TX',
  restaurant: 'RS',
  coffee_shop: 'CF',
  epicerie: 'EP',
  youtube: 'YT',
  medecins: 'MD',
  startup: 'ST',
  agency: 'AG',
  bank: 'BK',
  transfer: 'TR',
  formation: 'FO',
  law_firm: 'LW',
  illegal_market: 'IM',
  supreme_court: 'SC',
};
const BIZ_LABEL: Record<string, string> = {
  lemonade: 'Stand de limonade',
  farm: 'Ferme',
  sawmill: 'Scierie',
  quarry: 'Carriere',
  iron_mine: 'Mine de fer',
  fuel_refinery: 'Raffinerie',
  textile_mill: 'Manufacture textile',
  restaurant: 'Restaurant',
  coffee_shop: 'Coffee shop',
  epicerie: 'Epicerie',
  youtube: 'Chaine YouTube',
  medecins: 'Cabinet medical',
  startup: 'Startup',
  agency: 'Agence immobiliere',
  bank: 'Banque',
  transfer: 'Service de transfert',
  formation: 'Centre de formation',
  law_firm: "Cabinet d'avocats",
  illegal_market: 'Marche noir',
  supreme_court: 'Cour Supreme',
};
const BIZ_DESC: Record<string, string> = {
  lemonade: 'Votre stand produit de la nourriture et attire les premiers clients du marche.',
  farm: 'La ferme genere de la nourriture en continu, base de toute la chaine alimentaire.',
  sawmill: 'La scierie transforme les ressources naturelles en bois pour la construction.',
  quarry: 'La carriere extrait pierre et beton, materiaux essentiels pour batir l\'avenir.',
  iron_mine: 'La mine produit fer et acier, piliers de l\'industrie lourde.',
  fuel_refinery: 'La raffinerie produit le carburant qui fait tourner l\'ensemble de l\'economie.',
  textile_mill: 'La manufacture transforme les fibres en tissus pour le commerce.',
  restaurant: 'Le restaurant sert des repas et genere de la nourriture transformee a fort rendement.',
  coffee_shop: 'Le coffee shop produit boissons et articles de luxe pour une clientele premium.',
  epicerie: 'L\'epicerie distribue des produits de luxe directement aux consommateurs.',
  youtube: 'La chaine produit du contenu numerique et valorise les donnees du marche.',
  medecins: 'Le cabinet genere des medicaments et soigne la communaute contre remuneration.',
  startup: 'La startup developpe des produits technologiques et monetise les donnees.',
  agency: 'L\'agence immobiliere genere des revenus sur des transactions exclusives a forte valeur.',
  bank: 'La banque offre des prets et des comptes bancaires a vos clients.',
  transfer: 'Le service de transfert facilite les echanges monetaires entre les joueurs.',
  formation: 'Le centre de formation vend des formations educatives en ligne.',
  law_firm: 'Le cabinet d\'avocats gere les litiges et defend vos interets juridiques.',
  illegal_market: 'Le marche noir commercialise des biens rares hors des circuits officiels.',
};

function money(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} money`;
}

function resourceLabel(resourceType: string) {
  return RESOURCE_META[resourceType as ResourceType]?.label ?? resourceType;
}

function businessColor(typeKey: string) {
  return BIZ_COLOR[typeKey] ?? '#9ca3af';
}

function useDragCanvas(initPositions: Positions) {
  const [positions, setPositions] = useState<Positions>(initPositions);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const modeRef = useRef<'idle' | 'card' | 'pan'>('idle');
  const activeIdRef = useRef<string | null>(null);
  const offsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const panStartRef = useRef<Vec2>({ x: 0, y: 0 });
  const panOriginRef = useRef<Vec2>({ x: 0, y: 0 });

  useEffect(() => {
    setPositions(initPositions);
    setPan({ x: 0, y: 0 });
  }, [initPositions]);

  function startDrag(id: string, e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const pos = positions[id] ?? { x: 0, y: 0 };
    const mx = e.clientX - rect.left - panRef.current.x;
    const my = e.clientY - rect.top - panRef.current.y;
    offsetRef.current = { x: mx - pos.x, y: my - pos.y };
    modeRef.current = 'card';
    activeIdRef.current = id;
    e.preventDefault();
    e.stopPropagation();
  }

  function onCanvasDown(e: React.MouseEvent) {
    if (modeRef.current !== 'idle') return;
    modeRef.current = 'pan';
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { ...panRef.current };
    e.preventDefault();
  }

  function onMove(e: React.MouseEvent) {
    if (modeRef.current === 'card' && activeIdRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const mx = e.clientX - rect.left - panRef.current.x;
      const my = e.clientY - rect.top - panRef.current.y;
      const id = activeIdRef.current;
      setPositions((prev) => ({ ...prev, [id]: { x: mx - offsetRef.current.x, y: my - offsetRef.current.y } }));
    } else if (modeRef.current === 'pan') {
      setPan({
        x: panOriginRef.current.x + (e.clientX - panStartRef.current.x),
        y: panOriginRef.current.y + (e.clientY - panStartRef.current.y),
      });
    }
  }

  function stopAll() {
    modeRef.current = 'idle';
    activeIdRef.current = null;
  }

  function screenPos(id: string): Vec2 {
    const p = positions[id] ?? { x: 0, y: 0 };
    return { x: p.x + pan.x, y: p.y + pan.y };
  }

  return { positions, pan, canvasRef, startDrag, onCanvasDown, onMove, stopAll, screenPos };
}

interface Link { from: Vec2; to: Vec2; color: string; active: boolean; }

function Connectors({ links }: { links: Link[] }) {
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ zIndex: 1 }}>
      {links.map((link, index) => {
        const mx = (link.from.x + link.to.x) / 2;
        const path = `M ${link.from.x} ${link.from.y} C ${mx} ${link.from.y}, ${mx} ${link.to.y}, ${link.to.x} ${link.to.y}`;
        return (
          <g key={index}>
            <path
              d={path}
              fill="none"
              stroke={link.color}
              strokeOpacity={link.active ? 0.48 : 0.22}
              strokeDasharray={link.active ? undefined : '5 4'}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
            {link.active && (
              <circle r="2.5" fill={link.color} opacity="0.8">
                <animateMotion dur="2.6s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function NodeCard({
  pos,
  accent,
  icon,
  title,
  subtitle,
  footer,
  active,
  construction,
  onDragStart,
  onClick,
}: {
  pos: Vec2;
  accent: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  footer?: string;
  active?: boolean;
  construction?: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      className="absolute select-none cursor-grab active:cursor-grabbing"
      style={{ left: pos.x, top: pos.y, width: CARD_SIZE, zIndex: 10 }}
      onMouseDown={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div
        className="relative overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent"
        style={{
          height: CARD_SIZE,
          borderColor: `${accent}66`,
          boxShadow: active ? `0 0 0 2px ${accent}26` : undefined,
        }}
      >
        {construction && <div className="absolute inset-x-0 top-0 h-2" style={{ background: CONSTRUCTION_STRIPES }} />}
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </div>
          <p className="line-clamp-2 w-full text-[10px] font-semibold leading-tight text-foreground">{title}</p>
          <p className="line-clamp-1 text-[9px] text-muted-foreground">{subtitle}</p>
          {footer && <p className="line-clamp-1 text-[9px] font-mono" style={{ color: accent }}>{footer}</p>}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  businesses,
  selection,
  onSelect,
  onCreateClick,
}: {
  businesses: YouSupplyBusiness[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onCreateClick: () => void;
}) {
  return (
    <nav className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <div>
          <p className="mb-0.5 text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Registre</p>
          <p className="text-sm font-semibold text-foreground">{businesses.length} entreprise{businesses.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Creer une entreprise"
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {businesses.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-muted-foreground">Aucune entreprise disponible.</div>
        ) : businesses.map((business) => {
          const active = selection?.kind === 'business' && selection.id === business.id;
          const color = businessColor(business.typeKey);
          const pending = business.loans.filter((loan) => loan.status === 'PENDING').length
            + business.cases.filter((caseNode) => caseNode.status !== 'CLOSED').length;
          const underConstruction = Boolean(business.underConstruction && business.constructionProject);
          const storage = business.inventories.reduce((sum, entry) => sum + entry.quantity, 0);
          const capacity = business.inventories.reduce((sum, entry) => sum + entry.capacity, 0);
          const progress = business.constructionProject?.progress.percent ?? 0;
          return (
            <button
              key={business.id}
              onClick={() => onSelect({ kind: 'business', id: business.id })}
              className="flex w-full gap-2.5 px-2.5 py-2.5 text-left transition-colors hover:bg-accent"
              style={{ borderLeft: `3px solid ${active ? color : 'transparent'}`, background: active ? `${color}10` : undefined }}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold" style={{ background: `${color}22`, color }}>
                {BIZ_MONO[business.typeKey] ?? '??'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className={cn('truncate text-[11px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{business.name}</p>
                  {underConstruction && <span className="rounded-full bg-amber-400 px-1.5 text-[8px] font-bold text-black">BUILD</span>}
                  {pending > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[8px] font-bold text-amber-500">{pending}</span>}
                </div>
                <p className="truncate text-[9px] text-muted-foreground/60">{BIZ_LABEL[business.typeKey] ?? business.typeKey}</p>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: underConstruction ? `${progress}%` : capacity > 0 ? `${Math.min(100, Math.round((storage / capacity) * 100))}%` : '0%',
                      background: underConstruction ? '#fbbf24' : color,
                    }}
                  />
                </div>
                <p className="mt-0.5 text-[8px] font-mono text-muted-foreground/45">
                  {underConstruction ? `${progress}% chantier` : business.inventories.length > 0 ? `${storage}/${capacity} stock` : money(business.treasuryMoney)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function buildNodes(business: YouSupplyBusiness, contracts: YouSupplyContract[]) {
  const nodes: Array<{
    id: string;
    accent: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    footer?: string;
    selection: NodeSelection;
    group: 'left' | 'right' | 'depot' | 'bottom';
    connectsTo?: string;
    construction?: boolean;
  }> = [];
  const color = businessColor(business.typeKey);
  const skipContractIds = new Set<string>();

  if (business.underConstruction && business.constructionProject) {
    business.constructionProject.materials.forEach((material) => {
      const meta = RESOURCE_META[material.resourceType as ResourceType];
      const Icon = meta?.Icon ?? Hammer;
      const remaining = Math.max(0, material.requiredQuantity - material.deliveredQuantity);
      const done = remaining === 0;
      const activeContract = contracts.find(
        (c) => c.buyerBusinessId === business.id && c.resourceType === material.resourceType
          && c.status !== 'REJECTED' && c.status !== 'CANCELLED',
      );
      if (activeContract) skipContractIds.add(activeContract.id);
      nodes.push({
        id: `material:${material.id}`,
        accent: done ? '#22c55e' : activeContract ? '#38bdf8' : '#facc15',
        icon: <Icon size={17} />,
        title: resourceLabel(material.resourceType),
        subtitle: done ? 'Pret' : activeContract ? (activeContract.supplier?.name ?? 'Fournisseur') : `${remaining} requis`,
        footer: `${material.deliveredQuantity}/${material.requiredQuantity}`,
        selection: { kind: 'construction-material', business, material },
        group: 'left',
        construction: !done,
      });
    });
  } else {
    business.inventories.forEach((inventory) => {
      const meta = RESOURCE_META[inventory.resourceType as ResourceType];
      const Icon = meta?.Icon ?? Package;
      nodes.push({
        id: `inv:${inventory.id}`,
        accent: color,
        icon: <Icon size={17} />,
        title: `Dépôt ${resourceLabel(inventory.resourceType)}`,
        subtitle: `${inventory.productionRatePerHour} u/h`,
        footer: `${inventory.quantity}/${inventory.capacity}`,
        selection: { kind: 'inventory', business, inventory },
        group: 'depot',
      });
    });

    business.offers.forEach((offer) => {
      const matchingInv = business.inventories.find((inv) => inv.resourceType === offer.resourceType);
      nodes.push({
        id: `offer:${offer.id}`,
        accent: offer.autoAccept ? '#22c55e' : '#f59e0b',
        icon: <Package size={17} />,
        title: `Offre ${resourceLabel(offer.resourceType)}`,
        subtitle: offer.autoAccept ? 'Auto-acceptee' : 'Validation manuelle',
        footer: `${offer.unitPrice}/u`,
        selection: { kind: 'offer', business, offer },
        group: 'right',
        connectsTo: matchingInv ? `inv:${matchingInv.id}` : undefined,
      });
    });
  }

  contracts
    .filter((contract) =>
      !skipContractIds.has(contract.id)
      && contract.status !== 'COMPLETED'
      && contract.status !== 'REJECTED'
      && contract.status !== 'CANCELLED'
      && (contract.supplierBusinessId === business.id || contract.buyerBusinessId === business.id),
    )
    .forEach((contract) => {
      const outgoing = contract.supplierBusinessId === business.id;
      const matchingInv = outgoing
        ? business.inventories.find((inv) => inv.resourceType === contract.resourceType)
        : null;
      nodes.push({
        id: `contract:${contract.id}`,
        accent: contract.status === 'ACTIVE' ? '#38bdf8' : contract.status === 'PENDING' ? '#f59e0b' : '#94a3b8',
        icon: <Briefcase size={17} />,
        title: outgoing ? contract.buyer?.name ?? 'Client' : contract.supplier?.name ?? 'Fournisseur',
        subtitle: `${resourceLabel(contract.resourceType)} · ${contract.status}`,
        footer: `${contract.deliveredQuantity}/${contract.totalQuantity}`,
        selection: { kind: 'contract', business, contract },
        group: outgoing ? 'right' : 'left',
        connectsTo: outgoing && matchingInv ? `inv:${matchingInv.id}` : undefined,
      });
    });

  if (business.typeKey === 'bank') {
    business.loans.forEach((loan) => nodes.push({
      id: `loan:${loan.id}`,
      accent: loan.status === 'ACTIVE' ? '#22c55e' : loan.status === 'PENDING' ? '#f59e0b' : '#94a3b8',
      icon: <Landmark size={17} />,
      title: loan.borrower?.username ?? 'Emprunteur',
      subtitle: loan.status,
      footer: money(loan.amount),
      selection: { kind: 'loan', business, item: loan },
      group: 'bottom',
    }));
    business.bankAccounts.forEach((account) => nodes.push({
      id: `account:${account.id}`,
      accent: '#eab308',
      icon: <Banknote size={17} />,
      title: account.user.username,
      subtitle: account.accountType,
      footer: money(account.balance),
      selection: { kind: 'account', business, item: account },
      group: 'bottom',
    }));
  }

  if (business.typeKey === 'law_firm' || business.typeKey === 'supreme_court') {
    business.cases.forEach((caseNode) => nodes.push({
      id: `case:${caseNode.id}`,
      accent: caseNode.status === 'CLOSED' ? '#94a3b8' : '#06b6d4',
      icon: <Gavel size={17} />,
      title: caseNode.plainte?.title ?? caseNode.title,
      subtitle: `${caseNode.side} · ${caseNode.status}`,
      footer: caseNode.lawyer?.username ?? 'Non assigne',
      selection: { kind: 'case', business, item: caseNode },
      group: 'bottom',
    }));
  }

  business.members.forEach((member) => nodes.push({
    id: `member:${member.id}`,
    accent: member.isPrimaryLawyer ? '#22c55e' : '#8b5cf6',
    icon: <User size={17} />,
    title: member.user.username,
    subtitle: member.role,
    footer: member.salary > 0 ? `${member.salary.toLocaleString('fr-FR')}/j` : 'Bénévole',
    selection: { kind: 'team', business, item: member },
    group: 'bottom',
  }));

  if (business.typeKey === 'formation') {
    business.formationProducts.forEach((product) => nodes.push({
      id: `formation:${product.id}`,
      accent: product.status === 'APPROVED' ? '#22c55e' : '#6366f1',
      icon: <GraduationCap size={17} />,
      title: product.title,
      subtitle: product.status,
      footer: money(product.price),
      selection: { kind: 'formation', business, item: product },
      group: 'bottom',
    }));
  }

  if (business.typeKey === 'startup') {
    business.startupProducts.forEach((product) => nodes.push({
      id: `startup:${product.id}`,
      accent: product.activeResearchLevel ? '#f59e0b' : '#3b82f6',
      icon: <Play size={17} />,
      title: product.name,
      subtitle: product.activeResearchLevel ? `Recherche niv. ${product.activeResearchLevel}` : `Niveau ${product.deployedLevel}`,
      footer: product.researchEndsAt ? new Date(product.researchEndsAt).toLocaleDateString('fr-FR') : undefined,
      selection: { kind: 'startup', business, item: product },
      group: 'bottom',
    }));
  }

  if (business.typeKey === 'transfer') {
    business.transferHistory.forEach((entry) => nodes.push({
      id: `transfer:${entry.id}`,
      accent: '#14b8a6',
      icon: <Banknote size={17} />,
      title: `${entry.sender.username} -> ${entry.recipient.username}`,
      subtitle: `${entry.feeRate}% frais`,
      footer: money(entry.amount),
      selection: { kind: 'transfer', business, item: entry },
      group: 'bottom',
    }));
  }

  return nodes;
}

function makePositions(nodes: ReturnType<typeof buildNodes>): Positions {
  // business at x=240; left inputs at x=50; depot at x=440; right outputs at x=640
  const positions: Positions = { business: { x: 240, y: 200 } };
  const left = nodes.filter((n) => n.group === 'left');
  const depot = nodes.filter((n) => n.group === 'depot');
  const right = nodes.filter((n) => n.group === 'right');
  const bottom = nodes.filter((n) => n.group === 'bottom');
  left.forEach((n, i) => { positions[n.id] = { x: 50, y: 80 + i * 146 }; });
  depot.forEach((n, i) => { positions[n.id] = { x: 440, y: 80 + i * 146 }; });
  right.forEach((n, i) => { positions[n.id] = { x: 640, y: 80 + i * 140 }; });
  bottom.forEach((n, i) => { positions[n.id] = { x: 160 + (i % 4) * 145, y: 400 + Math.floor(i / 4) * 140 }; });
  return positions;
}

function BusinessCanvas({
  business,
  contracts,
  onNodeSelect,
  onBusinessClick,
}: {
  business: YouSupplyBusiness;
  contracts: YouSupplyContract[];
  onNodeSelect: (selection: NodeSelection) => void;
  onBusinessClick: () => void;
}) {
  const nodes = useMemo(() => buildNodes(business, contracts), [business, contracts]);
  const initPositions = useMemo(() => makePositions(nodes), [nodes]);
  const drag = useDragCanvas(initPositions);
  const color = businessColor(business.typeKey);
  const businessPos = drag.screenPos('business');
  const links = nodes.map((node) => {
    const nodePos = drag.screenPos(node.id);
    const connectorId = node.connectsTo ?? 'business';
    const connectorPos = drag.screenPos(connectorId);
    if (node.group === 'left') {
      return {
        from: { x: nodePos.x + CARD_SIZE, y: nodePos.y + CARD_SIZE / 2 },
        to: { x: connectorPos.x, y: connectorPos.y + CARD_SIZE / 2 },
        color: node.accent,
        active: true,
      };
    }
    if (node.group === 'bottom') {
      return {
        from: { x: businessPos.x + CARD_SIZE, y: businessPos.y + CARD_SIZE / 2 },
        to: { x: nodePos.x, y: nodePos.y + CARD_SIZE / 2 },
        color: node.accent,
        active: false,
      };
    }
    // depot and right: flow from connector (business or depot) to node
    return {
      from: { x: connectorPos.x + CARD_SIZE, y: connectorPos.y + CARD_SIZE / 2 },
      to: { x: nodePos.x, y: nodePos.y + CARD_SIZE / 2 },
      color: node.accent,
      active: !node.id.startsWith('offer:'),
    };
  });

  return (
    <div
      ref={drag.canvasRef}
      className="relative flex-1 overflow-hidden"
      onMouseDown={drag.onCanvasDown}
      onMouseMove={drag.onMove}
      onMouseUp={drag.stopAll}
      onMouseLeave={drag.stopAll}
      onClick={() => onNodeSelect(null)}
      style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.65) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${drag.pan.x}px ${drag.pan.y}px`,
      }}
    >
      <Connectors links={links} />
      <NodeCard
        pos={businessPos}
        accent={color}
        icon={<span className="font-mono text-xs font-bold">{BIZ_MONO[business.typeKey] ?? '??'}</span>}
        title={business.name}
        subtitle={business.underConstruction ? 'Chantier' : BIZ_LABEL[business.typeKey] ?? business.typeKey}
        footer={business.underConstruction ? `${business.constructionProject?.progress.percent ?? 0}%` : '⚙ Gérer'}
        active
        construction={business.underConstruction}
        onDragStart={(event) => drag.startDrag('business', event)}
        onClick={() => { onNodeSelect(null); onBusinessClick(); }}
      />
      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          pos={drag.screenPos(node.id)}
          accent={node.accent}
          icon={node.icon}
          title={node.title}
          subtitle={node.subtitle}
          footer={node.footer}
          construction={node.construction}
          onDragStart={(event) => drag.startDrag(node.id, event)}
          onClick={() => onNodeSelect(node.selection)}
        />
      ))}
    </div>
  );
}

function DetailPanel({
  selection,
  onClose,
  onSaveOffer,
  onChooseSource,
}: {
  selection: NodeSelection;
  onClose: () => void;
  onSaveOffer: (businessId: string, resourceType: YouSupplyResourceType, unitPrice: number, autoAccept: boolean, isActive?: boolean) => Promise<void>;
  onChooseSource: (business: YouSupplyBusiness, material: YouConstructionMaterial) => void;
}) {
  const [price, setPrice] = useState(10);
  const [autoAccept, setAutoAccept] = useState(false);

  useEffect(() => {
    if (selection?.kind === 'inventory') {
      const existing = selection.business.offers.find((o) => o.resourceType === selection.inventory.resourceType);
      setPrice(existing?.unitPrice ?? 10);
      setAutoAccept(existing?.autoAccept ?? false);
    }
  }, [selection]);

  if (!selection) return null;

  const resourceType =
    selection.kind === 'inventory' ? selection.inventory.resourceType :
    selection.kind === 'construction-material' ? selection.material.resourceType :
    selection.kind === 'offer' ? selection.offer.resourceType :
    selection.kind === 'contract' ? selection.contract.resourceType : null;

  const iconHex = resourceType
    ? (RESOURCE_HEX[resourceType] ?? '#94a3b8')
    : selection.kind === 'team'
      ? ((selection.item as YouBusinessMember).isPrimaryLawyer ? '#22c55e' : '#8b5cf6')
      : businessColor(selection.business.typeKey);

  const resMeta = resourceType ? RESOURCE_META[resourceType as ResourceType] : null;

  const HeaderIcon: React.ComponentType<{ size?: number; className?: string }> =
    resMeta?.Icon ??
    (selection.kind === 'loan' ? Landmark :
     selection.kind === 'case' ? Gavel :
     selection.kind === 'team' ? User :
     selection.kind === 'formation' ? GraduationCap :
     selection.kind === 'startup' ? Play :
     (selection.kind === 'transfer' || selection.kind === 'account') ? Banknote :
     Package);

  const title =
    selection.kind === 'inventory' ? resourceLabel(selection.inventory.resourceType) :
    selection.kind === 'construction-material' ? resourceLabel(selection.material.resourceType) :
    selection.kind === 'offer' ? `Offre ${resourceLabel(selection.offer.resourceType)}` :
    selection.kind === 'contract' ? resourceLabel(selection.contract.resourceType) :
    selection.kind === 'team' ? (selection.item as YouBusinessMember).user.username :
    selection.item.title ?? selection.business.name;

  const panelLabel =
    selection.kind === 'inventory' ? 'Dépôt' :
    selection.kind === 'construction-material' ? 'Chantier · materiau' :
    selection.kind === 'offer' ? 'Offre de vente' :
    selection.kind === 'team' ? 'Employé' :
    selection.kind === 'contract'
      ? (selection.contract.supplierBusinessId === selection.business.id ? 'Contrat sortant →' : '← Contrat entrant')
      : 'Details';

  return (
    <div className="absolute bottom-4 left-4 z-30 w-[360px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${iconHex}22`, color: iconHex }}>
          <HeaderIcon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">{panelLabel}</p>
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-3 p-4 text-xs">
        {selection.kind === 'inventory' && (() => {
          const pct = selection.inventory.capacity > 0
            ? Math.min(100, Math.round((selection.inventory.quantity / selection.inventory.capacity) * 100))
            : 0;
          const bColor = businessColor(selection.business.typeKey);
          return (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Stock</span>
                  <span className="font-mono text-foreground">{selection.inventory.quantity}/{selection.inventory.capacity}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bColor }} />
                </div>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border px-3">
                <Row icon={Package} label="Stock" value={`${selection.inventory.quantity} / ${selection.inventory.capacity}`} />
                <Row icon={TrendingUp} label="Production" value={`${selection.inventory.productionRatePerHour} u/h`} />
                <Row icon={Tag} label="Offres actives" value={String(selection.business.offers.filter((o) => o.resourceType === selection.inventory.resourceType).length)} />
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2.5 text-[11px] font-semibold text-foreground">Vendre cette ressource</p>
                <label className="mb-1.5 block text-[10px] text-muted-foreground">Prix par unite</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  type="number"
                  min={1}
                  className="mb-3 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none"
                />
                <label className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={autoAccept} onChange={(e) => setAutoAccept(e.target.checked)} />
                  Accepter automatiquement les demandes
                </label>
                <button
                  onClick={() => onSaveOffer(selection.business.id, selection.inventory.resourceType, price, autoAccept, true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white"
                >
                  <Check size={12} /> Publier l'offre
                </button>
              </div>
            </>
          );
        })()}

        {selection.kind === 'construction-material' && (() => {
          const { deliveredQuantity, requiredQuantity } = selection.material;
          const remaining = Math.max(0, requiredQuantity - deliveredQuantity);
          const pct = requiredQuantity > 0 ? Math.min(100, Math.round((deliveredQuantity / requiredQuantity) * 100)) : 100;
          const done = remaining === 0;
          return (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Livraison</span>
                  <span className="font-mono font-semibold" style={{ color: done ? '#22c55e' : '#fbbf24' }}>{pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#22c55e' : '#fbbf24' }} />
                </div>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border px-3">
                <Row icon={Check} label="Recu" value={String(deliveredQuantity)} accent={deliveredQuantity > 0 ? '#22c55e' : undefined} />
                <Row icon={Package} label="Requis" value={String(requiredQuantity)} />
                <Row icon={Hammer} label="Reste" value={String(remaining)} accent={done ? '#22c55e' : '#f59e0b'} />
              </div>
              {done ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                  <Check size={14} className="shrink-0 text-emerald-500" />
                  <p className="text-[11px] font-semibold text-emerald-500">Materiau pret</p>
                </div>
              ) : (
                <button
                  onClick={() => onChooseSource(selection.business, selection.material)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black"
                >
                  <Package size={12} /> Choisir une source
                </button>
              )}
            </div>
          );
        })()}

        {selection.kind === 'offer' && (
          <div className="space-y-3">
            <div className="divide-y divide-border rounded-lg border border-border px-3">
              <Row icon={Tag} label="Prix par unite" value={`${selection.offer.unitPrice} /u`} />
              <Row
                icon={Check}
                label="Validation"
                value={selection.offer.autoAccept ? 'Automatique' : 'Manuelle'}
                accent={selection.offer.autoAccept ? '#22c55e' : '#f59e0b'}
              />
              <Row icon={Package} label="Ressource" value={resourceLabel(selection.offer.resourceType)} />
            </div>
            <button
              onClick={() => onSaveOffer(selection.business.id, selection.offer.resourceType, selection.offer.unitPrice, selection.offer.autoAccept, !selection.offer.isActive)}
              className={cn('flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-medium transition-colors',
                selection.offer.isActive
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                  : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
              )}
            >
              {selection.offer.isActive ? 'Desactiver l\'offre' : 'Reactiver l\'offre'}
            </button>
          </div>
        )}

        {selection.kind === 'contract' && (() => {
          const outgoing = selection.contract.supplierBusinessId === selection.business.id;
          const status = selection.contract.status;
          const pct = selection.contract.totalQuantity > 0
            ? Math.min(100, Math.round((selection.contract.deliveredQuantity / selection.contract.totalQuantity) * 100))
            : 0;
          const statusColor = status === 'ACTIVE' ? '#38bdf8' : status === 'PENDING' ? '#f59e0b' : '#94a3b8';
          const counterpart = outgoing ? selection.contract.buyer?.name : selection.contract.supplier?.name;
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: `${statusColor}20`, color: statusColor }}>
                  {status}
                </span>
                <span className="text-[10px] text-muted-foreground">{outgoing ? '→ sortant vers' : '← entrant de'} {counterpart}</span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Livraison</span>
                  <span className="font-mono">{selection.contract.deliveredQuantity}/{selection.contract.totalQuantity}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: statusColor }} />
                </div>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border px-3">
                <Row icon={Briefcase} label={outgoing ? 'Client' : 'Fournisseur'} value={counterpart ?? '—'} />
                <Row icon={Package} label="Ressource" value={resourceLabel(selection.contract.resourceType)} />
                <Row icon={Tag} label="Prix" value={`${selection.contract.unitPrice} /u`} />
                <Row icon={Banknote} label="Total" value={money(selection.contract.totalQuantity * selection.contract.unitPrice)} />
                <Row icon={TrendingUp} label="Reste" value={String(selection.contract.totalQuantity - selection.contract.deliveredQuantity)} />
              </div>
            </div>
          );
        })()}

        {selection.kind === 'team' && (() => {
          const member = selection.item as YouBusinessMember;
          const u = member.user;
          const accent = member.isPrimaryLawyer ? '#22c55e' : '#8b5cf6';
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                {u.profilePicture ? (
                  <img src={u.profilePicture} alt={u.username} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold" style={{ background: `${accent}22`, color: accent }}>
                    {u.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{u.username}</p>
                  {u.firstName && <p className="text-[10px] text-muted-foreground">{u.firstName}</p>}
                  {u.bio && <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground/70">{u.bio}</p>}
                </div>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border px-3">
                <Row icon={Briefcase} label="Rôle" value={member.role} />
                <Row
                  icon={TrendingUp}
                  label="Salaire"
                  value={member.salary > 0 ? `${member.salary.toLocaleString('fr-FR')} /j` : 'Bénévole'}
                  accent={member.salary > 0 ? '#22c55e' : undefined}
                />
                {member.specialty && <Row icon={Tag} label="Spécialité" value={member.specialty} />}
                {member.isPrimaryLawyer && (
                  <Row icon={Check} label="Avocat principal" value="Oui" accent="#22c55e" />
                )}
                <Row icon={User} label="Aura" value={Number(u.aura).toLocaleString('fr-FR')} />
              </div>
            </div>
          );
        })()}

        {selection.kind !== 'inventory' && selection.kind !== 'construction-material' && selection.kind !== 'offer' && selection.kind !== 'contract' && selection.kind !== 'team' && (
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[10px] text-muted-foreground">
            {JSON.stringify(selection.item, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  accent,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <Icon size={13} className="shrink-0 text-muted-foreground/40" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[11px] font-semibold" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function OffersPanel({
  businesses,
  activeBusinessId,
  contracts,
  marketOffers,
  onRespond,
  onRequest,
}: {
  businesses: YouSupplyBusiness[];
  activeBusinessId: string | null;
  contracts: YouSupplyContract[];
  marketOffers: YouSupplyOffer[];
  onRespond: (contractId: string, decision: 'accept' | 'reject') => Promise<void>;
  onRequest: (offerId: string, quantity: number) => Promise<void>;
}) {
  const [scope, setScope] = useState<'current' | 'global'>('current');
  const [resourceFilter, setResourceFilter] = useState<YouSupplyResourceType | 'ALL'>('ALL');
  const [quantity, setQuantity] = useState(25);
  const ownedIds = new Set(businesses.map((business) => business.id));
  const incoming = contracts.filter((contract) =>
    contract.status === 'PENDING'
    && ownedIds.has(contract.supplierBusinessId)
    && (scope === 'global' || contract.supplierBusinessId === activeBusinessId)
  );
  const filteredMarketOffers = marketOffers.filter((offer) =>
    offer.businessId !== activeBusinessId
    && (resourceFilter === 'ALL' || offer.resourceType === resourceFilter)
  );
  const resources = Array.from(new Set(marketOffers.map((offer) => offer.resourceType)));

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <p className="mb-0.5 text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Demandes</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Offres entrantes</p>
          <div className="flex rounded-md border border-border p-0.5 text-[10px]">
            <button className={cn('rounded px-1.5 py-0.5', scope === 'current' && 'bg-muted text-foreground')} onClick={() => setScope('current')}>Actif</button>
            <button className={cn('rounded px-1.5 py-0.5', scope === 'global' && 'bg-muted text-foreground')} onClick={() => setScope('global')}>Tout</button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {incoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">Aucune demande en attente.</div>
        ) : incoming.map((contract) => (
          <div key={contract.id} className="mb-2 rounded-lg border border-border bg-background p-2.5">
            <p className="text-[11px] font-semibold text-foreground">{contract.buyer?.name ?? 'Client'}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {contract.totalQuantity} {resourceLabel(contract.resourceType)} · {contract.unitPrice}/u
            </p>
            <div className="mt-2 flex gap-1.5">
              <button onClick={() => onRespond(contract.id, 'reject')} className="flex-1 rounded-md border border-border py-1 text-[10px] text-muted-foreground hover:bg-muted">Refuser</button>
              <button onClick={() => onRespond(contract.id, 'accept')} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 py-1 text-[10px] font-medium text-white">
                <Check size={11} /> Accepter
              </button>
            </div>
          </div>
        ))}
      </div>
      {false && <div className="border-t border-border px-3 py-3">
        <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Sources</p>
        <p className="text-sm font-semibold text-foreground">Marche ressources</p>
        <div className="mt-2 flex gap-1.5">
          <select value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value as YouSupplyResourceType | 'ALL')} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[11px]">
            <option value="ALL">Toutes</option>
            {resources.map((resource) => <option key={resource} value={resource}>{resourceLabel(resource)}</option>)}
          </select>
          <input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={1} className="h-8 w-16 rounded-md border border-border bg-background px-2 text-[11px]" />
        </div>
      </div>}
      {false && <div className="flex-1 overflow-y-auto p-2">
        {filteredMarketOffers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">Aucune source disponible.</div>
        ) : filteredMarketOffers.map((offer) => (
          <button key={offer.id} onClick={() => onRequest(offer.id, quantity)} className="mb-2 w-full rounded-lg border border-border bg-background p-2.5 text-left hover:bg-accent">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold text-foreground">{offer.business?.name ?? 'Business'}</p>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">{offer.unitPrice}/u</span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{resourceLabel(offer.resourceType)} · stock {offer.availableQuantity ?? 0}</p>
            <p className="mt-1 text-[9px] text-muted-foreground/55">{offer.autoAccept ? 'Acceptation automatique' : 'Validation vendeur'}</p>
          </button>
        ))}
      </div>}
    </aside>
  );
}

function SourceModal({
  target,
  offers,
  onClose,
  onRequest,
}: {
  target: { business: YouSupplyBusiness; material: YouConstructionMaterial } | null;
  offers: YouSupplyOffer[];
  onClose: () => void;
  onRequest: (offerId: string, quantity: number, constructionProjectId: string) => Promise<void>;
}) {
  const remaining = target ? Math.max(0, target.material.requiredQuantity - target.material.deliveredQuantity) : 0;
  const [quantity, setQuantity] = useState(remaining || 1);

  useEffect(() => {
    setQuantity(remaining || 1);
  }, [remaining, target?.material.id]);

  if (!target || !target.business.constructionProject) return null;

  const matchingOffers = offers
    .filter((offer) => offer.resourceType === target.material.resourceType && offer.businessId !== target.business.id)
    .sort((a, b) => a.unitPrice - b.unitPrice);

  const resMeta = RESOURCE_META[target.material.resourceType as ResourceType];
  const ResIcon = resMeta?.Icon ?? Package;
  const resHex = RESOURCE_HEX[target.material.resourceType] ?? '#94a3b8';
  const pct = target.material.requiredQuantity > 0
    ? Math.min(100, Math.round((target.material.deliveredQuantity / target.material.requiredQuantity) * 100))
    : 0;
  const qty = Math.min(quantity, remaining || quantity);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-4 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${resHex}22`, color: resHex }}>
            <ResIcon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Source chantier · {target.business.name}</p>
            <p className="text-base font-semibold text-foreground">{resourceLabel(target.material.resourceType)}</p>
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{target.material.deliveredQuantity}/{target.material.requiredQuantity} livres</span>
                <span className="font-mono font-semibold text-amber-400">{remaining} restant</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: resHex }} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted">
            <X size={14} />
          </button>
        </div>

        {/* Quantity row */}
        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <span className="text-[11px] text-muted-foreground">Quantite a commander :</span>
          <input
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            type="number"
            min={1}
            max={remaining || 1}
            className="h-7 w-20 rounded-md border border-border bg-background px-2 text-xs"
          />
          <span className="text-[10px] text-muted-foreground/50">/ {remaining} max</span>
        </div>

        {/* Offer list */}
        <div className="max-h-72 overflow-y-auto p-3">
          {matchingOffers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-[11px] text-muted-foreground">Aucune source disponible pour cette ressource.</p>
              <p className="mt-1 text-[10px] text-muted-foreground/50">Un fournisseur doit publier une offre de vente.</p>
            </div>
          ) : matchingOffers.map((offer, i) => {
            const supplierColor = businessColor(offer.business?.typeKey ?? '');
            const isCheapest = i === 0;
            const total = offer.unitPrice * qty;
            return (
              <button
                key={offer.id}
                onClick={() => onRequest(offer.id, qty, target.business.constructionProject!.id)}
                className="mb-2 w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold"
                    style={{ background: `${supplierColor}22`, color: supplierColor }}>
                    {BIZ_MONO[offer.business?.typeKey ?? ''] ?? '??'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[12px] font-semibold text-foreground">{offer.business?.name ?? 'Business'}</p>
                      {isCheapest && <span className="rounded bg-emerald-500/15 px-1 text-[8px] font-bold text-emerald-500">MOINS CHER</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      @{offer.business?.owner.username ?? 'serveur'} · {offer.availableQuantity ?? 0} en stock
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-bold" style={{ color: isCheapest ? '#22c55e' : undefined }}>{offer.unitPrice}</p>
                    <p className="text-[9px] text-muted-foreground">/u</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium',
                    offer.autoAccept ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                  )}>
                    {offer.autoAccept ? 'Auto' : 'Validation requise'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    Total ≈ {total.toLocaleString('fr-FR')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SupplyTab({ businessTypes, unlockedBusinessLevel, ownedBusinesses, players, userId, onReload }: { businessTypes: YouBusinessType[]; unlockedBusinessLevel: number; ownedBusinesses: YouBusiness[]; players: YouPlayer[]; userId: string; onReload?: () => void }) {
  const [state, setState] = useState<YouSupplyState | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [nodeSelection, setNodeSelection] = useState<NodeSelection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [sourceTarget, setSourceTarget] = useState<{ business: YouSupplyBusiness; material: YouConstructionMaterial } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageBusinessId, setManageBusinessId] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<YouBusiness | null>(null);
  const [completedBusiness, setCompletedBusiness] = useState<YouSupplyBusiness | null>(null);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const prevUnderConstruction = useRef<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await youApi.getSupplyState();
      setState(response.data);
      setSelection((current) => {
        if (current && response.data.businesses.some((business) => business.id === current.id)) return current;
        const first = response.data.businesses[0];
        return first ? { kind: 'business', id: first.id } : null;
      });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Impossible de charger le systeme supply.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!state) return;
    const nowIds = new Set(state.businesses.filter((b) => b.underConstruction).map((b) => b.id));
    for (const id of prevUnderConstruction.current) {
      if (!nowIds.has(id)) {
        const biz = state.businesses.find((b) => b.id === id);
        if (biz) setCompletedBusiness(biz);
      }
    }
    prevUnderConstruction.current = nowIds;
  }, [state]);

  useEffect(() => {
    if (!completedBusiness) return;
    setCurtainOpen(false);
    const t = setTimeout(() => setCurtainOpen(true), 80);
    return () => clearTimeout(t);
  }, [completedBusiness]);

  const activeBusiness = selection?.kind === 'business'
    ? state?.businesses.find((business) => business.id === selection.id) ?? null
    : null;

  async function mutate(action: () => Promise<void>) {
    setMutating(true);
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Action impossible.');
    } finally {
      setMutating(false);
    }
  }

  async function saveOffer(businessId: string, resourceType: YouSupplyResourceType, unitPrice: number, autoAccept: boolean, isActive?: boolean) {
    await mutate(async () => {
      await youApi.upsertSupplyOffer(businessId, { resourceType, unitPrice, autoAccept, isActive });
      setNodeSelection(null);
    });
  }

  async function requestContract(offerId: string, quantity: number, constructionProjectId?: string) {
    const buyerBusinessId = sourceTarget?.business.id ?? activeBusiness?.id;
    if (!buyerBusinessId) return;
    await mutate(async () => {
      await youApi.requestSupplyContract(buyerBusinessId, { offerId, quantity, constructionProjectId });
      setSourceTarget(null);
    });
  }

  async function respondContract(contractId: string, decision: 'accept' | 'reject') {
    await mutate(async () => {
      await youApi.respondToSupplyContract(contractId, decision);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <CreateBusinessModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        businessTypes={businessTypes}
        unlockedBusinessLevel={unlockedBusinessLevel}
        onCreated={async () => { await load(); onReload?.(); }}
      />
      <ManageBusinessModal
        open={Boolean(manageBusinessId)}
        onClose={() => setManageBusinessId(null)}
        business={ownedBusinesses.find((b) => b.id === manageBusinessId) ?? null}
        players={players}
        currentUserId={userId}
        onInviteRequested={(biz) => { setManageBusinessId(null); setInviteTarget(biz); }}
        onSubmitted={async () => { await load(); onReload?.(); }}
      />
      <InvitePlayersModal
        open={Boolean(inviteTarget)}
        onClose={() => setInviteTarget(null)}
        business={inviteTarget}
        players={players}
        onSubmitted={async () => { await load(); onReload?.(); }}
      />
      <Sidebar businesses={state?.businesses ?? []} selection={selection} onSelect={(next) => { setSelection(next); setNodeSelection(null); }} onCreateClick={() => setCreateOpen(true)} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-4">
          {activeBusiness ? (
            <>
              <div className="flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-bold" style={{ background: `${businessColor(activeBusiness.typeKey)}22`, color: businessColor(activeBusiness.typeKey) }}>
                {BIZ_MONO[activeBusiness.typeKey] ?? '??'}
              </div>
              <p className="text-sm font-medium text-foreground">{activeBusiness.name}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{BIZ_LABEL[activeBusiness.typeKey] ?? activeBusiness.typeKey}</span>
              {activeBusiness.underConstruction && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">Chantier {activeBusiness.constructionProject?.progress.percent ?? 0}%</span>}
              <button
                onClick={() => setManageBusinessId(activeBusiness.id)}
                className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-80"
                style={{ background: businessColor(activeBusiness.typeKey) }}
              >
                <Settings size={11} /> Gérer
              </button>
              <span className="text-[11px] text-muted-foreground">{money(activeBusiness.treasuryMoney)}</span>
            </>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Supply management</p>
          )}
          <button onClick={() => void load()} disabled={loading || mutating} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground hover:text-foreground">
            {loading || mutating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>

        {error && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>
        )}

        {loading && !state ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Chargement supply...
          </div>
        ) : activeBusiness ? (
          <div className="relative flex min-h-0 flex-1">
            <BusinessCanvas business={activeBusiness} contracts={state?.contracts ?? []} onNodeSelect={setNodeSelection} onBusinessClick={() => setManageBusinessId(activeBusiness.id)} />
            <DetailPanel
              selection={nodeSelection}
              onClose={() => setNodeSelection(null)}
              onSaveOffer={saveOffer}
              onChooseSource={(business, material) => setSourceTarget({ business, material })}
            />
            <SourceModal
              target={sourceTarget}
              offers={state?.marketOffers ?? []}
              onClose={() => setSourceTarget(null)}
              onRequest={requestContract}
            />
            {mutating && <div className="absolute right-4 top-4 rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground shadow"><Loader2 size={12} className="mr-1 inline animate-spin" /> Mise a jour...</div>}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card">
              <Building2 size={22} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aucune entreprise a afficher.</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground hover:bg-accent"
            >
              <Plus size={13} /> Creer une entreprise
            </button>
          </div>
        )}
      </main>

      <OffersPanel
        businesses={state?.businesses ?? []}
        activeBusinessId={activeBusiness?.id ?? null}
        contracts={state?.contracts ?? []}
        marketOffers={state?.marketOffers ?? []}
        onRespond={respondContract}
        onRequest={requestContract}
      />

      {completedBusiness && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center">
          {/* Dark stage behind curtains */}
          <div className="absolute inset-0 bg-background/95" />
          {/* Content revealed as curtains open */}
          <div
            className="relative z-10 flex max-w-sm flex-col items-center gap-5 p-10 text-center"
            style={{ opacity: curtainOpen ? 1 : 0, transition: 'opacity 0.45s ease', transitionDelay: curtainOpen ? '0.55s' : '0s' }}
          >
            <div
              className="flex h-24 w-24 items-center justify-center rounded-3xl font-mono text-3xl font-bold shadow-xl"
              style={{ background: `${businessColor(completedBusiness.typeKey)}22`, color: businessColor(completedBusiness.typeKey) }}
            >
              {BIZ_MONO[completedBusiness.typeKey] ?? '??'}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{BIZ_LABEL[completedBusiness.typeKey] ?? completedBusiness.typeKey}</p>
              <p className="mt-1.5 text-2xl font-bold text-foreground">{completedBusiness.name}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{BIZ_DESC[completedBusiness.typeKey] ?? 'Votre entreprise est prete.'}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
              <Check size={15} className="text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-500">Construction terminee !</p>
            </div>
            <button
              onClick={() => setCompletedBusiness(null)}
              className="mt-1 rounded-md bg-foreground px-7 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
            >
              Commencer
            </button>
          </div>
          {/* Left curtain — slides to the left */}
          <div
            className="absolute left-0 top-0 z-20 h-full w-1/2 border-r border-border bg-card shadow-2xl transition-transform duration-700 ease-in-out"
            style={{ transformOrigin: 'left center', transform: curtainOpen ? 'scaleX(0)' : 'scaleX(1)' }}
          />
          {/* Right curtain — slides to the right */}
          <div
            className="absolute right-0 top-0 z-20 h-full w-1/2 border-l border-border bg-card shadow-2xl transition-transform duration-700 ease-in-out"
            style={{ transformOrigin: 'right center', transform: curtainOpen ? 'scaleX(0)' : 'scaleX(1)' }}
          />
        </div>
      )}
    </div>
  );
}
