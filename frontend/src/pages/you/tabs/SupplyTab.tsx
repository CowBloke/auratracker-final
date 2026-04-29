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
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import {
  youApi,
  type YouSupplyBusiness,
  type YouConstructionMaterial,
  type YouSupplyContract,
  type YouSupplyInventory,
  type YouSupplyOffer,
  type YouSupplyResourceType,
  type YouSupplyState,
} from '@/services/api';

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
}: {
  businesses: YouSupplyBusiness[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <nav className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <p className="mb-0.5 text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Registre</p>
        <p className="text-sm font-semibold text-foreground">{businesses.length} entreprise{businesses.length !== 1 ? 's' : ''}</p>
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
                  {underConstruction && <span className="rounded-full px-1.5 text-[8px] font-bold text-black" style={{ background: CONSTRUCTION_STRIPES }}>BUILD</span>}
                  {pending > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[8px] font-bold text-amber-500">{pending}</span>}
                </div>
                <p className="truncate text-[9px] text-muted-foreground/60">{BIZ_LABEL[business.typeKey] ?? business.typeKey}</p>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: underConstruction ? `${progress}%` : capacity > 0 ? `${Math.min(100, Math.round((storage / capacity) * 100))}%` : '0%',
                      background: underConstruction ? CONSTRUCTION_STRIPES : color,
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
    group: 'left' | 'right' | 'bottom';
    construction?: boolean;
  }> = [];
  const color = businessColor(business.typeKey);

  if (business.underConstruction && business.constructionProject) {
    business.constructionProject.materials.forEach((material) => {
      const meta = RESOURCE_META[material.resourceType as ResourceType];
      const Icon = meta?.Icon ?? Hammer;
      const remaining = Math.max(0, material.requiredQuantity - material.deliveredQuantity);
      nodes.push({
        id: `material:${material.id}`,
        accent: remaining === 0 ? '#22c55e' : '#facc15',
        icon: <Icon size={17} />,
        title: resourceLabel(material.resourceType),
        subtitle: remaining === 0 ? 'Pret' : `${remaining} requis`,
        footer: `${material.deliveredQuantity}/${material.requiredQuantity}`,
        selection: { kind: 'construction-material', business, material },
        group: 'left',
        construction: true,
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
        title: resourceLabel(inventory.resourceType),
        subtitle: `${inventory.productionRatePerHour} u/h`,
        footer: `${inventory.quantity}/${inventory.capacity}`,
        selection: { kind: 'inventory', business, inventory },
        group: 'left',
      });
    });

    business.offers.forEach((offer) => {
      nodes.push({
        id: `offer:${offer.id}`,
        accent: offer.autoAccept ? '#22c55e' : '#f59e0b',
        icon: <Package size={17} />,
        title: `Offre ${resourceLabel(offer.resourceType)}`,
        subtitle: offer.autoAccept ? 'Auto-acceptee' : 'Validation manuelle',
        footer: `${offer.unitPrice}/u`,
        selection: { kind: 'offer', business, offer },
        group: 'right',
      });
    });
  }

  contracts
    .filter((contract) => contract.supplierBusinessId === business.id || contract.buyerBusinessId === business.id)
    .forEach((contract) => {
      const outgoing = contract.supplierBusinessId === business.id;
      nodes.push({
        id: `contract:${contract.id}`,
        accent: contract.status === 'ACTIVE' ? '#38bdf8' : contract.status === 'PENDING' ? '#f59e0b' : '#94a3b8',
        icon: <Briefcase size={17} />,
        title: outgoing ? contract.buyer?.name ?? 'Client' : contract.supplier?.name ?? 'Fournisseur',
        subtitle: `${resourceLabel(contract.resourceType)} · ${contract.status}`,
        footer: `${contract.deliveredQuantity}/${contract.totalQuantity}`,
        selection: { kind: 'contract', business, contract },
        group: 'right',
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

  if (business.typeKey === 'law_firm') {
    business.members.forEach((member) => nodes.push({
      id: `member:${member.id}`,
      accent: member.isPrimaryLawyer ? '#22c55e' : '#06b6d4',
      icon: <Briefcase size={17} />,
      title: member.user.username,
      subtitle: member.role,
      footer: member.specialty ?? 'Generaliste',
      selection: { kind: 'team', business, item: member },
      group: 'bottom',
    }));
  }

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
  const positions: Positions = { business: { x: 300, y: 190 } };
  const left = nodes.filter((node) => node.group === 'left');
  const right = nodes.filter((node) => node.group === 'right');
  const bottom = nodes.filter((node) => node.group === 'bottom');
  left.forEach((node, index) => { positions[node.id] = { x: 70, y: 90 + index * 146 }; });
  right.forEach((node, index) => { positions[node.id] = { x: 540, y: 70 + index * 136 }; });
  bottom.forEach((node, index) => { positions[node.id] = { x: 170 + (index % 4) * 145, y: 390 + Math.floor(index / 4) * 140 }; });
  return positions;
}

function BusinessCanvas({
  business,
  contracts,
  onNodeSelect,
}: {
  business: YouSupplyBusiness;
  contracts: YouSupplyContract[];
  onNodeSelect: (selection: NodeSelection) => void;
}) {
  const nodes = useMemo(() => buildNodes(business, contracts), [business, contracts]);
  const initPositions = useMemo(() => makePositions(nodes), [nodes]);
  const drag = useDragCanvas(initPositions);
  const color = businessColor(business.typeKey);
  const businessPos = drag.screenPos('business');
  const links = nodes.map((node) => {
    const target = drag.screenPos(node.id);
    const from = node.group === 'left'
      ? { x: target.x + CARD_SIZE, y: target.y + CARD_SIZE / 2 }
      : { x: businessPos.x + CARD_SIZE, y: businessPos.y + CARD_SIZE / 2 };
    const to = node.group === 'left'
      ? { x: businessPos.x, y: businessPos.y + CARD_SIZE / 2 }
      : { x: target.x, y: target.y + CARD_SIZE / 2 };
    return { from, to, color: node.accent, active: !node.id.startsWith('offer:') };
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
        footer={business.underConstruction ? `${business.constructionProject?.progress.percent ?? 0}%` : money(business.treasuryMoney)}
        active
        construction={business.underConstruction}
        onDragStart={(event) => drag.startDrag('business', event)}
        onClick={() => onNodeSelect(null)}
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
      const existing = selection.business.offers.find((offer) => offer.resourceType === selection.inventory.resourceType);
      setPrice(existing?.unitPrice ?? 10);
      setAutoAccept(existing?.autoAccept ?? false);
    }
  }, [selection]);

  if (!selection) return null;
  const title = selection.kind === 'inventory'
    ? resourceLabel(selection.inventory.resourceType)
    : selection.kind === 'construction-material'
      ? resourceLabel(selection.material.resourceType)
    : selection.kind === 'offer'
      ? `Offre ${resourceLabel(selection.offer.resourceType)}`
      : selection.kind === 'contract'
        ? `Contrat ${resourceLabel(selection.contract.resourceType)}`
        : selection.item.title ?? selection.business.name;

  return (
    <div className="absolute bottom-4 left-4 z-30 w-[360px] rounded-lg border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Details</p>
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-3 p-4 text-xs">
        {selection.kind === 'inventory' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Stock" value={`${selection.inventory.quantity}/${selection.inventory.capacity}`} />
              <Metric label="Production" value={`${selection.inventory.productionRatePerHour} u/h`} />
              <Metric label="Offres" value={String(selection.business.offers.filter((offer) => offer.resourceType === selection.inventory.resourceType).length)} />
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-[11px] font-semibold text-foreground">Vendre cette ressource</p>
              <label className="mb-2 block text-[10px] text-muted-foreground">Prix fixe par unite</label>
              <input
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                type="number"
                min={1}
                className="mb-3 h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none"
              />
              <label className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={autoAccept} onChange={(event) => setAutoAccept(event.target.checked)} />
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
        )}
        {selection.kind === 'construction-material' && (
          <div className="space-y-3">
            <div className="h-3 rounded-sm" style={{ background: CONSTRUCTION_STRIPES }} />
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Recu" value={String(selection.material.deliveredQuantity)} />
              <Metric label="Requis" value={String(selection.material.requiredQuantity)} />
              <Metric label="Reste" value={String(Math.max(0, selection.material.requiredQuantity - selection.material.deliveredQuantity))} />
            </div>
            <button
              onClick={() => onChooseSource(selection.business, selection.material)}
              disabled={selection.material.deliveredQuantity >= selection.material.requiredQuantity}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-[11px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Package size={12} /> Choisir une source
            </button>
          </div>
        )}
        {selection.kind === 'offer' && (
          <div className="space-y-2">
            <Metric label="Prix" value={`${selection.offer.unitPrice}/u`} />
            <Metric label="Validation" value={selection.offer.autoAccept ? 'Auto' : 'Manuelle'} />
            <button
              onClick={() => onSaveOffer(selection.business.id, selection.offer.resourceType, selection.offer.unitPrice, selection.offer.autoAccept, !selection.offer.isActive)}
              className="w-full rounded-md border border-border px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted"
            >
              {selection.offer.isActive ? 'Desactiver' : 'Reactiver'} l'offre
            </button>
          </div>
        )}
        {selection.kind === 'contract' && (
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Statut" value={selection.contract.status} />
            <Metric label="Prix" value={`${selection.contract.unitPrice}/u`} />
            <Metric label="Livre" value={`${selection.contract.deliveredQuantity}/${selection.contract.totalQuantity}`} />
            <Metric label="Total" value={money(selection.contract.totalQuantity * selection.contract.unitPrice)} />
          </div>
        )}
        {selection.kind !== 'inventory' && selection.kind !== 'construction-material' && selection.kind !== 'offer' && selection.kind !== 'contract' && (
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[10px] text-muted-foreground">
            {JSON.stringify(selection.item, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/50">{label}</p>
      <p className="truncate text-[11px] font-semibold text-foreground">{value}</p>
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

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="h-3" style={{ background: CONSTRUCTION_STRIPES }} />
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50">Source chantier</p>
            <p className="text-sm font-semibold text-foreground">{resourceLabel(target.material.resourceType)}</p>
            <p className="text-[11px] text-muted-foreground">{remaining} restant pour {target.business.name}</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted">
            <X size={14} />
          </button>
        </div>
        <div className="border-b border-border p-3">
          <label className="mb-1 block text-[10px] text-muted-foreground">Quantite demandee</label>
          <input
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
            type="number"
            min={1}
            max={remaining || 1}
            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-3">
          {matchingOffers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-[11px] text-muted-foreground">Aucune source disponible pour cette ressource.</div>
          ) : matchingOffers.map((offer) => (
            <button
              key={offer.id}
              onClick={() => onRequest(offer.id, Math.min(quantity, remaining || quantity), target.business.constructionProject!.id)}
              className="mb-2 w-full rounded-lg border border-border bg-background p-3 text-left hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-foreground">{offer.business?.name ?? 'Business'}</p>
                  <p className="text-[10px] text-muted-foreground">@{offer.business?.owner.username ?? 'serveur'} · stock {offer.availableQuantity ?? 0}</p>
                </div>
                <span className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-500">{offer.unitPrice}/u</span>
              </div>
              <p className="mt-2 text-[9px] text-muted-foreground/60">{offer.autoAccept ? 'Acceptation automatique' : 'Validation vendeur requise'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SupplyTab() {
  const [state, setState] = useState<YouSupplyState | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [nodeSelection, setNodeSelection] = useState<NodeSelection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [sourceTarget, setSourceTarget] = useState<{ business: YouSupplyBusiness; material: YouConstructionMaterial } | null>(null);

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
      <Sidebar businesses={state?.businesses ?? []} selection={selection} onSelect={(next) => { setSelection(next); setNodeSelection(null); }} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-4">
          {activeBusiness ? (
            <>
              <div className="flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-bold" style={{ background: `${businessColor(activeBusiness.typeKey)}22`, color: businessColor(activeBusiness.typeKey) }}>
                {BIZ_MONO[activeBusiness.typeKey] ?? '??'}
              </div>
              <p className="text-sm font-medium text-foreground">{activeBusiness.name}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{BIZ_LABEL[activeBusiness.typeKey] ?? activeBusiness.typeKey}</span>
              {activeBusiness.underConstruction && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-black" style={{ background: CONSTRUCTION_STRIPES }}>Chantier {activeBusiness.constructionProject?.progress.percent ?? 0}%</span>}
              <span className="ml-auto text-[11px] text-muted-foreground">{money(activeBusiness.treasuryMoney)}</span>
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
            <BusinessCanvas business={activeBusiness} contracts={state?.contracts ?? []} onNodeSelect={setNodeSelection} />
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
    </div>
  );
}
