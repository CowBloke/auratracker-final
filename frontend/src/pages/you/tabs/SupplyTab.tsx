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
  User,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UsernameDisplay, type BadgeData, type UsernameDisplayPreset } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';
import { PRODUCER_TYPES, RESOURCE_META, type ResourceType } from '@/lib/resources';
import {
  youApi,
  justiceApi,
  type YouBusiness,
  type YouBusinessMember,
  type YouBusinessType,
  type YouPlayer,
  type YouSupplyBusiness,
  type YouConstructionMaterial,
  type YouSupplyContract,
  type YouSupplyInventory,
  type YouSupplyOffer,
  type YouSupplyPlainteNode,
  type YouSupplyResourceType,
  type YouSupplyState,
} from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { CreateBusinessModal, InvitePlayersModal, ManageBusinessModal } from '../components/modals';
import { BUSINESS_ICON_MAP } from '../constants';

type Selection = { kind: 'business'; id: string } | null;
type DisplayUser = Omit<YouPlayer, 'alreadyInRelationship'> & {
  usernameColor?: string | null;
  badges?: BadgeData[] | null;
};
type NodeSelection =
  | { kind: 'inventory'; business: YouSupplyBusiness; inventory: YouSupplyInventory }
  | { kind: 'construction-material'; business: YouSupplyBusiness; material: YouConstructionMaterial; activeContract: YouSupplyContract | null }
  | { kind: 'offer'; business: YouSupplyBusiness; offer: YouSupplyOffer }
  | { kind: 'contract'; business: YouSupplyBusiness; contract: YouSupplyContract }
  | { kind: 'plainte'; business: YouSupplyBusiness; plainte: YouSupplyPlainteNode }
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

function getBizIcon(typeKey: string) {
  return BUSINESS_ICON_MAP[typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
}

function UserName({
  user,
  fallback = '—',
  preset = 'no-badge',
  clickable = false,
  className,
  usernameClassName,
}: {
  user?: DisplayUser | null;
  fallback?: string;
  preset?: UsernameDisplayPreset;
  clickable?: boolean;
  className?: string;
  usernameClassName?: string;
}) {
  if (!user) return <span>{fallback}</span>;
  return (
    <UsernameDisplay
      username={user.username}
      userId={user.id}
      firstName={user.firstName}
      usernameColor={user.usernameColor}
      badges={user.badges}
      preset={preset}
      clickable={clickable}
      className={className}
      usernameClassName={usernameClassName}
    />
  );
}

function useDragCanvas(initPositions: Positions) {
  const [positions, setPositions] = useState<Positions>(initPositions);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  panRef.current = pan;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const modeRef = useRef<'idle' | 'card' | 'pan'>('idle');
  const activeIdRef = useRef<string | null>(null);
  const offsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const panStartRef = useRef<Vec2>({ x: 0, y: 0 });
  const panOriginRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragStartMouseRef = useRef<Vec2>({ x: 0, y: 0 });
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setPositions(initPositions);
    setPan((current) => current);
  }, [initPositions]);

  function startDrag(id: string, e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const pos = positions[id] ?? { x: 0, y: 0 };
    const mx = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
    const my = (e.clientY - rect.top - panRef.current.y) / scaleRef.current;
    offsetRef.current = { x: mx - pos.x, y: my - pos.y };
    modeRef.current = 'card';
    activeIdRef.current = id;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
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
      const mx = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
      const my = (e.clientY - rect.top - panRef.current.y) / scaleRef.current;
      const id = activeIdRef.current;
      if (Math.abs(e.clientX - dragStartMouseRef.current.x) > 3 || Math.abs(e.clientY - dragStartMouseRef.current.y) > 3) {
        draggedRef.current = true;
      }
      setPositions((prev) => ({ ...prev, [id]: { x: mx - offsetRef.current.x, y: my - offsetRef.current.y } }));
    } else if (modeRef.current === 'pan') {
      setPan({
        x: panOriginRef.current.x + (e.clientX - panStartRef.current.x),
        y: panOriginRef.current.y + (e.clientY - panStartRef.current.y),
      });
    }
  }

  function stopAll() {
    if (modeRef.current === 'card' && draggedRef.current) {
      suppressClickRef.current = true;
    }
    modeRef.current = 'idle';
    activeIdRef.current = null;
  }

  function screenPos(id: string): Vec2 {
    const p = positions[id] ?? { x: 0, y: 0 };
    return { x: p.x * scale + pan.x, y: p.y * scale + pan.y };
  }

  function zoomAt(clientX: number, clientY: number, nextScale: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clamped = Math.max(0.45, Math.min(1.8, nextScale));
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const worldX = (mouseX - panRef.current.x) / scaleRef.current;
    const worldY = (mouseY - panRef.current.y) / scaleRef.current;
    setScale(clamped);
    setPan({
      x: mouseX - worldX * clamped,
      y: mouseY - worldY * clamped,
    });
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    zoomAt(e.clientX, e.clientY, scaleRef.current * factor);
  }

  function consumeSuppressClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }

  return { positions, pan, scale, setScale, setPan, canvasRef, startDrag, onCanvasDown, onMove, onWheel, stopAll, screenPos, consumeSuppressClick };
}

interface Link { from: Vec2; to: Vec2; color: string; active: boolean; }

