import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BellRing, Building2, ChevronDown, ExternalLink, LocateFixed, MapPin, Minus, Plus, Wallet, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { type YouBusiness, type YouState, youApi } from '@/services/api';
import { BusinessBrowserModal } from '../components/BusinessBrowserModal';
import {
  WORLD_LATITUDE_LIMITS,
  WORLD_LONGITUDE_LIMITS,
  WORLD_MAP_STYLE,
  clamp,
  getBusinessPinColor,
} from '../mapConstants';
import { BUSINESS_ICON_MAP } from '../constants';
import { getYouNotificationMeta, isYouNotification, relativeTime } from '../utils';

interface MapPin {
  business: YouBusiness;
  longitude: number;
  latitude: number;
  isOwned: boolean;
  canPlace: boolean;
  pinColor: string;
}

type BusinessFeatureProperties = {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  typeKey: string;
  typeLabel: string;
  description: string | null;
  pinColor: string;
  underConstruction: boolean;
  constructionProgress: number;
  selected: boolean;
  isOwned: boolean;
  canPlace: boolean;
};

function getBizIcon(typeKey: string) {
  return BUSINESS_ICON_MAP[typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
}

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.25;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const SOURCE_ID = 'you-businesses-source';
const LAYER_ID = 'you-businesses-layer';
const CORE_LAYER_ID = 'you-businesses-layer-core';
const CLUSTER_LAYER_ID = 'you-businesses-cluster';
const PIN_SIZE = 40;
const CLUSTER_SIZE = 44;
const CONSTRUCTION_STRIPES = 'repeating-linear-gradient(135deg, #facc15 0 8px, #111827 8px 16px)';

function uniqueBusinesses(data: YouState): YouBusiness[] {
  const map = new Map<string, YouBusiness>();
  [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses].forEach((group) => {
    group.forEach((b) => map.set(b.id, b));
  });
  return Array.from(map.values());
}

function canUserPlaceBusiness(business: YouBusiness, userId: string, isAdmin: boolean): boolean {
  return isAdmin || business.ownerId === userId;
}

// Only placed businesses appear on the map
function buildPins(businesses: YouBusiness[], userId: string, isAdmin: boolean): MapPin[] {
  return businesses
    .filter((b) => b.mapX != null && b.mapY != null)
    .map((b) => ({
      business: b,
      longitude: b.mapX!,
      latitude: b.mapY!,
      isOwned: b.ownerId === userId,
      canPlace: canUserPlaceBusiness(b, userId, isAdmin),
      pinColor: getBusinessPinColor(b.typeKey),
    }));
}

function buildSourceData(
  pins: MapPin[],
  selectedId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.Point, BusinessFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.longitude, pin.latitude] },
      properties: {
        id: pin.business.id,
        name: pin.business.name,
        ownerId: pin.business.ownerId,
        ownerUsername: pin.business.owner.username,
        typeKey: pin.business.typeKey,
        typeLabel: pin.business.type?.label ?? pin.business.typeKey,
        description: pin.business.description,
        pinColor: pin.pinColor,
        underConstruction: Boolean(pin.business.underConstruction),
        constructionProgress: pin.business.constructionProject?.progress.percent ?? 0,
        selected: selectedId === pin.business.id,
        isOwned: pin.isOwned,
        canPlace: pin.canPlace,
      },
    })),
  };
}

type LucideIconNode = Array<[string, Record<string, string>]>;

function getIconNode(typeKey: string): LucideIconNode | null {
  const Icon = getBizIcon(typeKey) as unknown as { iconNode?: LucideIconNode };
  return Icon.iconNode ?? null;
}

function iconNodeToSvg(node: LucideIconNode, color: string): string {
  const body = node.map(([tag, attrs]) => {
    const attrString = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ');
    return `<${tag} ${attrString} />`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

async function createPinIconImageData(typeKey: string, size: number): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const iconNode = getIconNode(typeKey);
  if (!iconNode) return ctx.getImageData(0, 0, size, size);

  const svg = iconNodeToSvg(iconNode, '#ffffff');
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => resolve(null);
    next.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
  if (!image) return ctx.getImageData(0, 0, size, size);
  const iconSize = Math.round(size * 0.56);
  const offset = (size - iconSize) / 2;
  ctx.drawImage(image, offset, offset, iconSize, iconSize);
  return ctx.getImageData(0, 0, size, size);
}

function createClusterImageData(count: number, size: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;

  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#6366f1';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const label = count >= 1000 ? `${Math.floor(count / 1000)}k` : String(count);
  const fontSize = label.length > 2 ? Math.floor(r * 0.7) : Math.floor(r * 0.85);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(label, cx, cy + 1);

  return ctx.getImageData(0, 0, size, size);
}

async function isOnLand(lat: number, lon: number): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const data = await res.json();
    return Boolean(data.countryCode);
  } catch {
    return true;
  }
}

