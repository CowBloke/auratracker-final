import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ExternalLink, LocateFixed, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { type YouBusiness, type YouState, youApi } from '@/services/api';
import {
  WORLD_LATITUDE_LIMITS,
  WORLD_LONGITUDE_LIMITS,
  WORLD_MAP_STYLE,
  TYPE_EMOJI,
  clamp,
  getBusinessPinColor,
} from '../mapConstants';

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
  emoji: string;
  pinColor: string;
  selected: boolean;
  isOwned: boolean;
  canPlace: boolean;
};

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.25;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const SOURCE_ID = 'you-businesses-source';
const LAYER_ID = 'you-businesses-layer';
const CLUSTER_LAYER_ID = 'you-businesses-cluster';
const PIN_SIZE = 40;
const CLUSTER_SIZE = 44;

function uniqueBusinesses(data: YouState): YouBusiness[] {
  const map = new Map<string, YouBusiness>();
  [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses].forEach((group) => {
    group.forEach((b) => map.set(b.id, b));
  });
  return Array.from(map.values());
}

const ASSOCIATE_ROLES = ['associé', 'associée', 'associe', 'associee', 'partner'];

function isBusinessAssociate(business: YouBusiness, userId: string): boolean {
  return business.members.some(
    (m) => m.user.id === userId && ASSOCIATE_ROLES.includes((m.role ?? '').toLowerCase()),
  );
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
      canPlace: b.ownerId === userId || isAdmin || isBusinessAssociate(b, userId),
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
        emoji: TYPE_EMOJI[pin.business.typeKey] ?? '📍',
        pinColor: pin.pinColor,
        selected: selectedId === pin.business.id,
        isOwned: pin.isOwned,
        canPlace: pin.canPlace,
      },
    })),
  };
}