function NodeCard({
  pos,
  accent,
  icon,
  title,
  subtitle,
  footer,
  active,
  construction,
  workWarning,
  onDragStart,
  onClick,
  onHoverChange,
  showHandles,
  onHandleMouseDown,
  badge,
  shouldSuppressClick,
  scale = 1,
}: {
  pos: Vec2;
  accent: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  footer?: React.ReactNode;
  active?: boolean;
  construction?: boolean;
  workWarning?: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onClick: () => void;
  onHoverChange?: (hovering: boolean) => void;
  showHandles?: boolean;
  onHandleMouseDown?: (side: LinkHandleSide, e: React.MouseEvent) => void;
  badge?: {
    icon: React.ReactNode;
    title: string;
    accent: string;
    onClick: () => void;
  };
  shouldSuppressClick?: () => boolean;
  scale?: number;
}) {
  const cardAccent = workWarning ? '#f97316' : accent;
  return (
    <div
      className="absolute select-none cursor-grab active:cursor-grabbing"
      style={{ left: 0, top: 0, width: CARD_SIZE, zIndex: 10, transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: 'top left' }}
      onMouseDown={onDragStart}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (shouldSuppressClick?.()) return;
        onClick();
      }}
    >
      <div
        className="relative overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent"
        style={{
          height: CARD_SIZE,
          borderColor: workWarning ? '#f9731666' : `${accent}66`,
          boxShadow: active ? `0 0 0 2px ${cardAccent}26` : workWarning ? `0 0 0 1.5px #f9731640` : undefined,
        }}
      >
        {construction && <div className="absolute inset-x-0 top-0 h-2" style={{ background: CONSTRUCTION_STRIPES }} />}
        {workWarning && !construction && (
          <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-lg" style={{ background: 'repeating-linear-gradient(90deg, #f97316 0 6px, #431407 6px 12px)' }} />
        )}
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: `${cardAccent}18`, color: cardAccent }}>
            {icon}
          </div>
          <p className="line-clamp-2 w-full text-[10px] font-semibold leading-tight text-foreground">{title}</p>
          <p className="line-clamp-1 text-[9px] text-muted-foreground">{subtitle}</p>
          {footer && <p className="line-clamp-1 text-[9px] font-mono" style={{ color: cardAccent }}>{footer}</p>}
          {workWarning && <p className="text-[8px] font-semibold text-orange-400">⚠ Travail requis</p>}
        </div>
        {badge && (
          <button
            type="button"
            title={badge.title}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              badge.onClick();
            }}
            className="absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-lg"
            style={{ color: badge.accent }}
          >
            {badge.icon}
          </button>
        )}
        {showHandles && onHandleMouseDown && (
          <>
            {(['top', 'right', 'bottom', 'left'] as LinkHandleSide[]).map((side) => {
              const sideStyle =
                side === 'top' ? { left: '50%', top: -7, transform: 'translateX(-50%)' } :
                side === 'right' ? { right: -7, top: '50%', transform: 'translateY(-50%)' } :
                side === 'bottom' ? { left: '50%', bottom: -7, transform: 'translateX(-50%)' } :
                { left: -7, top: '50%', transform: 'translateY(-50%)' };
              return (
                <button
                  key={side}
                  type="button"
                  onMouseDown={(event) => onHandleMouseDown(side, event)}
                  className="absolute h-4 w-4 rounded-full border border-border bg-background shadow"
                  style={sideStyle}
                />
              );
            })}
          </>
        )}
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
    <nav className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card" data-tutorial-id="supply-businesses-sidebar">
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
          const isProducerBiz = PRODUCER_TYPES.has(business.typeKey);
          const workRatio = business.workRatio ?? 1;
          const needsWork = isProducerBiz && !underConstruction && workRatio === 0 && business.members.length > 0;
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
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: `${color}22`, color }}>
                {(() => {
                  const BizIcon = getBizIcon(business.typeKey);
                  return <BizIcon className="h-4 w-4" />;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className={cn('truncate text-[11px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{business.name}</p>
                  {underConstruction && <span className="rounded-full bg-amber-400 px-1.5 text-[8px] font-bold text-black">BUILD</span>}
                  {pending > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[8px] font-bold text-amber-500">{pending}</span>}
                  {needsWork && <span className="rounded-full bg-orange-500/15 px-1.5 text-[8px] font-bold text-orange-400">⚠ WORK</span>}
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

type GraphMode = 'single' | 'full';
type LinkHandleSide = 'top' | 'right' | 'bottom' | 'left';
type GraphNodeGroup = 'business' | 'left' | 'depot' | 'right' | 'market' | 'bottom';
type GraphNodeKind = 'business' | 'inventory' | 'construction-material' | 'contract' | 'loan' | 'case' | 'plainte' | 'formation' | 'startup' | 'account' | 'transfer' | 'team' | 'global-market';

type GraphNodeModel = {
  id: string;
  businessId: string;
  kind: GraphNodeKind;
  accent: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  footer?: React.ReactNode;
  selection: NodeSelection;
  group: GraphNodeGroup;
  connectsTo?: string;
  construction?: boolean;
  resourceType?: YouSupplyResourceType;
  inventory?: YouSupplyInventory;
  offer?: YouSupplyOffer;
  globalMarketUnitPrice?: number;
};

type CanvasLink = Link & {
  id: string;
  kind: 'structural' | 'supply';
  ratePerHour?: number;
  etaLabel?: string | null;
  removable?: boolean;
  midpoint?: Vec2;
};

type LinkDraft = {
  sourceNodeId: string;
  sourceBusinessId: string;
  sourceResourceType: YouSupplyResourceType;
  side: LinkHandleSide;
  current: Vec2;
};

const BUSINESS_GRAPH_WIDTH = 980;
const BUSINESS_GRAPH_HEIGHT = 720;

function inventoryNodeId(businessId: string, resourceType: string) {
  return `inventory:${businessId}:${resourceType}`;
}

function businessNodeId(businessId: string) {
  return `business:${businessId}`;
}

function globalMarketNodeId(businessId: string) {
  return `market:${businessId}`;
}

function formatEta(hours: number | null) {
  if (hours === null || !Number.isFinite(hours)) return null;
  if (hours <= 0) return 'Plein';
  if (hours < 1) return `${Math.max(1, Math.ceil(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${Math.ceil(hours / 24)} j`;
}

function beadDuration(ratePerHour: number) {
  return `${Math.max(0.9, Math.min(4.8, 8 / Math.max(1, ratePerHour))).toFixed(2)}s`;
}

function getHandlePosition(pos: Vec2, side: LinkHandleSide, scale = 1): Vec2 {
  const size = CARD_SIZE * scale;
  if (side === 'top') return { x: pos.x + size / 2, y: pos.y };
  if (side === 'right') return { x: pos.x + size, y: pos.y + size / 2 };
  if (side === 'bottom') return { x: pos.x + size / 2, y: pos.y + size };
  return { x: pos.x, y: pos.y + size / 2 };
}

function buildBusinessNodes(business: YouSupplyBusiness, contracts: YouSupplyContract[]) {
  const nodes: GraphNodeModel[] = [];
  const color = businessColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);
  const skipContractIds = new Set<string>();

  nodes.push({
    id: businessNodeId(business.id),
    businessId: business.id,
    kind: 'business',
    accent: color,
    icon: <BizIcon size={17} />,
    title: business.name,
    subtitle: business.underConstruction ? 'Chantier' : BIZ_LABEL[business.typeKey] ?? business.typeKey,
    footer: business.underConstruction ? `${business.constructionProject?.progress.percent ?? 0}%` : '⚙ Gérer',
    selection: null,
    group: 'business',
    construction: business.underConstruction,
  });

  if (business.underConstruction && business.constructionProject) {
    business.constructionProject.materials.forEach((material) => {
      const meta = RESOURCE_META[material.resourceType as ResourceType];
      const Icon = meta?.Icon ?? Hammer;
      const remaining = Math.max(0, material.requiredQuantity - material.deliveredQuantity);
      const done = remaining === 0;
      const activeContract = contracts.find(
        (contract) => contract.buyerBusinessId === business.id
          && contract.resourceType === material.resourceType
          && contract.status !== 'REJECTED'
          && contract.status !== 'CANCELLED',
      );
      if (activeContract) skipContractIds.add(activeContract.id);
      nodes.push({
        id: `material:${material.id}`,
        businessId: business.id,
        kind: 'construction-material',
        accent: done ? '#22c55e' : activeContract ? '#38bdf8' : '#facc15',
        icon: <Icon size={17} />,
        title: resourceLabel(material.resourceType),
        subtitle: done ? 'Pret' : activeContract ? (activeContract.supplier?.name ?? 'Fournisseur') : `${remaining} requis`,
        footer: `${material.deliveredQuantity}/${material.requiredQuantity}`,
        selection: { kind: 'construction-material', business, material, activeContract: activeContract ?? null },
        group: 'left',
        construction: !done,
        resourceType: material.resourceType,
      });
    });
  } else {
    business.inventories.forEach((inventory) => {
      const meta = RESOURCE_META[inventory.resourceType as ResourceType];
      const Icon = meta?.Icon ?? Package;
      const offer = business.offers.find((entry) => entry.resourceType === inventory.resourceType);
      nodes.push({
        id: inventoryNodeId(business.id, inventory.resourceType),
        businessId: business.id,
        kind: 'inventory',
        accent: color,
        icon: <Icon size={17} />,
        title: `Dépôt ${resourceLabel(inventory.resourceType)}`,
        subtitle: `${inventory.productionRatePerHour} u/h`,
        footer: `${inventory.quantity}/${inventory.capacity}`,
        selection: { kind: 'inventory', business, inventory },
        group: 'depot',
        resourceType: inventory.resourceType,
        inventory,
        offer,
        globalMarketUnitPrice: inventory.globalMarketUnitPrice,
      });
    });

    if (PRODUCER_TYPES.has(business.typeKey)) {
      nodes.push({
        id: globalMarketNodeId(business.id),
        businessId: business.id,
        kind: 'global-market',
        accent: '#f97316',
        icon: <Banknote size={18} />,
        title: 'Marché global',
        subtitle: 'Vente de secours',
        footer: business.inventories[0] ? `≈ ${business.inventories[0].globalMarketUnitPrice}/u` : 'Prix fixe',
        selection: null,
        group: 'market',
      });
    }
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
      nodes.push({
        id: `contract:${contract.id}`,
        businessId: business.id,
        kind: 'contract',
        accent: contract.status === 'ACTIVE' ? '#38bdf8' : contract.status === 'PENDING' ? '#f59e0b' : '#94a3b8',
        icon: <Briefcase size={17} />,
        title: outgoing ? contract.buyer?.name ?? 'Client' : contract.supplier?.name ?? 'Fournisseur',
        subtitle: `${resourceLabel(contract.resourceType)} · ${contract.status}`,
        footer: `${contract.deliveredQuantity}/${contract.totalQuantity}`,
        selection: { kind: 'contract', business, contract },
        group: outgoing ? 'right' : 'left',
        connectsTo: outgoing ? inventoryNodeId(business.id, contract.resourceType) : businessNodeId(business.id),
      });
    });

  if (business.typeKey === 'bank') {
    business.loans.forEach((loan) => nodes.push({
      id: `loan:${loan.id}`,
      businessId: business.id,
      kind: 'loan',
      accent: loan.status === 'ACTIVE' ? '#22c55e' : loan.status === 'PENDING' ? '#f59e0b' : '#94a3b8',
      icon: <Landmark size={17} />,
      title: <UserName user={loan.borrower} fallback="Emprunteur" preset="minimal" />,
      subtitle: loan.status,
      footer: money(loan.amount),
      selection: { kind: 'loan', business, item: loan },
      group: 'bottom',
    }));
    business.bankAccounts.forEach((account) => nodes.push({
      id: `account:${account.id}`,
      businessId: business.id,
      kind: 'account',
      accent: '#eab308',
      icon: <Banknote size={17} />,
      title: <UserName user={account.user} preset="minimal" />,
      subtitle: account.accountType,
      footer: money(account.balance),
      selection: { kind: 'account', business, item: account },
      group: 'bottom',
    }));
  }

  if (business.typeKey === 'law_firm' || business.typeKey === 'supreme_court') {
    business.cases.forEach((caseNode) => nodes.push({
      id: `case:${caseNode.id}`,
      businessId: business.id,
      kind: 'case',
      accent: caseNode.status === 'CLOSED' ? '#94a3b8' : '#06b6d4',
      icon: <Gavel size={17} />,
      title: caseNode.plainte?.title ?? caseNode.title,
      subtitle: `${caseNode.side} · ${caseNode.status}`,
      footer: <UserName user={caseNode.lawyer} fallback="Non assigne" preset="minimal" />,
      selection: { kind: 'case', business, item: caseNode },
      group: 'bottom',
    }));
  }

  if (business.typeKey === 'supreme_court') {
    business.plaintes.forEach((plainte) => nodes.push({
      id: `plainte:${plainte.id}`,
      businessId: business.id,
      kind: 'plainte',
      accent: '#f97316',
      icon: <Gavel size={17} />,
      title: plainte.title,
      subtitle: plainte.defendant ? <>vs <UserName user={plainte.defendant} preset="minimal" /></> : 'Sans défendeur',
      footer: 'En attente',
      selection: { kind: 'plainte', business, plainte },
      group: 'right',
    }));
  }

  business.members.forEach((member) => nodes.push({
    id: `member:${member.id}`,
    businessId: business.id,
    kind: 'team',
    accent: member.isPrimaryLawyer ? '#22c55e' : '#8b5cf6',
    icon: <User size={17} />,
    title: <UserName user={member.user} preset="minimal" />,
    subtitle: member.role,
    footer: member.salary > 0 ? `${member.salary.toLocaleString('fr-FR')}/j` : 'Bénévole',
    selection: { kind: 'team', business, item: member },
    group: 'bottom',
  }));

  if (business.typeKey === 'formation') {
    business.formationProducts.forEach((product) => nodes.push({
      id: `formation:${product.id}`,
      businessId: business.id,
      kind: 'formation',
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
      businessId: business.id,
      kind: 'startup',
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
      businessId: business.id,
      kind: 'transfer',
      accent: '#14b8a6',
      icon: <Banknote size={17} />,
      title: (
        <span className="inline-flex min-w-0 items-center gap-1">
          <UserName user={entry.sender} preset="minimal" />
          <span>-&gt;</span>
          <UserName user={entry.recipient} preset="minimal" />
        </span>
      ),
      subtitle: `${entry.feeRate}% frais`,
      footer: money(entry.amount),
      selection: { kind: 'transfer', business, item: entry },
      group: 'bottom',
    }));
  }

  return nodes;
}

function makeBusinessPositions(nodes: GraphNodeModel[], origin: Vec2): Positions {
  const positions: Positions = {};
  const left = nodes.filter((node) => node.group === 'left');
  const depot = nodes.filter((node) => node.group === 'depot');
  const right = nodes.filter((node) => node.group === 'right');
  const bottom = nodes.filter((node) => node.group === 'bottom');
  const business = nodes.find((node) => node.group === 'business');
  const market = nodes.find((node) => node.group === 'market');

  if (business) positions[business.id] = { x: origin.x + 250, y: origin.y + 200 };
  if (market) positions[market.id] = { x: origin.x + 830, y: origin.y + 200 };
  left.forEach((node, index) => { positions[node.id] = { x: origin.x + 50, y: origin.y + 80 + index * 146 }; });
  depot.forEach((node, index) => { positions[node.id] = { x: origin.x + 450, y: origin.y + 80 + index * 146 }; });
  right.forEach((node, index) => { positions[node.id] = { x: origin.x + 660, y: origin.y + 80 + index * 140 }; });
  bottom.forEach((node, index) => { positions[node.id] = { x: origin.x + 130 + (index % 5) * 145, y: origin.y + 430 + Math.floor(index / 5) * 140 }; });
  return positions;
}

function layoutBusinesses(businesses: YouSupplyBusiness[], contracts: YouSupplyContract[], mode: GraphMode) {
  const columns = mode === 'single' ? 1 : Math.max(1, Math.ceil(Math.sqrt(businesses.length)));
  const allNodes: GraphNodeModel[] = [];
  const positions: Positions = {};

  businesses.forEach((business, index) => {
    const nodes = buildBusinessNodes(business, contracts);
    allNodes.push(...nodes);
    const row = Math.floor(index / columns);
    const column = index % columns;
    Object.assign(positions, makeBusinessPositions(nodes, {
      x: column * BUSINESS_GRAPH_WIDTH,
      y: row * BUSINESS_GRAPH_HEIGHT,
    }));
  });

  return { nodes: allNodes, positions };
}

function getLinkCompatibility(source: GraphNodeModel | undefined, target: GraphNodeModel | undefined) {
  if (!source) return { ok: false, reason: 'Source introuvable.' };
  if (source.kind !== 'inventory' || !source.inventory || !source.resourceType) {
    return { ok: false, reason: 'Seuls les dépôts peuvent envoyer une liaison.' };
  }
  if (!target) return { ok: false, reason: 'Cible introuvable.' };
  if (target.id === source.id) return { ok: false, reason: 'Source identique.' };
  if (target.kind === 'global-market') {
    if (target.businessId !== source.businessId) return { ok: false, reason: 'Le marché global ne sert que son entreprise.' };
    return { ok: true, reason: 'Vente au marché global.' };
  }
  if (target.kind !== 'inventory' || !target.resourceType) {
    return { ok: false, reason: 'Cible incompatible.' };
  }
  if (target.businessId === source.businessId) return { ok: false, reason: 'Reliez plutôt à une autre entreprise ou au marché global.' };
  if (target.resourceType !== source.resourceType) {
    return { ok: false, reason: `${resourceLabel(source.resourceType)} ne va pas vers ${resourceLabel(target.resourceType)}.` };
  }
  return { ok: true, reason: 'Compatible.' };
}

function Connectors({
  links,
  hoveredLinkId,
  onHoverLink,
  onLeaveLink,
}: {
  links: CanvasLink[];
  hoveredLinkId: string | null;
  onHoverLink: (link: CanvasLink) => void;
  onLeaveLink: () => void;
}) {
  return (
    <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
      {links.map((link) => {
        const mx = (link.from.x + link.to.x) / 2;
        const path = `M ${link.from.x} ${link.from.y} C ${mx} ${link.from.y}, ${mx} ${link.to.y}, ${link.to.x} ${link.to.y}`;
        return (
          <g key={link.id}>
            <path
              d={path}
              fill="none"
              stroke={link.color}
              strokeOpacity={link.active ? 0.48 : 0.2}
              strokeDasharray={link.active ? undefined : '5 4'}
              strokeWidth={link.kind === 'supply' && hoveredLinkId === link.id ? 2.6 : 1.8}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {link.active && (
              <circle r="2.8" fill={link.color} opacity="0.85">
                <animateMotion dur={beadDuration(link.ratePerHour ?? 2)} repeatCount="indefinite" path={path} />
              </circle>
            )}
            {link.kind === 'supply' && (
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                strokeLinecap="round"
                onMouseEnter={() => onHoverLink(link)}
                onMouseLeave={onLeaveLink}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BusinessCanvas({
  businesses,
  contracts,
  supplyLinks,
  mode,
  mutating,
  onNodeSelect,
  onBusinessClick,
  onOfferClick,
  onCreateLink,
  onDeleteLink,
}: {
  businesses: YouSupplyBusiness[];
  contracts: YouSupplyContract[];
  supplyLinks: YouSupplyState['links'];
  mode: GraphMode;
  mutating: boolean;
  onNodeSelect: (selection: NodeSelection) => void;
  onBusinessClick: (businessId: string) => void;
  onOfferClick: (selection: Extract<NodeSelection, { kind: 'inventory' | 'offer' }>) => void;
  onCreateLink: (input: { sourceBusinessId: string; sourceResourceType: YouSupplyResourceType; targetBusinessId?: string | null; targetResourceType?: YouSupplyResourceType | null; targetKind: 'BUSINESS' | 'GLOBAL_MARKET' }) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
}) {
  const graph = useMemo(() => layoutBusinesses(businesses, contracts, mode), [businesses, contracts, mode]);
  const drag = useDragCanvas(graph.positions);
  const nodeSize = CARD_SIZE * drag.scale;
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [linkMenuPinned, setLinkMenuPinned] = useState<string | null>(null);
  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  useEffect(() => {
    drag.setScale(mode === 'full' ? 0.62 : 1);
    drag.setPan({ x: mode === 'full' ? 24 : 0, y: mode === 'full' ? 18 : 0 });
  }, [mode, businesses.length]);

  const hoveredTargetId = useMemo(() => {
    if (!draft) return null;
    const point = draft.current;
    for (const node of graph.nodes) {
      const pos = drag.screenPos(node.id);
      const within = point.x >= pos.x && point.x <= pos.x + nodeSize && point.y >= pos.y && point.y <= pos.y + nodeSize;
      if (within) return node.id;
    }
    return null;
  }, [draft, graph.nodes, drag, nodeSize]);

  const hoveredLink = useMemo(
    () => supplyLinks.find((link) => link.id === (linkMenuPinned ?? hoveredLinkId)) ?? null,
    [supplyLinks, hoveredLinkId, linkMenuPinned],
  );

  const renderedLinks = useMemo<CanvasLink[]>(() => {
    const structural = graph.nodes
      .filter((node) => node.kind !== 'business' && node.kind !== 'global-market')
      .map((node) => {
        const nodePos = drag.screenPos(node.id);
        const connectorId = node.connectsTo ?? businessNodeId(node.businessId);
        const connectorPos = drag.screenPos(connectorId);
        if (node.group === 'left') {
          return {
            id: `struct:${node.id}`,
            kind: 'structural' as const,
            from: { x: nodePos.x + nodeSize, y: nodePos.y + nodeSize / 2 },
            to: { x: connectorPos.x, y: connectorPos.y + nodeSize / 2 },
            color: node.accent,
            active: true,
            ratePerHour: node.resourceType && node.kind === 'construction-material' ? 2 : 1,
          };
        }
        if (node.group === 'bottom') {
          return {
            id: `struct:${node.id}`,
            kind: 'structural' as const,
            from: { x: connectorPos.x + nodeSize, y: connectorPos.y + nodeSize / 2 },
            to: { x: nodePos.x, y: nodePos.y + nodeSize / 2 },
            color: node.accent,
            active: false,
          };
        }
        return {
          id: `struct:${node.id}`,
          kind: 'structural' as const,
          from: { x: connectorPos.x + nodeSize, y: connectorPos.y + nodeSize / 2 },
          to: { x: nodePos.x, y: nodePos.y + nodeSize / 2 },
          color: node.accent,
          active: node.kind !== 'global-market',
          ratePerHour: node.inventory?.productionRatePerHour ?? 2,
        };
      });

    const supply = supplyLinks
      .map((link): CanvasLink | null => {
        const sourceNode = nodesById.get(inventoryNodeId(link.sourceBusinessId, link.sourceResourceType));
        if (!sourceNode?.inventory) return null;
        const targetNodeId = link.targetKind === 'GLOBAL_MARKET'
          ? globalMarketNodeId(link.sourceBusinessId)
          : link.targetBusinessId && link.targetResourceType
            ? inventoryNodeId(link.targetBusinessId, link.targetResourceType)
            : null;
        if (!targetNodeId) return null;
        const targetNode = nodesById.get(targetNodeId);
        if (!targetNode) return null;
        const fromPos = drag.screenPos(sourceNode.id);
        const toPos = drag.screenPos(targetNode.id);
        const ratePerHour = Math.max(1, Math.min(
          sourceNode.inventory.productionRatePerHour,
          link.maxUnitsPerHour ?? sourceNode.inventory.productionRatePerHour,
        ));

        let etaLabel: string | null = null;
        if (targetNode.kind === 'inventory' && targetNode.inventory) {
          const remaining = Math.max(0, targetNode.inventory.capacity - targetNode.inventory.quantity);
          etaLabel = formatEta(remaining > 0 ? remaining / ratePerHour : 0);
        }

        return {
          id: link.id,
          kind: 'supply' as const,
          from: { x: fromPos.x + nodeSize, y: fromPos.y + nodeSize / 2 },
          to: { x: toPos.x, y: toPos.y + nodeSize / 2 },
          color: link.targetKind === 'GLOBAL_MARKET' ? '#f97316' : '#60a5fa',
          active: true,
          ratePerHour,
          etaLabel,
          removable: true,
          midpoint: { x: (fromPos.x + nodeSize + toPos.x) / 2, y: (fromPos.y + toPos.y) / 2 + nodeSize / 2 },
        };
      })
      .filter((entry): entry is CanvasLink => entry !== null);

    if (draft) {
      const sourcePos = drag.screenPos(draft.sourceNodeId);
      const snappedTo = hoveredTargetId ? drag.screenPos(hoveredTargetId) : null;
      structural.push({
        id: 'draft-link',
        kind: 'structural',
        from: getHandlePosition(sourcePos, draft.side, drag.scale),
        to: snappedTo ? { x: snappedTo.x + nodeSize / 2, y: snappedTo.y + nodeSize / 2 } : draft.current,
        color: hoveredTargetId
          ? (getLinkCompatibility(nodesById.get(draft.sourceNodeId), nodesById.get(hoveredTargetId)).ok ? '#22c55e' : '#ef4444')
          : '#94a3b8',
        active: true,
      });
    }

    return [...structural, ...supply];
  }, [graph.nodes, drag, supplyLinks, nodesById, draft, hoveredTargetId, nodeSize]);

  const compatibility = draft && hoveredTargetId
    ? getLinkCompatibility(nodesById.get(draft.sourceNodeId), nodesById.get(hoveredTargetId))
    : null;

  async function finishDraft() {
    if (!draft) return setDraft(null);
    if (!hoveredTargetId) return setDraft(null);
    const sourceNode = nodesById.get(draft.sourceNodeId);
    const targetNode = nodesById.get(hoveredTargetId);
    const result = getLinkCompatibility(sourceNode, targetNode);
    if (!result.ok || !sourceNode?.resourceType) {
      setDraft(null);
      return;
    }
    await onCreateLink({
      sourceBusinessId: sourceNode.businessId,
      sourceResourceType: sourceNode.resourceType,
      targetKind: targetNode?.kind === 'global-market' ? 'GLOBAL_MARKET' : 'BUSINESS',
      targetBusinessId: targetNode?.kind === 'inventory' ? targetNode.businessId : null,
      targetResourceType: targetNode?.kind === 'inventory' ? targetNode.resourceType ?? null : null,
    });
    setDraft(null);
  }

  return (
    <div
      ref={drag.canvasRef}
      className="relative flex-1 overflow-hidden"
      onMouseDown={drag.onCanvasDown}
      onMouseMove={(event) => {
        drag.onMove(event);
        if (draft) {
          const rect = drag.canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
          setDraft((current) => current ? ({
            ...current,
            current: { x: event.clientX - rect.left, y: event.clientY - rect.top },
          }) : null);
        }
      }}
      onMouseUp={() => { void finishDraft(); drag.stopAll(); }}
      onMouseLeave={() => { setDraft(null); drag.stopAll(); }}
      onWheel={drag.onWheel}
      onClick={() => onNodeSelect(null)}
      style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.65) 1px, transparent 1px)',
        backgroundSize: `${24 * drag.scale}px ${24 * drag.scale}px`,
        backgroundPosition: `${drag.pan.x}px ${drag.pan.y}px`,
      }}
    >
      <Connectors
        links={renderedLinks}
        hoveredLinkId={hoveredLinkId}
        onHoverLink={(link) => setHoveredLinkId(link.id)}
        onLeaveLink={() => setHoveredLinkId(null)}
      />

      {graph.nodes.map((node) => {
        const pos = drag.screenPos(node.id);
        const business = businesses.find((entry) => entry.id === node.businessId) ?? null;
        const workWarning = Boolean(
          business && PRODUCER_TYPES.has(business.typeKey) && !business.underConstruction && (business.workRatio ?? 1) === 0 && business.members.length > 0,
        );
        return (
          <NodeCard
            key={node.id}
            pos={pos}
            accent={node.accent}
            icon={node.icon}
            title={node.title}
            subtitle={node.subtitle}
            footer={node.footer}
            active={node.kind === 'business'}
            construction={node.construction}
            workWarning={workWarning && node.kind === 'inventory'}
            scale={drag.scale}
            onDragStart={(event) => drag.startDrag(node.id, event)}
            onClick={() => {
              if (node.kind === 'business') {
                onNodeSelect(null);
                onBusinessClick(node.businessId);
                return;
              }
              onNodeSelect(node.selection);
            }}
            onHoverChange={(hovering) => setHoveredNodeId(hovering ? node.id : null)}
            showHandles={hoveredNodeId === node.id || draft?.sourceNodeId === node.id}
            onHandleMouseDown={(side, event) => {
              event.stopPropagation();
              const start = getHandlePosition(pos, side, drag.scale);
              setDraft({
                sourceNodeId: node.id,
                sourceBusinessId: node.businessId,
                sourceResourceType: (node.resourceType ?? 'FOOD') as YouSupplyResourceType,
                side,
                current: { x: start.x, y: start.y },
              });
              setHoveredNodeId(node.id);
            }}
            shouldSuppressClick={drag.consumeSuppressClick}
            badge={node.kind === 'inventory' ? {
              icon: <Tag size={11} />,
              title: node.offer?.isActive ? `Offre ${node.offer.unitPrice}/u` : 'Configurer la vente',
              accent: node.offer?.isActive ? (node.offer.autoAccept ? '#22c55e' : '#f59e0b') : '#94a3b8',
              onClick: () => onOfferClick(node.offer ? { kind: 'offer', business: business!, offer: node.offer } : { kind: 'inventory', business: business!, inventory: node.inventory! }),
            } : undefined}
          />
        );
      })}

      {compatibility && hoveredTargetId && draft && (
        <div
          className={cn(
            'absolute z-30 rounded-md border px-2 py-1 text-[10px] shadow-lg',
            compatibility.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-300',
          )}
          style={{
            left: draft.current.x + 12,
            top: draft.current.y + 12,
          }}
        >
          {compatibility.reason}
        </div>
      )}

      {hoveredLink && (() => {
        const sourceNode = nodesById.get(inventoryNodeId(hoveredLink.sourceBusinessId, hoveredLink.sourceResourceType));
        const targetNodeId = hoveredLink.targetKind === 'GLOBAL_MARKET'
          ? globalMarketNodeId(hoveredLink.sourceBusinessId)
          : hoveredLink.targetBusinessId && hoveredLink.targetResourceType
            ? inventoryNodeId(hoveredLink.targetBusinessId, hoveredLink.targetResourceType)
            : null;
        const targetNode = targetNodeId ? nodesById.get(targetNodeId) : null;
        const ratePerHour = Math.max(1, Math.min(
          sourceNode?.inventory?.productionRatePerHour ?? 1,
          hoveredLink.maxUnitsPerHour ?? sourceNode?.inventory?.productionRatePerHour ?? 1,
        ));
        const etaLabel = targetNode?.kind === 'inventory' && targetNode.inventory
          ? formatEta(Math.max(0, targetNode.inventory.capacity - targetNode.inventory.quantity) / ratePerHour)
          : null;
        const linkPosition = renderedLinks.find((entry) => entry.id === hoveredLink.id)?.midpoint ?? { x: 80, y: 80 };
        return (
          <div
            className="absolute z-40 w-52 rounded-lg border border-border bg-card p-3 shadow-2xl"
            style={{ left: linkPosition.x - 96, top: linkPosition.y - 44 }}
            onMouseEnter={() => setLinkMenuPinned(hoveredLink.id)}
            onMouseLeave={() => setLinkMenuPinned(null)}
          >
            <p className="text-[10px] font-semibold text-foreground">
              {sourceNode ? resourceLabel(sourceNode.resourceType ?? hoveredLink.sourceResourceType) : resourceLabel(hoveredLink.sourceResourceType)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">Débit: {ratePerHour} u/h</p>
            {etaLabel && <p className="text-[10px] text-muted-foreground">ETA remplissage: {etaLabel}</p>}
            {hoveredLink.targetKind === 'GLOBAL_MARKET' && (
              <p className="text-[10px] text-muted-foreground">Vente auto au prix fixe.</p>
            )}
            <button
              onClick={() => void onDeleteLink(hoveredLink.id)}
              disabled={mutating}
              className="mt-2 flex w-full items-center justify-center rounded-md border border-red-500/25 px-2 py-1.5 text-[10px] font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Casser la liaison
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('text-[11px] font-semibold tabular-nums', accent ?? 'text-foreground')}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="pb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">{children}</p>;
}

function DetailPanel({
  selection,
  onClose,
  onSaveOffer,
  onChooseSource,
  onCancelContract,
  onUpdateMember,
  onRespondLoan,
  onRemindLoan,
  onClaimLoan,
  onAcceptPlainte,
}: {
  selection: NodeSelection;
  onClose: () => void;
  onSaveOffer: (businessId: string, resourceType: YouSupplyResourceType, unitPrice: number, autoAccept: boolean, isActive?: boolean) => Promise<void>;
  onChooseSource: (business: YouSupplyBusiness, material: YouConstructionMaterial) => void;
  onCancelContract: (contractId: string) => Promise<void>;
  onUpdateMember: (businessId: string, memberId: string, data: { role: string; salary: number; title: string | null }) => Promise<void>;
  onRespondLoan: (loanId: string, decision: 'accept' | 'reject') => Promise<void>;
  onRemindLoan: (loanId: string) => Promise<void>;
  onClaimLoan: (loanId: string) => Promise<void>;
  onAcceptPlainte: (plainteId: string) => Promise<void>;
}) {
  const [price, setPrice] = useState(10);
  const [autoAccept, setAutoAccept] = useState(false);
  const [memberRole, setMemberRole] = useState('');
  const [memberSalary, setMemberSalary] = useState(0);
  const [memberTitle, setMemberTitle] = useState('');

  useEffect(() => {
    if (selection?.kind === 'inventory') {
      const existing = selection.business.offers.find((o) => o.resourceType === selection.inventory.resourceType);
      setPrice(existing?.unitPrice ?? 10);
      setAutoAccept(existing?.autoAccept ?? false);
      return;
    }
    if (selection?.kind === 'team') {
      const member = selection.item as YouBusinessMember;
      setMemberRole(member.role ?? '');
      setMemberSalary(member.salary ?? 0);
      setMemberTitle(member.specialty ?? '');
    }
  }, [selection]);

  const resourceType =
    selection?.kind === 'inventory' ? selection.inventory.resourceType :
    selection?.kind === 'construction-material' ? selection.material.resourceType :
    selection?.kind === 'offer' ? selection.offer.resourceType :
    selection?.kind === 'contract' ? selection.contract.resourceType : null;

  const iconHex = selection
    ? (resourceType
        ? (RESOURCE_HEX[resourceType] ?? '#94a3b8')
        : selection.kind === 'team'
          ? ((selection.item as YouBusinessMember).isPrimaryLawyer ? '#22c55e' : '#8b5cf6')
          : businessColor(selection.business.typeKey))
    : '#94a3b8';

  const resMeta = resourceType ? RESOURCE_META[resourceType as ResourceType] : null;

  const HeaderIcon: React.ComponentType<{ size?: number; className?: string }> =
    resMeta?.Icon ??
    (selection?.kind === 'loan' ? Landmark :
     selection?.kind === 'case' ? Gavel :
     selection?.kind === 'plainte' ? Gavel :
     selection?.kind === 'team' ? User :
     selection?.kind === 'formation' ? GraduationCap :
     selection?.kind === 'startup' ? Play :
     (selection?.kind === 'transfer' || selection?.kind === 'account') ? Banknote :
     Package);

  const titleText = selection
    ? (selection.kind === 'inventory' ? resourceLabel(selection.inventory.resourceType) :
       selection.kind === 'construction-material' ? resourceLabel(selection.material.resourceType) :
       selection.kind === 'offer' ? `Offre · ${resourceLabel(selection.offer.resourceType)}` :
       selection.kind === 'contract' ? resourceLabel(selection.contract.resourceType) :
       selection.kind === 'plainte' ? selection.plainte.title :
       selection.kind === 'team' ? (selection.item as YouBusinessMember).user.username :
       selection.item.title ?? selection.business.name)
    : '';
  const title = selection?.kind === 'team'
    ? <UserName user={(selection.item as YouBusinessMember).user} preset="full" clickable />
    : titleText;

  const panelLabel = selection
    ? (selection.kind === 'inventory' ? 'Dépôt de ressource' :
       selection.kind === 'construction-material' ? 'Matériau · chantier' :
       selection.kind === 'offer' ? 'Offre de vente' :
       selection.kind === 'plainte' ? 'Plainte en attente' :
       selection.kind === 'team' ? 'Employé' :
       selection.kind === 'contract'
         ? (selection.contract.supplierBusinessId === selection.business.id ? 'Contrat sortant →' : '← Contrat entrant')
         : 'Détails')
    : '';

  return (
    <Dialog open={!!selection} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{titleText}</DialogTitle>

        {/* Colored header */}
        <div
          className="flex items-center gap-3 border-b border-border/40 px-5 py-4"
          style={{ background: `linear-gradient(135deg, ${iconHex}14 0%, transparent 60%)` }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${iconHex}20`, color: iconHex, border: `1.5px solid ${iconHex}35` }}
          >
            <HeaderIcon size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/45">{panelLabel}</p>
            <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{title}</p>
            {selection && <p className="truncate text-[10px] text-muted-foreground/55">{selection.business.name}</p>}
          </div>
        </div>

        {/* Scrollable body */}
        <ScrollArea className="max-h-[72vh]">
          <div className="px-5 pb-6 pt-4">

            {/* ── Inventory ── */}
            {selection?.kind === 'inventory' && (() => {
              const pct = selection.inventory.capacity > 0
                ? Math.min(100, Math.round((selection.inventory.quantity / selection.inventory.capacity) * 100))
                : 0;
              const bColor = businessColor(selection.business.typeKey);
              const existingOffer = selection.business.offers.find((o) => o.resourceType === selection.inventory.resourceType);
              return (
                <>
                  {/* Stock number + bar — no box */}
                  <div className="mb-4">
                    <div className="flex items-end justify-between">
                      <span className="text-[32px] font-bold tabular-nums leading-none" style={{ color: bColor }}>
                        {selection.inventory.quantity}
                      </span>
                      <span className="mb-1 text-[12px] text-muted-foreground">/ {selection.inventory.capacity} u</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bColor }} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground/50">{pct}% · {selection.inventory.productionRatePerHour} u/h produits</p>
                  </div>

                  {/* Stats — flat divide-y */}
                  <div className="divide-y divide-border/40">
                    <StatRow label="Production" value={`${selection.inventory.productionRatePerHour} u/h`} />
                    <StatRow label="Capacité" value={`${pct}%`} />
                    <StatRow
                      label="Offre active"
                      value={existingOffer?.isActive ? `${existingOffer.unitPrice} money/u · ${existingOffer.autoAccept ? 'auto' : 'manuelle'}` : 'Aucune'}
                      accent={existingOffer?.isActive ? 'text-emerald-400' : undefined}
                    />
                  </div>

                  {/* Sell section — separated by a border-t, no wrapper box */}
                  <div className="mt-5 border-t border-border/40 pt-5">
                    <SectionLabel>{existingOffer ? 'Modifier l\'offre' : 'Vendre cette ressource'}</SectionLabel>

                    <div className="mb-3">
                      <p className="mb-1.5 text-[11px] text-muted-foreground">Prix par unité</p>
                      <div className="relative">
                        <input
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          type="number"
                          min={1}
                          className="h-11 w-full rounded-lg border border-border bg-background pl-4 pr-24 text-[16px] font-bold outline-none transition-colors focus:border-amber-400/50"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-medium text-muted-foreground">money / u</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAutoAccept(!autoAccept)}
                      className="mb-4 flex w-full items-center justify-between py-2"
                    >
                      <span className="text-[12px] text-muted-foreground">Acceptation automatique</span>
                      <div className={cn('relative h-5 w-9 rounded-full transition-colors duration-200', autoAccept ? 'bg-emerald-500' : 'bg-muted/60')}>
                        <div
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200"
                          style={{ left: autoAccept ? '19px' : '2px' }}
                        />
                      </div>
                    </button>

                    <button
                      onClick={() => void onSaveOffer(selection.business.id, selection.inventory.resourceType, price, autoAccept, true)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.99]"
                    >
                      <Check size={14} />
                      {existingOffer ? 'Mettre à jour' : 'Publier l\'offre'}
                    </button>

                    {existingOffer?.isActive && (
                      <button
                        onClick={() => void onSaveOffer(selection.business.id, selection.inventory.resourceType, existingOffer.unitPrice, existingOffer.autoAccept, false)}
                        className="mt-2.5 w-full text-center text-[11px] text-red-400/80 transition-colors hover:text-red-400"
                      >
                        Désactiver l'offre
                      </button>
                    )}
                  </div>
                </>
              );
            })()}

            {/* ── Construction material ── */}
            {selection?.kind === 'construction-material' && (() => {
              const { deliveredQuantity, requiredQuantity } = selection.material;
              const remaining = Math.max(0, requiredQuantity - deliveredQuantity);
              const pct = requiredQuantity > 0 ? Math.min(100, Math.round((deliveredQuantity / requiredQuantity) * 100)) : 100;
              const done = remaining === 0;
              const ac = selection.activeContract;
              const hasLiveContract = ac && ac.status !== 'COMPLETED' && ac.status !== 'REJECTED' && ac.status !== 'CANCELLED';
              return (
                <>
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Livraison</span>
                      <span className="font-mono font-semibold" style={{ color: done ? '#22c55e' : '#fbbf24' }}>{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#22c55e' : '#fbbf24' }} />
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <StatRow label="Reçu" value={String(deliveredQuantity)} accent={deliveredQuantity > 0 ? 'text-emerald-400' : undefined} />
                    <StatRow label="Requis" value={String(requiredQuantity)} />
                    <StatRow label="Reste" value={String(remaining)} accent={done ? 'text-emerald-400' : 'text-amber-400'} />
                  </div>
                  {hasLiveContract && (
                    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
                        {ac.status === 'PENDING' ? 'En attente d\'approbation' : 'Livraison en cours'}
                      </p>
                      <p className="text-[12px] font-semibold text-foreground">{ac.supplier?.name ?? 'Fournisseur'}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {ac.deliveredQuantity}/{ac.totalQuantity} unités · {ac.unitPrice} money/u
                      </p>
                      {ac.status === 'PENDING' && (
                        <p className="mt-1.5 text-[10px] text-amber-400">Le fournisseur doit accepter la demande avant toute livraison.</p>
                      )}
                    </div>
                  )}
                  <div className="mt-4 space-y-2">
                    {done ? (
                      <p className="flex items-center gap-2 text-[12px] font-semibold text-emerald-500">
                        <Check size={14} /> Matériau prêt
                      </p>
                    ) : !hasLiveContract ? (
                      <button
                        onClick={() => onChooseSource(selection.business, selection.material)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
                      >
                        <Package size={13} /> Choisir une source
                      </button>
                    ) : null}
                    {hasLiveContract && (
                      <button
                        onClick={() => void onCancelContract(ac.id)}
                        className="w-full rounded-lg border border-red-500/30 py-2.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        Annuler le contrat
                      </button>
                    )}
                  </div>
                </>
              );
            })()}

            {/* ── Offer ── */}
            {selection?.kind === 'offer' && (
              <>
                <div className="divide-y divide-border/40">
                  <StatRow label="Prix par unité" value={`${selection.offer.unitPrice} money / u`} />
                  <StatRow
                    label="Validation"
                    value={selection.offer.autoAccept ? 'Automatique' : 'Manuelle'}
                    accent={selection.offer.autoAccept ? 'text-emerald-400' : 'text-amber-400'}
                  />
                  <StatRow label="Ressource" value={resourceLabel(selection.offer.resourceType)} />
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => void onSaveOffer(selection.business.id, selection.offer.resourceType, selection.offer.unitPrice, selection.offer.autoAccept, !selection.offer.isActive)}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[12px] font-semibold transition-colors',
                      selection.offer.isActive
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/15'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15',
                    )}
                  >
                    {selection.offer.isActive ? 'Désactiver l\'offre' : 'Réactiver l\'offre'}
                  </button>
                </div>
              </>
            )}

            {/* ── Contract ── */}
            {selection?.kind === 'contract' && (() => {
              const outgoing = selection.contract.supplierBusinessId === selection.business.id;
              const status = selection.contract.status;
              const pct = selection.contract.totalQuantity > 0
                ? Math.min(100, Math.round((selection.contract.deliveredQuantity / selection.contract.totalQuantity) * 100))
                : 0;
              const statusColor = status === 'ACTIVE' ? '#38bdf8' : status === 'PENDING' ? '#f59e0b' : '#94a3b8';
              const counterpart = outgoing ? selection.contract.buyer?.name : selection.contract.supplier?.name;
              return (
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${statusColor}20`, color: statusColor }}>
                      {status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{outgoing ? '→ vers' : '← de'} {counterpart}</span>
                  </div>
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Livraison</span>
                      <span className="font-mono">{selection.contract.deliveredQuantity}/{selection.contract.totalQuantity}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: statusColor }} />
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <StatRow label={outgoing ? 'Client' : 'Fournisseur'} value={counterpart ?? '—'} />
                    <StatRow label="Ressource" value={resourceLabel(selection.contract.resourceType)} />
                    <StatRow label="Prix" value={`${selection.contract.unitPrice} money / u`} />
                    <StatRow label="Total" value={money(selection.contract.totalQuantity * selection.contract.unitPrice)} />
                    <StatRow label="Reste à livrer" value={String(selection.contract.totalQuantity - selection.contract.deliveredQuantity)} />
                  </div>
                </>
              );
            })()}

            {/* ── Team member ── */}
            {selection?.kind === 'team' && (() => {
              const member = selection.item as YouBusinessMember;
              const u = member.user as DisplayUser;
              const accent = member.isPrimaryLawyer ? '#22c55e' : '#8b5cf6';
              return (
                <>
                  {/* Profile — inline, no border box */}
                  <div className="mb-4 flex items-center gap-3">
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt={u.username} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: `${accent}22`, color: accent }}>
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <UsernameDisplay
                        username={u.username}
                        userId={u.id}
                        firstName={u.firstName}
                        usernameColor={u.usernameColor}
                        badges={u.badges}
                        preset="full"
                        clickable
                        usernameClassName="font-semibold text-foreground"
                      />
                      {u.bio && <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground/60">{u.bio}</p>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="divide-y divide-border/40">
                    <StatRow label="Rôle" value={member.role} />
                    <StatRow label="Salaire" value={member.salary > 0 ? `${member.salary.toLocaleString('fr-FR')} /j` : 'Bénévole'} accent={member.salary > 0 ? 'text-emerald-400' : undefined} />
                    {member.specialty && <StatRow label="Spécialité" value={member.specialty} />}
                    {member.isPrimaryLawyer && <StatRow label="Avocat principal" value="Oui" accent="text-emerald-400" />}
                    <StatRow label="Aura" value={Number(u.aura).toLocaleString('fr-FR')} />
                  </div>

                  {/* Edit form — separated by border-t, no wrapper box */}
                  <div className="mt-5 border-t border-border/40 pt-5 space-y-3">
                    <SectionLabel>Modifier ce membre</SectionLabel>
                    <div>
                      <p className="mb-1.5 text-[11px] text-muted-foreground">Rôle</p>
                      <input value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-primary/40" />
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] text-muted-foreground">Salaire / jour</p>
                      <input value={memberSalary} onChange={(e) => setMemberSalary(Number(e.target.value))} type="number" min={0} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-primary/40" />
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] text-muted-foreground">Titre / spécialité</p>
                      <input value={memberTitle} onChange={(e) => setMemberTitle(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-primary/40" />
                    </div>
                    <button
                      onClick={() => void onUpdateMember(selection.business.id, member.id, { role: memberRole, salary: memberSalary, title: memberTitle || null })}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <Check size={13} /> Enregistrer
                    </button>
                  </div>
                </>
              );
            })()}

            {/* ── Loan ── */}
            {selection?.kind === 'loan' && (() => {
              const loan = selection.item;
              const remaining = Math.max(0, loan.totalOwed - loan.repaidAmount);
              return (
                <>
                  <div className="divide-y divide-border/40">
                    <StatRow label="Emprunteur" value={<UserName user={loan.borrower} preset="no-badge" clickable />} />
                    <StatRow label="Montant" value={money(loan.amount)} />
                    <StatRow label="Taux" value={`${loan.interestRate}%`} />
                    <StatRow label="Reste" value={money(remaining)} />
                    <StatRow label="Statut" value={loan.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {loan.status === 'PENDING' ? (
                      <>
                        <button onClick={() => void onRespondLoan(loan.id, 'reject')} className="rounded-lg border border-border py-2.5 text-[12px] text-muted-foreground hover:bg-muted">Refuser</button>
                        <button onClick={() => void onRespondLoan(loan.id, 'accept')} className="rounded-lg bg-emerald-600 py-2.5 text-[12px] font-semibold text-white hover:opacity-90">Accepter</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => void onRemindLoan(loan.id)} className="rounded-lg border border-border py-2.5 text-[12px] text-muted-foreground hover:bg-muted">Relancer</button>
                        <button onClick={() => void onClaimLoan(loan.id)} className="rounded-lg bg-amber-500 py-2.5 text-[12px] font-semibold text-black hover:opacity-90">Saisir</button>
                      </>
                    )}
                  </div>
                </>
              );
            })()}

            {/* ── Bank account ── */}
            {selection?.kind === 'account' && (() => {
              const account = selection.item;
              return (
                <div className="divide-y divide-border/40">
                  <StatRow label="Titulaire" value={<UserName user={account.user} preset="no-badge" clickable />} />
                  <StatRow label="Type" value={account.accountType} />
                  <StatRow label="Solde" value={money(account.balance)} />
                  <StatRow label="Ouvert le" value={account.createdAt ? new Date(account.createdAt).toLocaleDateString('fr-FR') : '—'} />
                </div>
              );
            })()}

            {/* ── Court case ── */}
            {selection?.kind === 'case' && (() => {
              const courtCase = selection.item;
              return (
                <>
                  <div className="divide-y divide-border/40">
                    <StatRow label="Titre" value={courtCase.title} />
                    <StatRow label="Statut" value={courtCase.status} />
                    <StatRow label="Partie" value={courtCase.side} />
                    <StatRow label="Avocat" value={<UserName user={courtCase.lawyer} fallback="Non assigné" preset="no-badge" clickable />} />
                    <StatRow label="Plaignant" value={<UserName user={courtCase.plaintif} preset="no-badge" clickable />} />
                    <StatRow label="Défendeur" value={<UserName user={courtCase.defendant} preset="no-badge" clickable />} />
                  </div>
                  {courtCase.plainte && (
                    <div className="mt-4 border-t border-border/40 pt-4">
                      <p className="text-[12px] font-semibold text-foreground">{courtCase.plainte.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{courtCase.plainte.description}</p>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Plainte ── */}
            {selection?.kind === 'plainte' && (
              <>
                <div className="divide-y divide-border/40">
                  <StatRow label="Plaignant" value={<UserName user={selection.plainte.plaintif} preset="no-badge" clickable />} />
                  <StatRow label="Défendeur" value={<UserName user={selection.plainte.defendant} preset="no-badge" clickable />} />
                  <StatRow label="Statut" value={selection.plainte.status} />
                </div>
                <div className="mt-4 border-t border-border/40 pt-4">
                  <p className="text-[12px] font-semibold text-foreground">{selection.plainte.title}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{selection.plainte.description}</p>
                  {selection.plainte.evidence && (
                    <p className="mt-2 text-[10px] italic text-muted-foreground/50">Preuve : {selection.plainte.evidence}</p>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => void onAcceptPlainte(selection.plainte.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Check size={13} /> Accepter le dossier
                  </button>
                </div>
              </>
            )}

            {/* ── Fallback JSON ── */}
            {selection && selection.kind !== 'inventory' && selection.kind !== 'construction-material' && selection.kind !== 'offer' && selection.kind !== 'contract' && selection.kind !== 'team' && selection.kind !== 'loan' && selection.kind !== 'account' && selection.kind !== 'case' && selection.kind !== 'plainte' && (
              <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-3 text-[10px] text-muted-foreground">
                {JSON.stringify(selection.item, null, 2)}
              </pre>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
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
    <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-l border-border bg-card" data-tutorial-id="supply-orders-sidebar">
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
                    {(() => {
                      const BizIcon = getBizIcon(offer.business?.typeKey ?? '');
                      return <BizIcon className="h-4 w-4" />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[12px] font-semibold text-foreground">{offer.business?.name ?? 'Business'}</p>
                      {isCheapest && <span className="rounded bg-emerald-500/15 px-1 text-[8px] font-bold text-emerald-500">MOINS CHER</span>}
                    </div>
                    <p className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
                      <span>@</span>
                      <UserName user={offer.business?.owner} fallback="serveur" preset="minimal" usernameClassName="text-[10px]" />
                      <span className="shrink-0">· {offer.availableQuantity ?? 0} en stock</span>
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
  const [viewMode, setViewMode] = useState<GraphMode>('single');
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

  async function cancelContract(contractId: string) {
    await mutate(async () => {
      await youApi.cancelSupplyContract(contractId);
      setNodeSelection(null);
    });
  }

  async function updateMember(businessId: string, memberId: string, data: { role: string; salary: number; title: string | null }) {
    await mutate(async () => {
      await youApi.updateMemberRole(businessId, memberId, data.role);
      await youApi.updateMemberSalary(businessId, memberId, Math.max(0, Math.floor(data.salary || 0)));
      await youApi.updateMemberProfile(businessId, memberId, data.title);
    });
  }

  async function respondLoan(loanId: string, decision: 'accept' | 'reject') {
    await mutate(async () => {
      await youApi.respondToBusinessLoan(loanId, decision);
    });
  }

  async function remindLoan(loanId: string) {
    await mutate(async () => {
      await youApi.remindLoan(loanId);
      toast.success('Relance envoyée');
    });
  }

  async function claimLoan(loanId: string) {
    await mutate(async () => {
      await youApi.repayLoan(loanId);
    });
  }

  async function acceptPlainte(plainteId: string) {
    await mutate(async () => {
      await justiceApi.acceptPlainte(plainteId);
      setNodeSelection(null);
    });
  }

  async function createLink(input: { sourceBusinessId: string; sourceResourceType: YouSupplyResourceType; targetBusinessId?: string | null; targetResourceType?: YouSupplyResourceType | null; targetKind: 'BUSINESS' | 'GLOBAL_MARKET' }) {
    await mutate(async () => {
      await youApi.createSupplyLink(input.sourceBusinessId, input);
    });
  }

  async function deleteLink(linkId: string) {
    await mutate(async () => {
      await youApi.deleteSupplyLink(linkId);
    });
  }

  const visibleBusinesses = viewMode === 'full'
    ? (state?.businesses ?? [])
    : activeBusiness ? [activeBusiness] : [];

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

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden" data-tutorial-id="supply-nodes-pane">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-4">
          {activeBusiness ? (
            <>
              <div className="flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-bold" style={{ background: `${businessColor(activeBusiness.typeKey)}22`, color: businessColor(activeBusiness.typeKey) }}>
                {(() => {
                  const BizIcon = getBizIcon(activeBusiness.typeKey);
                  return <BizIcon className="h-3.5 w-3.5" />;
                })()}
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
              <div className="flex rounded-md border border-border p-0.5 text-[10px]">
                <button className={cn('rounded px-2 py-1', viewMode === 'single' && 'bg-muted text-foreground')} onClick={() => setViewMode('single')}>Entreprise</button>
                <button className={cn('rounded px-2 py-1', viewMode === 'full' && 'bg-muted text-foreground')} onClick={() => setViewMode('full')}>Vue totale</button>
              </div>
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
            <BusinessCanvas
              businesses={visibleBusinesses}
              contracts={state?.contracts ?? []}
              supplyLinks={state?.links ?? []}
              mode={viewMode}
              mutating={mutating}
              onNodeSelect={setNodeSelection}
              onBusinessClick={(businessId) => {
                setSelection({ kind: 'business', id: businessId });
                setManageBusinessId(businessId);
              }}
              onOfferClick={setNodeSelection}
              onCreateLink={createLink}
              onDeleteLink={deleteLink}
            />
            <DetailPanel
              selection={nodeSelection}
              onClose={() => setNodeSelection(null)}
              onSaveOffer={saveOffer}
              onChooseSource={(business, material) => setSourceTarget({ business, material })}
              onCancelContract={cancelContract}
              onUpdateMember={updateMember}
              onRespondLoan={respondLoan}
              onRemindLoan={remindLoan}
              onClaimLoan={claimLoan}
              onAcceptPlainte={acceptPlainte}
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
              className="flex h-24 w-24 items-center justify-center rounded-3xl shadow-xl"
              style={{ background: `${businessColor(completedBusiness.typeKey)}22`, color: businessColor(completedBusiness.typeKey) }}
            >
              {(() => {
                const BizIcon = getBizIcon(completedBusiness.typeKey);
                return <BizIcon className="h-12 w-12" />;
              })()}
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