function formatCoordinates(lon: number, lat: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(5)}°${latDir}, ${Math.abs(lon).toFixed(5)}°${lonDir}`;
}

function formatCompactMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} €`;
}

function BusinessInfoPanel({
  business,
  userId,
  onClose,
  onPlace,
  placementMode,
}: {
  business: YouBusiness;
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  onPlace: () => void;
  placementMode: boolean;
}) {
  const navigate = useNavigate();
  const isOwner = business.ownerId === userId;
  const isPlaced = business.mapX != null && business.mapY != null;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);
  const pinColor = getBusinessPinColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-xl">
      {underConstruction && <div className="h-2" style={{ background: CONSTRUCTION_STRIPES }} />}
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: pinColor + '20', border: `1.5px solid ${pinColor}40` }}
        >
          <BizIcon className="h-5 w-5" style={{ color: pinColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{business.name}</p>
          <p className="truncate text-xs text-muted-foreground">{business.type?.label ?? business.typeKey}</p>
          <p className="truncate text-xs text-muted-foreground">@{business.owner.username}</p>
          {underConstruction && <p className="mt-1 text-[10px] font-semibold text-amber-500">Chantier {business.constructionProject?.progress.percent ?? 0}%</p>}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {business.verified && (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-600">Vérifié</Badge>
        )}
        {isOwner && (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-700">À vous</Badge>
        )}
        {!isPlaced && (
          <Badge variant="secondary" className="text-[11px]">À placer</Badge>
        )}
      </div>

      {/* Info rows */}
      <div className="border-y border-border px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/40 bg-muted/10 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trésorerie</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{formatCompactMoney(business.treasuryMoney)}</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/10 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Membres</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{business.memberCount}</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/10 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Revenu mensuel</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-emerald-500">{formatCompactMoney(business.monthlyRevenue)}</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/10 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Satisfaction</p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{business.satisfaction}%</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border border-b border-border">
        <div className="px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Position</p>
          <p className="mt-0.5 font-mono text-xs text-foreground">
            {isPlaced ? formatCoordinates(business.mapX!, business.mapY!) : '—'}
          </p>
        </div>
        {business.location && (
          <div className="px-4 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Repère</p>
            <p className="mt-0.5 text-xs text-foreground">{business.location}</p>
          </div>
        )}
        {business.avgRating != null && business.ratingCount > 0 && (
          <div className="px-4 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</p>
            <p className="mt-0.5 text-xs">
              <span className="text-amber-500">★ {business.avgRating.toFixed(1)}</span>
              <span className="ml-1.5 text-muted-foreground">{business.ratingCount} avis</span>
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        {isOwner && (
          <Button size="sm" className="flex-1" onClick={onPlace}>
            {placementMode ? 'Annuler' : isPlaced ? 'Déplacer' : 'Placer sur la carte'}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => navigate(`/you?tab=explore&business=${business.id}`)}
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Voir le détail
        </Button>
      </div>
    </div>
  );
}

export type CarteTabHandle = {
  startPlacing: (id: string) => void;
};

export const CarteTab = forwardRef<CarteTabHandle, {
  data: YouState;
  userId: string;
  isAdmin: boolean;
  onReload: () => Promise<void>;
  embedded?: boolean;
  externalSelectedId?: string | null;
}>(function CarteTab({
  data,
  userId,
  isAdmin,
  onReload,
  embedded = false,
  externalSelectedId,
},  ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const labelMarkerRef = useRef<maplibregl.Marker | null>(null);
  const { notifications, unreadCount } = useNotifications();
  const [mapReady, setMapReady] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [placingBusinessId, setPlacingBusinessId] = useState<string | null>(null);
  const [savingPlacementBusinessId, setSavingPlacementBusinessId] = useState<string | null>(null);
  const [tickerOffset, setTickerOffset] = useState(0);
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all');
  const [hoverBusinessId, setHoverBusinessId] = useState<string | null>(null);
  const hoverBusinessIdRef = useRef<string | null>(null);
  const [showBrowserModal, setShowBrowserModal] = useState(false);

  useImperativeHandle(ref, () => ({
    startPlacing: (id: string) => handleStartPlacement(id),
  }));

  // Sync external selection (from dashboard left rail) into internal state
  useEffect(() => {
    if (externalSelectedId !== undefined && externalSelectedId !== null) {
      setSelectedBusinessId(externalSelectedId);
    }
  }, [externalSelectedId]);

  const allBusinesses = useMemo(() => uniqueBusinesses(data), [data]);
  const ownedBusinesses = useMemo(() => data.ownedBusinesses, [data.ownedBusinesses]);

  const pins = useMemo(() => {
    const source = ownerFilter === 'mine' ? ownedBusinesses : allBusinesses;
    return buildPins(source, userId, isAdmin);
  }, [ownerFilter, ownedBusinesses, allBusinesses, userId, isAdmin]);
  const sourceData = useMemo(() => buildSourceData(pins, selectedBusinessId), [pins, selectedBusinessId]);

  const selectedBusiness = allBusinesses.find((b) => b.id === selectedBusinessId) ?? null;
  const placingBusiness = allBusinesses.find((b) => b.id === placingBusinessId) ?? null;

  const youNotifications = useMemo(
    () => notifications.filter(isYouNotification).slice(0, 40),
    [notifications],
  );

  const tickerItems = useMemo(() => {
    const placedCount = data.ownedBusinesses.filter((business) => business.mapX != null && business.mapY != null).length;
    const totalTreasury = data.ownedBusinesses.reduce((sum, business) => sum + business.treasuryMoney, 0);
    const totalMonthlyRevenue = data.ownedBusinesses.reduce((sum, business) => sum + business.monthlyRevenue, 0);
    const totalMonthlyExpenses = data.ownedBusinesses.reduce((sum, business) => sum + business.monthlyExpenses, 0);
    const averageSatisfaction = data.ownedBusinesses.length
      ? Math.round(data.ownedBusinesses.reduce((sum, business) => sum + business.satisfaction, 0) / data.ownedBusinesses.length)
      : 0;
    const activeLoans = [...data.ownedBusinesses, ...data.exploreBusinesses]
      .flatMap((business) => business.recentLoans)
      .filter((loan) => loan.status === 'ACTIVE').length;

    return [
      { label: 'EMP', value: `${data.ownedBusinesses.length} businesses` },
      { label: 'MAP', value: `${placedCount} placés` },
      { label: 'TRE', value: `${Math.round(totalTreasury).toLocaleString('fr-FR')} money` },
      { label: 'REV', value: `+${Math.round(totalMonthlyRevenue).toLocaleString('fr-FR')} /mois` },
      { label: 'COST', value: `-${Math.round(totalMonthlyExpenses).toLocaleString('fr-FR')} /mois` },
      { label: 'SAT', value: `${averageSatisfaction}%` },
      { label: 'LOAN', value: `${activeLoans} prêts actifs` },
      { label: 'SOC', value: `${data.relationships.length} relations` },
    ];
  }, [data.exploreBusinesses, data.ownedBusinesses, data.relationships.length]);

  function closeHoverPopup() {
    hoverPopupRef.current?.remove();
    hoverPopupRef.current = null;
  }

  useEffect(() => {
    if (selectedBusinessId && !allBusinesses.some((b) => b.id === selectedBusinessId)) {
      setSelectedBusinessId(null);
      setPlacingBusinessId(null);
    }
  }, [allBusinesses, selectedBusinessId]);

  // Map init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: WORLD_MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: true,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // Generate cluster or fallback images on demand
    map.on('styleimagemissing', (e: any) => {
      if (e.id.startsWith('cluster-')) {
        const count = parseInt(e.id.slice('cluster-'.length), 10);
        if (!map.hasImage(e.id)) map.addImage(e.id, createClusterImageData(count, CLUSTER_SIZE));
      }
    });

    map.on('load', async () => {
      map.resize();
      // Generate icon images for each business type.
      const knownTypes = [...Object.keys(BUSINESS_ICON_MAP), '__default__'];
      await Promise.all(
        knownTypes.map(async (typeKey) => {
          const imageData = await createPinIconImageData(typeKey === '__default__' ? '' : typeKey, PIN_SIZE);
          if (!map.hasImage(`biz-${typeKey}`)) {
            map.addImage(`biz-${typeKey}`, imageData);
          }
        }),
      );

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: sourceData,
          cluster: true,
          // Keep merge clusters at low zoom, but reveal individual badges sooner.
          clusterMaxZoom: 6,
          clusterRadius: 25,
          promoteId: 'id',
        } as any);

        // Cluster bubble (icon generated on demand via styleimagemissing)
        map.addLayer({
          id: CLUSTER_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'icon-image': ['concat', 'cluster-', ['get', 'point_count']],
            'icon-size': ['step', ['get', 'point_count'], 1, 10, 1.15, 50, 1.3],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-anchor': 'center',
          },
        });

        // Soft glow halo — individual pins only
        map.addLayer({
          id: `${LAYER_ID}-glow`,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['get', 'selected'], false], 22,
              ['boolean', ['feature-state', 'hovered'], false], 20,
              16,
            ],
            'circle-color': ['get', 'pinColor'],
            'circle-opacity': [
              'case',
              ['boolean', ['get', 'selected'], false], 0.22,
              ['boolean', ['feature-state', 'hovered'], false], 0.18,
              0.1,
            ],
            'circle-blur': 0.9,
          },
        });

        // Visible round pin body so pins remain readable even if icon rendering is flaky.
        map.addLayer({
          id: CORE_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['get', 'selected'], false], 14,
              ['boolean', ['feature-state', 'hovered'], false], 13,
              12,
            ],
            'circle-color': [
              'case',
              ['boolean', ['get', 'underConstruction'], false], '#111827',
              ['get', 'pinColor'],
            ],
            'circle-opacity': 0.95,
            'circle-stroke-color': [
              'case',
              ['boolean', ['get', 'underConstruction'], false], '#facc15',
              'rgba(255,255,255,0.95)',
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['get', 'selected'], false], 2.8,
              ['boolean', ['feature-state', 'hovered'], false], 2.4,
              2.1,
            ],
          },
        });

        const iconMatchExpression: any[] = ['match', ['get', 'typeKey']];
        Object.keys(BUSINESS_ICON_MAP).forEach((typeKey) => {
          iconMatchExpression.push(typeKey, `biz-${typeKey}`);
        });
        iconMatchExpression.push('biz-__default__');

        // Business icons — individual pins only
        map.addLayer({
          id: LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': iconMatchExpression as any,
            'icon-size': [
              'case',
              ['boolean', ['get', 'selected'], false], 1.08,
              ['boolean', ['feature-state', 'hovered'], false], 1.02,
              0.96,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-anchor': 'center',
          },
        });
      }

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sync source data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(sourceData);
  }, [mapReady, sourceData]);

  // Map click for placement
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = async (event: maplibregl.MapMouseEvent) => {
      if (!placingBusinessId) return;
      if (map.queryRenderedFeatures(event.point, { layers: [LAYER_ID, CORE_LAYER_ID, CLUSTER_LAYER_ID] }).length > 0) return;

      const target = allBusinesses.find((b) => b.id === placingBusinessId);
      if (!target || !canUserPlaceBusiness(target, userId, isAdmin)) {
        setPlacingBusinessId(null);
        return;
      }

      const lon = clamp(event.lngLat.lng, WORLD_LONGITUDE_LIMITS.min, WORLD_LONGITUDE_LIMITS.max);
      const lat = clamp(event.lngLat.lat, WORLD_LATITUDE_LIMITS.min, WORLD_LATITUDE_LIMITS.max);

      const onLand = await isOnLand(lat, lon);
      if (!onLand) {
        toast({
          title: 'Emplacement invalide',
          description: 'Les businesses ne peuvent être placés que sur la terre ferme.',
          variant: 'destructive',
        });
        return;
      }

      setSavingPlacementBusinessId(target.id);
      try {
        await youApi.updateBusinessProfile(target.id, { mapX: lon, mapY: lat });
        await onReload();
        setSelectedBusinessId(target.id);
        setPlacingBusinessId(null);
        toast({ title: 'Emplacement mis à jour', description: `${target.name} est maintenant placé sur la carte.` });
      } catch (error: any) {
        toast({
          title: 'Impossible de placer le business',
          description: error?.response?.data?.error ?? 'Réessayez dans un instant.',
          variant: 'destructive',
        });
      } finally {
        setSavingPlacementBusinessId(null);
      }
    };

    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [allBusinesses, isAdmin, mapReady, onReload, placingBusinessId, userId]);

  // Pin click & hover
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handlePinClick = (event: maplibregl.MapLayerMouseEvent) => {
      if (placingBusinessId) return;
      const id = event.features?.[0]?.properties && 'id' in event.features[0].properties
        ? String(event.features[0].properties.id)
        : null;
      if (!id) return;
      setSelectedBusinessId(id);
      const pin = pins.find((p) => p.business.id === id);
      if (pin) map.flyTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(map.getZoom(), 2.4), speed: 0.9 });
    };

    const buildHoverPopupContent = (props: BusinessFeatureProperties) => {
      const container = document.createElement('div');
      container.className = 'max-w-[240px] rounded-lg border border-border/40 bg-background/95 px-3 py-2 text-foreground shadow-xl backdrop-blur-sm';

      const title = document.createElement('div');
      title.className = 'truncate text-sm font-semibold';
      title.textContent = props.name;
      container.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'mt-1 text-[11px] text-muted-foreground';
      meta.textContent = `@${props.ownerUsername} · ${props.typeLabel}`;
      container.appendChild(meta);

      const description = document.createElement('div');
      description.className = 'mt-1.5 max-h-14 overflow-hidden text-[11px] leading-4 text-muted-foreground';
      description.textContent = props.description?.trim() || 'Aucune description';
      container.appendChild(description);

      return container;
    };

    const handlePinMouseEnter = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const properties = feature?.properties;
      const coordinates = (feature?.geometry as GeoJSON.Point | undefined)?.coordinates;
      if (!properties || !coordinates) return;

      const bizId = String(properties.id);
      map.setFeatureState({ source: SOURCE_ID, id: bizId }, { hovered: true });
      hoverBusinessIdRef.current = bizId;
      setHoverBusinessId(bizId);

      closeHoverPopup();
      const popupProperties = properties as unknown as BusinessFeatureProperties;
      hoverPopupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 })
        .setLngLat(coordinates as [number, number])
        .setDOMContent(buildHoverPopupContent(popupProperties))
        .addTo(map);
      hoverPopupRef.current.getElement().classList.add('business-hover-popup');
    };

    const handlePinMouseLeave = () => {
      if (hoverBusinessIdRef.current) {
        map.removeFeatureState({ source: SOURCE_ID, id: hoverBusinessIdRef.current });
      }
      hoverBusinessIdRef.current = null;
      setHoverBusinessId(null);
      closeHoverPopup();
    };

    const handleClusterClick = async (event: maplibregl.MapLayerMouseEvent) => {
      if (placingBusinessId) return;
      const features = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER_ID] });
      if (!features.length) return;
      const clusterId = features[0].properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      map.easeTo({ center: coords, zoom, duration: 500 });
    };

    const handleMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const handleMouseLeave = () => { map.getCanvas().style.cursor = placingBusinessId ? 'crosshair' : ''; };

    map.on('click', LAYER_ID, handlePinClick);
    map.on('click', CORE_LAYER_ID, handlePinClick);
    map.on('mouseenter', LAYER_ID, handlePinMouseEnter);
    map.on('mouseenter', CORE_LAYER_ID, handlePinMouseEnter);
    map.on('mouseleave', LAYER_ID, handlePinMouseLeave);
    map.on('mouseleave', CORE_LAYER_ID, handlePinMouseLeave);
    map.on('click', CLUSTER_LAYER_ID, handleClusterClick);
    map.on('mouseenter', LAYER_ID, handleMouseEnter);
    map.on('mouseenter', CORE_LAYER_ID, handleMouseEnter);
    map.on('mouseleave', LAYER_ID, handleMouseLeave);
    map.on('mouseleave', CORE_LAYER_ID, handleMouseLeave);
    map.on('mouseenter', CLUSTER_LAYER_ID, handleMouseEnter);
    map.on('mouseleave', CLUSTER_LAYER_ID, handleMouseLeave);
    return () => {
      map.off('click', LAYER_ID, handlePinClick);
      map.off('click', CORE_LAYER_ID, handlePinClick);
      map.off('mouseenter', LAYER_ID, handlePinMouseEnter);
      map.off('mouseenter', CORE_LAYER_ID, handlePinMouseEnter);
      map.off('mouseleave', LAYER_ID, handlePinMouseLeave);
      map.off('mouseleave', CORE_LAYER_ID, handlePinMouseLeave);
      map.off('click', CLUSTER_LAYER_ID, handleClusterClick);
      map.off('mouseenter', LAYER_ID, handleMouseEnter);
      map.off('mouseenter', CORE_LAYER_ID, handleMouseEnter);
      map.off('mouseleave', LAYER_ID, handleMouseLeave);
      map.off('mouseleave', CORE_LAYER_ID, handleMouseLeave);
      map.off('mouseenter', CLUSTER_LAYER_ID, handleMouseEnter);
      map.off('mouseleave', CLUSTER_LAYER_ID, handleMouseLeave);
      closeHoverPopup();
    };
  }, [mapReady, pins, placingBusinessId]);

  // Resize observer
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !mapReady || !container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapReady]);

  // Label marker below hovered / selected pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeId = hoverBusinessId ?? selectedBusinessId;
    const activeBiz = activeId ? allBusinesses.find((b) => b.id === activeId) : null;

    labelMarkerRef.current?.remove();
    labelMarkerRef.current = null;

    if (activeBiz && activeBiz.mapX != null && activeBiz.mapY != null) {
      const el = document.createElement('div');
      el.textContent = activeBiz.name;
      el.style.cssText = [
        'position:absolute',
        'font-size:10px',
        'font-weight:600',
        'padding:2px 6px',
        'border-radius:4px',
        'background:hsl(0 0% 0% / 0.6)',
        'color:hsl(0 0% 95%)',
        'backdrop-filter:blur(4px)',
        'white-space:nowrap',
        'pointer-events:none',
        'transform:translateX(-50%)',
      ].join(';');
      labelMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 20] })
        .setLngLat([activeBiz.mapX, activeBiz.mapY])
        .addTo(map);
    }

    return () => {
      labelMarkerRef.current?.remove();
      labelMarkerRef.current = null;
    };
  }, [mapReady, hoverBusinessId, selectedBusinessId, allBusinesses]);

  // Cursor style
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = placingBusinessId ? 'crosshair' : '';
  }, [placingBusinessId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickerOffset((current) => (current + 0.6) % 1800);
    }, 30);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function centerMap() {
    mapRef.current?.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 });
  }

  function zoomBy(factor: number) {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: clamp(map.getZoom() * factor, MIN_ZOOM, MAX_ZOOM), duration: 400 });
  }

  function handleSelectBusiness(business: YouBusiness) {
    setPlacingBusinessId(null);
    setSelectedBusinessId(business.id);
    // Only fly to it if it's already placed on the map
    if (business.mapX != null && business.mapY != null) {
      mapRef.current?.flyTo({ center: [business.mapX, business.mapY], zoom: Math.max(mapRef.current.getZoom(), 2.4), speed: 0.9 });
    }
  }

  function handleStartPlacement(businessId: string) {
    const business = allBusinesses.find((b) => b.id === businessId);
    if (!business || !canUserPlaceBusiness(business, userId, isAdmin)) return;
    if (placingBusinessId === businessId) {
      setPlacingBusinessId(null);
      return;
    }
    setSelectedBusinessId(businessId);
    setPlacingBusinessId(businessId);
  }

  return (
    <div className={cn('relative flex h-full min-h-0 w-full flex-1 overflow-hidden', !embedded && 'rounded-2xl border border-border/60 shadow-xl')}>
      {/* Map fills everything */}
      <div ref={mapContainerRef} className="absolute inset-0" data-tutorial-id="carte-map-pane" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/15 via-transparent to-background/15" />

      {/* Owner filter pills — always visible */}
      <div className={cn('pointer-events-auto absolute top-3 z-10 flex gap-1.5', embedded ? 'left-3' : 'left-[236px]')}>
        {(['all', 'mine'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setOwnerFilter(f)}
            style={ownerFilter === f
              ? { background: 'hsl(var(--foreground))', color: 'hsl(var(--background))', borderColor: 'hsl(var(--foreground))' }
              : { background: 'hsl(0 0% 0% / 0.45)', backdropFilter: 'blur(6px)', color: 'hsl(0 0% 85%)', borderColor: 'hsl(var(--border) / 0.3)' }}
            className="rounded-full border px-3 py-1 text-[11px] font-medium transition-all"
          >
            {f === 'all' ? 'Tout' : 'À toi'}
          </button>
        ))}
      </div>

      {/* Left floating panel — hidden when embedded in dashboard */}
      {!embedded && (
        <div className="pointer-events-none absolute bottom-3 left-3 top-3 z-10 flex w-[220px] flex-col gap-2" data-tutorial-id="carte-browse-section">
          <button
            type="button"
            onClick={() => setShowBrowserModal(true)}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-4 py-3.5 shadow-lg backdrop-blur-sm transition-all hover:border-border hover:bg-background hover:shadow-xl active:scale-[0.98]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[13px] font-semibold text-foreground">Entreprises</p>
              <p className="text-[11px] text-muted-foreground">{allBusinesses.length} sur la carte</p>
            </div>
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground" />
          </button>
        </div>
      )}

      <BusinessBrowserModal
        open={showBrowserModal}
        onClose={() => setShowBrowserModal(false)}
        businesses={allBusinesses}
        userId={userId}
        onReload={onReload}
        onSelectOnMap={handleSelectBusiness}
      />

      {/* Right floating info panel */}
      {selectedBusiness && (
        <div className={cn('pointer-events-auto absolute top-3 z-10 w-[280px]', embedded ? 'right-3' : 'right-[312px]')}>
          <BusinessInfoPanel
            business={selectedBusiness}
            userId={userId}
            isAdmin={isAdmin}
            placementMode={placingBusinessId === selectedBusiness.id}
            onClose={() => { setSelectedBusinessId(null); setPlacingBusinessId(null); }}
            onPlace={() => handleStartPlacement(selectedBusiness.id)}
          />
        </div>
      )}

      {!embedded && (
      <div className="pointer-events-auto absolute bottom-14 right-3 top-3 z-10 w-[300px] rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-sm" data-tutorial-id="carte-notifications-pane">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between p-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notifications</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <BellRing className="h-3 w-3" />
              <span>{unreadCount} non lues</span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
            <div className="space-y-2">
              {youNotifications.length === 0 && (
                <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                  Aucune notification YOU pour le moment.
                </div>
              )}

              {youNotifications.map((notification) => {
                const meta = getYouNotificationMeta(notification);
                const ItemIcon = meta.icon;
                return (
                  <div key={notification.id} className={cn('rounded-lg border px-3 py-2', meta.tone)}>
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-md bg-background/35 p-1.5">
                        <ItemIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[12px] font-semibold text-foreground">{notification.title}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">{relativeTime(notification.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{notification.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
      )}

      {/* Placement banner — top center */}
      {placingBusinessId && (
        <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
            <MapPin className="h-4 w-4 shrink-0 text-sky-500" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {savingPlacementBusinessId ? 'Enregistrement…' : 'Cliquez sur la carte pour placer'}
              </p>
              {placingBusiness && !savingPlacementBusinessId && (
                <p className="text-[10px] text-muted-foreground">{placingBusiness.name}</p>
              )}
            </div>
            <button
              onClick={() => setPlacingBusinessId(null)}
              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Zoom controls — bottom right (above attribution) */}
      <div className={cn('absolute right-3 z-10 flex flex-col gap-1.5', embedded ? 'bottom-3' : 'bottom-10')}>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 border-border/40 bg-background/95 shadow-md backdrop-blur-sm"
          onClick={() => zoomBy(1.5)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 border-border/40 bg-background/95 shadow-md backdrop-blur-sm"
          onClick={() => zoomBy(1 / 1.5)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <div className="my-0.5 border-t border-border/30" />
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 border-border/40 bg-background/95 shadow-md backdrop-blur-sm"
          onClick={centerMap}
        >
          <LocateFixed className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!embedded && (
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/92 backdrop-blur-sm">
        <div className="flex h-10 items-center overflow-hidden px-4">
          <div className="mr-3 inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3 w-3" />
            Flux
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-6 whitespace-nowrap" style={{ transform: `translateX(${-tickerOffset}px)` }}>
              {[...tickerItems, ...tickerItems, ...tickerItems].map((item, index) => (
                <div key={`${item.label}-${index}`} className="inline-flex items-center gap-2 text-[11px]">
                  <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                  <span className="text-muted-foreground/40">•</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-3 inline-flex items-center gap-2 text-[10px] text-muted-foreground/80">
            <BellRing className="h-3 w-3" />
            Live
          </div>
        </div>
      </div>
      )}
    </div>
  );
});