function createPinImageData(emoji: string, color: string, size: number, selected: boolean): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = selected ? size * 0.43 : size * 0.37;

  // Outer glow ring for selected
  if (selected) {
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.47, 0, Math.PI * 2);
    ctx.fillStyle = color + '35';
    ctx.fill();
  }

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = selected ? 8 : 5;
  ctx.shadowOffsetY = selected ? 3 : 2;

  // Main circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // White border
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = selected ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth = selected ? 2.5 : 1.8;
  ctx.stroke();

  // Emoji
  const fontSize = Math.floor(r * 1.05);
  ctx.font = `${fontSize}px 'Segoe UI Emoji', 'Apple Color Emoji', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 1);

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

function formatCoordinates(lon: number, lat: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(5)}°${latDir}, ${Math.abs(lon).toFixed(5)}°${lonDir}`;
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

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-xl">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
          {TYPE_EMOJI[business.typeKey] ?? '📍'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{business.name}</p>
          <p className="truncate text-xs text-muted-foreground">{business.type?.label ?? business.typeKey}</p>
          <p className="truncate text-xs text-muted-foreground">@{business.owner.username}</p>
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
      <div className="divide-y divide-border border-t border-border">
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [placingBusinessId, setPlacingBusinessId] = useState<string | null>(null);
  const [savingPlacementBusinessId, setSavingPlacementBusinessId] = useState<string | null>(null);

  const allBusinesses = useMemo(() => uniqueBusinesses(data), [data]);
  const memberBusinessIds = useMemo(() => new Set(data.memberBusinesses.map((b) => b.id)), [data.memberBusinesses]);

  const typeChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: Array<{ key: string; emoji: string; label: string }> = [];
    allBusinesses.forEach((b) => {
      if (!seen.has(b.typeKey)) {
        seen.add(b.typeKey);
        chips.push({
          key: b.typeKey,
          emoji: TYPE_EMOJI[b.typeKey] ?? '📍',
          label: b.type?.label ?? b.typeKey,
        });
      }
    });
    return chips;
  }, [allBusinesses]);

  const hasMemberBusinesses = memberBusinessIds.size > 0;

  const visibleBusinesses = useMemo(() => {
    let filtered = allBusinesses;
    if (typeFilter === '__membre__') {
      filtered = filtered.filter((b) => memberBusinessIds.has(b.id));
    } else if (typeFilter) {
      filtered = filtered.filter((b) => b.typeKey === typeFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((b) =>
      [b.name, b.owner.username, b.type?.label ?? b.typeKey, b.typeKey, b.location ?? ''].join(' ').toLowerCase().includes(q),
    );
  }, [allBusinesses, memberBusinessIds, typeFilter, searchQuery]);

  const placedBusinesses = useMemo(() => visibleBusinesses.filter((b) => b.mapX != null && b.mapY != null), [visibleBusinesses]);
  const unplacedBusinesses = useMemo(() => visibleBusinesses.filter((b) => b.mapX == null || b.mapY == null), [visibleBusinesses]);

  const pins = useMemo(() => buildPins(visibleBusinesses, userId, isAdmin), [visibleBusinesses, userId, isAdmin]);
  const sourceData = useMemo(() => buildSourceData(pins, selectedBusinessId), [pins, selectedBusinessId]);

  const selectedBusiness = allBusinesses.find((b) => b.id === selectedBusinessId) ?? null;
  const placingBusiness = allBusinesses.find((b) => b.id === placingBusinessId) ?? null;

  useEffect(() => {
    if (selectedBusinessId && !visibleBusinesses.some((b) => b.id === selectedBusinessId)) {
      setSelectedBusinessId(null);
      setPlacingBusinessId(null);
    }
  }, [selectedBusinessId, visibleBusinesses]);

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
        return;
      }
      const fallbackData = createPinImageData('📍', '#64748b', PIN_SIZE, false);
      if (!map.hasImage(e.id)) map.addImage(e.id, fallbackData);
    });

    map.on('load', () => {
      map.resize();
      // Generate emoji canvas images for each type (normal + selected)
      [...Object.keys(TYPE_EMOJI), '__default__'].forEach((typeKey) => {
        const emoji = TYPE_EMOJI[typeKey] ?? '📍';
        const color = getBusinessPinColor(typeKey === '__default__' ? '' : typeKey);

        if (!map.hasImage(`pin-${typeKey}`)) {
          map.addImage(`pin-${typeKey}`, createPinImageData(emoji, color, PIN_SIZE, false));
        }
        if (!map.hasImage(`pin-${typeKey}-sel`)) {
          map.addImage(`pin-${typeKey}-sel`, createPinImageData(emoji, color, PIN_SIZE, true));
        }
      });

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: sourceData,
          cluster: true,
          clusterMaxZoom: 9,
          clusterRadius: 25,
        });

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
            'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 22, 16],
            'circle-color': ['get', 'pinColor'],
            'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.22, 0.1],
            'circle-blur': 0.9,
          },
        });

        // Emoji pin icons — individual pins only
        map.addLayer({
          id: LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': [
              'case',
              ['boolean', ['get', 'selected'], false],
              ['concat', 'pin-', ['get', 'typeKey'], '-sel'],
              ['concat', 'pin-', ['get', 'typeKey']],
            ],
            'icon-size': 1,
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
      if (map.queryRenderedFeatures(event.point, { layers: [LAYER_ID, CLUSTER_LAYER_ID] }).length > 0) return;

      const target = allBusinesses.find((b) => b.id === placingBusinessId);
      if (!target || (!isAdmin && target.ownerId !== userId && !isBusinessAssociate(target, userId))) {
        setPlacingBusinessId(null);
        return;
      }

      const lon = clamp(event.lngLat.lng, WORLD_LONGITUDE_LIMITS.min, WORLD_LONGITUDE_LIMITS.max);
      const lat = clamp(event.lngLat.lat, WORLD_LATITUDE_LIMITS.min, WORLD_LATITUDE_LIMITS.max);

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
    map.on('click', CLUSTER_LAYER_ID, handleClusterClick);
    map.on('mouseenter', LAYER_ID, handleMouseEnter);
    map.on('mouseleave', LAYER_ID, handleMouseLeave);
    map.on('mouseenter', CLUSTER_LAYER_ID, handleMouseEnter);
    map.on('mouseleave', CLUSTER_LAYER_ID, handleMouseLeave);
    return () => {
      map.off('click', LAYER_ID, handlePinClick);
      map.off('click', CLUSTER_LAYER_ID, handleClusterClick);
      map.off('mouseenter', LAYER_ID, handleMouseEnter);
      map.off('mouseleave', LAYER_ID, handleMouseLeave);
      map.off('mouseenter', CLUSTER_LAYER_ID, handleMouseEnter);
      map.off('mouseleave', CLUSTER_LAYER_ID, handleMouseLeave);
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

  // Cursor style
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = placingBusinessId ? 'crosshair' : '';
  }, [placingBusinessId]);

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
    if (!business || (!isAdmin && business.ownerId !== userId && !isBusinessAssociate(business, userId))) return;
    if (placingBusinessId === businessId) {
      setPlacingBusinessId(null);
      return;
    }
    setSelectedBusinessId(businessId);
    setPlacingBusinessId(businessId);
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-border/60 shadow-xl">
      {/* Map fills everything */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Left floating panel */}
      <div className="pointer-events-none absolute bottom-3 left-3 top-3 z-10 flex w-[264px] flex-col gap-2">

        {/* Search + filters */}
        <div className="pointer-events-auto rounded-xl border border-border/30 bg-background/95 p-2.5 shadow-lg backdrop-blur-sm">
          <label className="flex items-center gap-2 rounded-lg border border-input/80 bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="h-5 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </label>
          {/* Type filter chips */}
          <div className="mt-2 flex flex-wrap gap-1">
            {typeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setTypeFilter(typeFilter === chip.key ? null : chip.key)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                  typeFilter === chip.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <span>{chip.emoji}</span>
                <span>{chip.label}</span>
              </button>
            ))}
            {hasMemberBusinesses && (
              <button
                type="button"
                onClick={() => setTypeFilter(typeFilter === '__membre__' ? null : '__membre__')}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                  typeFilter === '__membre__'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <span>👥</span>
                <span>Clan</span>
              </button>
            )}
          </div>
        </div>

        {/* Business list + info card */}
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/30 bg-background/95 shadow-lg backdrop-blur-sm">
          <ScrollArea className="min-h-0 flex-1">
            <div className="py-1">

              {/* Unplaced section */}
              {unplacedBusinesses.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      À placer ({unplacedBusinesses.length})
                    </span>
                  </div>
                  {unplacedBusinesses.map((business) => {
                    const isSelected = selectedBusinessId === business.id;
                    const canPlace = business.ownerId === userId || isAdmin || isBusinessAssociate(business, userId);
                    const isBeingPlaced = placingBusinessId === business.id;

                    return (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => handleSelectBusiness(business)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          isSelected ? 'bg-accent' : 'hover:bg-muted/50',
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm">
                          {TYPE_EMOJI[business.typeKey] ?? '📍'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium text-foreground">{business.name}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[10px] text-muted-foreground">{business.type?.label ?? business.typeKey}</span>
                            {business.avgRating != null && business.ratingCount > 0 && (
                              <span className="shrink-0 text-[10px] text-amber-500">★ {business.avgRating.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                        {canPlace && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStartPlacement(business.id); }}
                            className={cn(
                              'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                              isBeingPlaced
                                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                            )}
                          >
                            {isBeingPlaced ? 'Annuler' : 'Placer'}
                          </button>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Placed section */}
              {placedBusinesses.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Sur la carte ({placedBusinesses.length})
                    </span>
                  </div>
                  {placedBusinesses.map((business) => {
                    const isSelected = selectedBusinessId === business.id;

                    return (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => handleSelectBusiness(business)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          isSelected ? 'bg-accent' : 'hover:bg-muted/50',
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm">
                          {TYPE_EMOJI[business.typeKey] ?? '📍'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium text-foreground">{business.name}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[10px] text-muted-foreground">@{business.owner.username}</span>
                            {business.avgRating != null && business.ratingCount > 0 && (
                              <span className="shrink-0 text-[10px] text-amber-500">★ {business.avgRating.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                        {isSelected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </>
              )}

              {visibleBusinesses.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Aucun résultat</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right floating info panel */}
      {selectedBusiness && (
        <div className="pointer-events-auto absolute right-3 top-3 z-10 w-[280px]">
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
      <div className="absolute bottom-10 right-3 z-10 flex flex-col gap-1.5">
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
    </div>
  );
}
