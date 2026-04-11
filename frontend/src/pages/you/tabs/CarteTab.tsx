import { useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, LocateFixed, Minus, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { type YouBusiness, type YouState, youApi } from '@/services/api';
import {
  CITY_BLOCK_TONES,
  CITY_PARK_PATHS,
  CITY_RIVER_PATH,
  CITY_ROAD_PATHS,
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  TYPE_EMOJI,
  clamp,
  djb2Hash,
  getFallbackBusinessPosition,
} from '../mapConstants';

interface MapPin {
  business: YouBusiness;
  x: number;
  y: number;
  isOwned: boolean;
  canPlace: boolean;
  hasSavedPosition: boolean;
  pinColor: string;
}

interface RenderPinNode {
  kind: 'pin';
  pin: MapPin;
}

interface RenderClusterNode {
  kind: 'cluster';
  id: string;
  x: number;
  y: number;
  count: number;
  pins: MapPin[];
}

type RenderNode = RenderPinNode | RenderClusterNode;
type BusinessFilter = 'all' | 'mine';

const BUSINESS_PIN_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#c084fc', '#818cf8', '#f472b6', '#fb7185', '#facc15'];
const DEFAULT_SCALE = 0.9;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.6;
const CLUSTER_SCALE_THRESHOLD = 1.08;

function getPinColor(typeKey: string) {
  return BUSINESS_PIN_COLORS[djb2Hash(typeKey) % BUSINESS_PIN_COLORS.length];
}

function createCityBlocks() {
  return Array.from({ length: 36 }, (_, index) => {
    const seed = djb2Hash(`city-block-${index}`);
    const width = 18 + (seed % 30);
    const height = 14 + (Math.floor(seed / 11) % 36);
    const x = 28 + (Math.floor(seed / 5) % Math.max(28, MAP_VIEWBOX_WIDTH - width - 56));
    const y = 28 + (Math.floor(seed / 17) % Math.max(28, MAP_VIEWBOX_HEIGHT - height - 56));
    const rotate = (seed % 14) - 7;
    const tone = CITY_BLOCK_TONES[seed % CITY_BLOCK_TONES.length];
    return { id: `block-${index}`, x, y, width, height, rotate, tone };
  });
}

function uniqueBusinesses(data: YouState) {
  const map = new Map<string, YouBusiness>();
  [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses].forEach((group) => {
    group.forEach((business) => map.set(business.id, business));
  });
  return Array.from(map.values());
}

function buildMapPins(businesses: YouBusiness[], userId: string, isAdmin: boolean): MapPin[] {
  return businesses.map((business) => {
    const fallbackPosition = getFallbackBusinessPosition(business.id);
    return {
      business,
      x: business.mapX ?? fallbackPosition.x,
      y: business.mapY ?? fallbackPosition.y,
      isOwned: business.ownerId === userId,
      canPlace: business.ownerId === userId || isAdmin,
      hasSavedPosition: business.mapX != null && business.mapY != null,
      pinColor: getPinColor(business.typeKey),
    };
  });
}

function buildRenderedNodes(pins: MapPin[], scale: number, placingBusinessId: string | null): RenderNode[] {
  if (placingBusinessId || scale >= CLUSTER_SCALE_THRESHOLD) {
    return pins.map((pin) => ({ kind: 'pin' as const, pin }));
  }

  const cellSize = Math.max(84, Math.round(128 / Math.max(scale, 0.6)));
  const groups = new Map<string, MapPin[]>();

  pins.forEach((pin) => {
    const key = `${Math.floor(pin.x / cellSize)}:${Math.floor(pin.y / cellSize)}`;
    const list = groups.get(key);
    if (list) {
      list.push(pin);
      return;
    }
    groups.set(key, [pin]);
  });

  const nodes: RenderNode[] = [];
  groups.forEach((groupPins, key) => {
    if (groupPins.length === 1) {
      nodes.push({ kind: 'pin', pin: groupPins[0] });
      return;
    }

    const centerX = groupPins.reduce((sum, pin) => sum + pin.x, 0) / groupPins.length;
    const centerY = groupPins.reduce((sum, pin) => sum + pin.y, 0) / groupPins.length;
    nodes.push({
      kind: 'cluster',
      id: key,
      x: centerX,
      y: centerY,
      count: groupPins.length,
      pins: groupPins,
    });
  });

  return nodes;
}

function formatBusinessType(business: YouBusiness) {
  return business.type?.label ?? business.typeKey;
}

function canRepositionBusiness(business: YouBusiness, userId: string, isAdmin: boolean) {
  return business.ownerId === userId || isAdmin;
}

function BusinessInfoCard({
  business,
  userId,
  isAdmin,
  onClose,
  onPlace,
  onOpenExplore,
  placementMode,
}: {
  business: YouBusiness;
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  onPlace: () => void;
  onOpenExplore: () => void;
  placementMode: boolean;
}) {
  const navigate = useNavigate();
  const profit = business.monthlyRevenue - business.monthlyExpenses;
  const editable = canRepositionBusiness(business, userId, isAdmin);
  const positionLabel = business.mapX != null && business.mapY != null
    ? `${business.mapX} / ${business.mapY}`
    : 'Non défini';

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
              {TYPE_EMOJI[business.typeKey] ?? 'B'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{business.name}</p>
              <p className="text-xs text-slate-400">
                {formatBusinessType(business)} • {business.owner.username}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {business.verified ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-300">Vérifié</span>
            ) : null}
            {business.ownerId === userId ? (
              <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-200">À vous</span>
            ) : null}
            {business.mapX == null || business.mapY == null ? (
              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300">À placer</span>
            ) : null}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Trésorerie</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">{business.treasuryMoney.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Profit</p>
          <p className={cn('mt-1 text-sm font-semibold tabular-nums', profit >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
            {profit >= 0 ? '+' : ''}
            {profit.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Satisf.</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">{business.satisfaction}%</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="uppercase tracking-[0.18em] text-slate-400">Position carte</p>
          <p className="mt-1 font-medium text-white">{positionLabel}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="uppercase tracking-[0.18em] text-slate-400">Repère</p>
          <p className="mt-1 font-medium text-white">{business.location ?? 'Placement libre'}</p>
        </div>
      </div>

      {business.avgRating != null && business.ratingCount > 0 ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-300">
          <span className="text-amber-300">★</span>
          {business.avgRating.toFixed(1)} sur {business.ratingCount} avis
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {editable ? (
          <Button size="sm" className="gap-1.5 bg-white/10 text-white hover:bg-white/15" onClick={onPlace}>
            {placementMode ? 'Annuler le déplacement' : business.mapX == null || business.mapY == null ? 'Placer ici' : 'Déplacer'}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="gap-1.5 border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onOpenExplore}>
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir dans Explore
        </Button>
        <Button size="sm" variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => navigate('/you?tab=explore')}>
          Aller au détail
        </Button>
      </div>
    </div>
  );
}

export function CarteTab({
  data,
  userId,
  isAdmin,
  onReload,
}: {
  data: YouState;
  userId: string;
  isAdmin: boolean;
  onReload: () => Promise<void>;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BusinessFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [placingBusinessId, setPlacingBusinessId] = useState<string | null>(null);
  const [savingPlacementBusinessId, setSavingPlacementBusinessId] = useState<string | null>(null);
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPointerPosition = useRef({ x: 0, y: 0 });
  const cityBlocks = useMemo(() => createCityBlocks(), []);

  const allBusinesses = useMemo(() => uniqueBusinesses(data), [data]);
  const visibleBusinesses = useMemo(() => {
    const filteredByOwnership = filter === 'mine'
      ? allBusinesses.filter((business) => business.ownerId === userId)
      : allBusinesses;

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return filteredByOwnership;
    }

    return filteredByOwnership.filter((business) => {
      const haystack = [
        business.name,
        business.owner.username,
        business.type?.label ?? business.typeKey,
        business.typeKey,
        business.location ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [allBusinesses, filter, searchQuery, userId]);

  const pins = useMemo(() => buildMapPins(visibleBusinesses, userId, isAdmin), [visibleBusinesses, userId, isAdmin]);
  const renderedNodes = useMemo(() => buildRenderedNodes(pins, scale, placingBusinessId), [pins, placingBusinessId, scale]);
  const selectedBusiness = allBusinesses.find((business) => business.id === selectedBusinessId) ?? null;

  const ownedVisibleCount = visibleBusinesses.filter((business) => business.ownerId === userId).length;
  const unplacedVisibleCount = visibleBusinesses.filter((business) => business.mapX == null || business.mapY == null).length;
  const placeableVisibleCount = visibleBusinesses.filter((business) => canRepositionBusiness(business, userId, isAdmin)).length;

  function zoomTo(nextScale: number) {
    const targetScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setScale(targetScale);
      return;
    }

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - translateX) / scale;
    const worldY = (centerY - translateY) / scale;
    setScale(targetScale);
    setTranslateX(centerX - worldX * targetScale);
    setTranslateY(centerY - worldY * targetScale);
  }

  function centerMap() {
    setTranslateX(0);
    setTranslateY(0);
    setScale(DEFAULT_SCALE);
  }

  function focusPoint(x: number, y: number, targetScale = 1.28) {
    const rect = containerRef.current?.getBoundingClientRect();
    const nextScale = clamp(targetScale, MIN_SCALE, MAX_SCALE);
    if (!rect) {
      setScale(nextScale);
      setTranslateX(0);
      setTranslateY(0);
      return;
    }

    setScale(nextScale);
    setTranslateX(rect.width / 2 - x * nextScale);
    setTranslateY(rect.height / 2 - y * nextScale);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (placingBusinessId) return;
    dragging.current = true;
    lastPointerPosition.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (placingBusinessId || !dragging.current) return;
    const deltaX = event.clientX - lastPointerPosition.current.x;
    const deltaY = event.clientY - lastPointerPosition.current.y;
    lastPointerPosition.current = { x: event.clientX, y: event.clientY };
    setTranslateX((value) => value + deltaX);
    setTranslateY((value) => value + deltaY);
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const ratio = event.deltaY > 0 ? 0.92 : 1.08;

    setScale((previousScale) => {
      const nextScale = clamp(previousScale * ratio, MIN_SCALE, MAX_SCALE);
      const scaleRatio = nextScale / previousScale;
      setTranslateX((value) => cursorX - scaleRatio * (cursorX - value));
      setTranslateY((value) => cursorY - scaleRatio * (cursorY - value));
      return nextScale;
    });
  }

  async function handleMapClick(event: MouseEvent<SVGSVGElement>) {
    if (!placingBusinessId) return;
    const targetBusiness = allBusinesses.find((business) => business.id === placingBusinessId);
    if (!targetBusiness || !canRepositionBusiness(targetBusiness, userId, isAdmin)) {
      setPlacingBusinessId(null);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nextX = clamp(Math.round((event.clientX - rect.left - translateX) / scale), 42, MAP_VIEWBOX_WIDTH - 42);
    const nextY = clamp(Math.round((event.clientY - rect.top - translateY) / scale), 42, MAP_VIEWBOX_HEIGHT - 42);

    setSavingPlacementBusinessId(targetBusiness.id);
    try {
      await youApi.updateBusinessProfile(targetBusiness.id, { mapX: nextX, mapY: nextY });
      await onReload();
      setSelectedBusinessId(targetBusiness.id);
      setPlacingBusinessId(null);
      toast({
        title: 'Emplacement mis à jour',
        description: `${targetBusiness.name} est maintenant placé librement sur la carte.`,
      });
    } catch (error: any) {
      toast({
        title: 'Impossible de placer le business',
        description: error?.response?.data?.error ?? 'Réessayez dans un instant.',
        variant: 'destructive',
      });
    } finally {
      setSavingPlacementBusinessId(null);
    }
  }

  function handleStartPlacement(businessId: string) {
    const target = allBusinesses.find((business) => business.id === businessId);
    if (!target || !canRepositionBusiness(target, userId, isAdmin)) return;
    if (placingBusinessId === businessId) {
      setPlacingBusinessId(null);
      return;
    }
    setSelectedBusinessId(businessId);
    setPlacingBusinessId(businessId);
    const pin = pins.find((entry) => entry.business.id === businessId);
    if (pin) {
      focusPoint(pin.x, pin.y, 1.26);
    }
  }

  function handleClusterClick(node: RenderClusterNode) {
    setSelectedBusinessId(node.pins[0]?.business.id ?? null);
    focusPoint(node.x, node.y, Math.min(MAX_SCALE, Math.max(scale * 1.28, 1.26)));
  }

  return (
    <div className="space-y-4 pb-8">
      <Card className="overflow-hidden border border-border/60 bg-[linear-gradient(180deg,rgba(7,17,31,0.98),rgba(12,28,44,0.94))] text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <CardHeader className="border-b border-white/10 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-white">Carte des entreprises</CardTitle>
              <p className="max-w-2xl text-sm text-slate-300">
                Les business se placent librement sur la ville. Pas d’adresse, pas de géocodage, juste un plan simple et lisible.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="h-8 border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setFilter('all')}>
                Toute la ville
              </Button>
              <Button size="sm" variant={filter === 'mine' ? 'default' : 'outline'} className="h-8 border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setFilter('mine')}>
                Mes business
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher un business, un propriétaire ou un type"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Visibles</div>
                <div className="mt-1 text-2xl font-semibold text-white">{visibleBusinesses.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">À vous</div>
                <div className="mt-1 text-2xl font-semibold text-amber-300">{ownedVisibleCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">À placer</div>
                <div className="mt-1 text-2xl font-semibold text-sky-300">{unplacedVisibleCount}</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div
                ref={containerRef}
                className={cn(
                  'relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07111d] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                  placingBusinessId ? 'ring-1 ring-sky-300/20' : '',
                )}
                style={{ aspectRatio: '16 / 10', cursor: placingBusinessId ? 'crosshair' : 'grab' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(245,158,11,0.18),transparent_20%),radial-gradient(circle_at_50%_82%,rgba(129,140,248,0.16),transparent_26%)]" />

                <svg
                  viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
                  width="100%"
                  height="100%"
                  style={{
                    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                  onClick={handleMapClick}
                >
                  <defs>
                    <linearGradient id="city-map-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0d1724" />
                      <stop offset="100%" stopColor="#07101b" />
                    </linearGradient>
                    <linearGradient id="city-river" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(56,189,248,0.28)" />
                      <stop offset="100%" stopColor="rgba(14,165,233,0.10)" />
                    </linearGradient>
                    <pattern id="city-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    </pattern>
                  </defs>

                  <rect width={MAP_VIEWBOX_WIDTH} height={MAP_VIEWBOX_HEIGHT} fill="url(#city-map-bg)" />
                  <rect width={MAP_VIEWBOX_WIDTH} height={MAP_VIEWBOX_HEIGHT} fill="url(#city-grid)" opacity="0.35" />

                  {CITY_PARK_PATHS.map((path, index) => (
                    <path key={`${path}-${index}`} d={path} fill="rgba(74, 222, 128, 0.08)" stroke="rgba(74, 222, 128, 0.18)" strokeWidth="2" />
                  ))}

                  <path d={CITY_RIVER_PATH} fill="url(#city-river)" />

                  {CITY_ROAD_PATHS.map((path, index) => (
                    <g key={`${path}-${index}`}>
                      <path d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" strokeLinecap="round" />
                      <path d={path} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" strokeDasharray="8 12" strokeLinecap="round" />
                    </g>
                  ))}

                  {cityBlocks.map((block) => (
                    <rect
                      key={block.id}
                      x={block.x}
                      y={block.y}
                      width={block.width}
                      height={block.height}
                      rx="4"
                      fill={block.tone}
                      opacity="0.88"
                      transform={`rotate(${block.rotate} ${block.x + block.width / 2} ${block.y + block.height / 2})`}
                    />
                  ))}

                  {renderedNodes.map((node) => {
                    if (node.kind === 'cluster') {
                      return (
                        <g
                          key={node.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleClusterClick(node);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle cx={node.x} cy={node.y} r="26" fill="rgba(15, 23, 42, 0.88)" stroke="rgba(125, 211, 252, 0.45)" strokeWidth="3" />
                          <circle cx={node.x} cy={node.y} r="12" fill="rgba(56,189,248,0.92)" />
                          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#08111d">
                            {node.count}
                          </text>
                          <text x={node.x} y={node.y + 40} textAnchor="middle" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.75)">
                            Groupe
                          </text>
                        </g>
                      );
                    }

                    const { pin } = node;
                    const selected = selectedBusinessId === pin.business.id;
                    const emoji = TYPE_EMOJI[pin.business.typeKey] ?? 'B';

                    return (
                      <g
                        key={pin.business.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedBusinessId(pin.business.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {pin.isOwned ? (
                          <circle cx={pin.x} cy={pin.y} r="22" fill="none" stroke="rgba(251,191,36,0.22)" strokeWidth="8" />
                        ) : null}
                        {selected ? (
                          <circle cx={pin.x} cy={pin.y} r="28" fill="none" stroke="rgba(125,211,252,0.28)" strokeWidth="10" />
                        ) : null}
                        {pin.hasSavedPosition ? null : (
                          <circle cx={pin.x} cy={pin.y} r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeDasharray="5 5" strokeWidth="2" />
                        )}
                        <path
                          d={`M ${pin.x} ${pin.y - 18} C ${pin.x + 15} ${pin.y - 18}, ${pin.x + 18} ${pin.y + 4}, ${pin.x} ${pin.y + 22} C ${pin.x - 18} ${pin.y + 4}, ${pin.x - 15} ${pin.y - 18}, ${pin.x} ${pin.y - 18} Z`}
                          fill={pin.isOwned ? '#f8fafc' : '#101828'}
                          stroke={pin.pinColor}
                          strokeWidth={selected ? 3 : 2}
                        />
                        <circle cx={pin.x} cy={pin.y - 4} r="11" fill={pin.pinColor} />
                        <text x={pin.x} y={pin.y} textAnchor="middle" fontSize="10" fontWeight="700" fill="#08111d">
                          {emoji}
                        </text>
                        {pin.isOwned ? (
                          <circle cx={pin.x + 14} cy={pin.y - 14} r="8" fill="#f59e0b" stroke="#fff7ed" strokeWidth="1.5" />
                        ) : null}
                      </g>
                    );
                  })}
                </svg>

                <div className="absolute right-3 top-3 flex flex-col gap-2">
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={() => zoomTo(scale * 1.12)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={() => zoomTo(scale / 1.12)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={centerMap}>
                    <LocateFixed className="h-4 w-4" />
                  </Button>
                </div>

                {placingBusinessId ? (
                  <div className="absolute left-3 top-3 max-w-sm rounded-2xl border border-sky-300/20 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-lg backdrop-blur">
                    <p className="font-medium text-white">Mode placement actif</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Cliquez n’importe où sur la carte pour enregistrer la position du business sélectionné. Aucun adressage n’est requis.
                    </p>
                    {savingPlacementBusinessId === placingBusinessId ? (
                      <p className="mt-2 text-xs font-medium text-sky-300">Enregistrement en cours…</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
                  Vos business
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-sky-300" />
                  Groupes au zoom réduit
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-white/70" />
                  Emplacements libres
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Molette pour zoomer • cliquer-glisser pour naviguer • cliquez un business pour l’ouvrir • aucun champ d’adresse n’est nécessaire
              </p>
            </div>

            <div className="space-y-4">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-3 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Sélection</div>
                  {selectedBusiness ? (
                    <BusinessInfoCard
                      business={selectedBusiness}
                      userId={userId}
                      isAdmin={isAdmin}
                      placementMode={placingBusinessId === selectedBusiness.id}
                      onClose={() => {
                        setSelectedBusinessId(null);
                        setPlacingBusinessId(null);
                      }}
                      onPlace={() => handleStartPlacement(selectedBusiness.id)}
                      onOpenExplore={() => navigate('/you?tab=explore')}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                      Sélectionnez un business sur la carte pour afficher ses données détaillées.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-3 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Liste</div>
                      <div className="text-sm text-slate-300">{placeableVisibleCount} business déplaçables</div>
                    </div>
                    <div className="text-xs text-slate-400">{visibleBusinesses.length} résultats</div>
                  </div>

                  <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
                    {visibleBusinesses.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                        Aucun business ne correspond à la recherche.
                      </div>
                    ) : visibleBusinesses.map((business) => {
                      const isSelected = selectedBusinessId === business.id;
                      const canPlace = canRepositionBusiness(business, userId, isAdmin);
                      const hasSavedPosition = business.mapX != null && business.mapY != null;

                      return (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => setSelectedBusinessId(business.id)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-sky-300/30 bg-sky-400/10'
                              : 'border-white/10 bg-slate-950/35 hover:bg-white/5',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white" style={{ boxShadow: `0 0 0 1px ${getPinColor(business.typeKey)}33 inset` }}>
                              {TYPE_EMOJI[business.typeKey] ?? 'B'}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{business.name}</div>
                              <div className="truncate text-xs text-slate-400">
                                {formatBusinessType(business)} • {business.owner.username}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right text-[11px] text-slate-400">
                            <span className={cn('rounded-full px-2 py-0.5 font-medium', business.ownerId === userId ? 'bg-amber-400/10 text-amber-200' : 'bg-white/5 text-slate-300')}>
                              {business.ownerId === userId ? 'À vous' : 'Visible'}
                            </span>
                            <span>{hasSavedPosition ? 'Placé' : 'À placer'}</span>
                            {canPlace ? (
                              <span className="text-sky-300">Déplaçable</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
