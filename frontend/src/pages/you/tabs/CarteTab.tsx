import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ExternalLink, LocateFixed, Minus, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  getFallbackBusinessPosition,
} from '../mapConstants';

interface MapPin {
  business: YouBusiness;
  longitude: number;
  latitude: number;
  isOwned: boolean;
  canPlace: boolean;
  hasSavedPosition: boolean;
  pinColor: string;
}

type BusinessFeatureProperties = {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  typeKey: string;
  typeLabel: string;
  pinColor: string;
  selected: boolean;
  isOwned: boolean;
  canPlace: boolean;
  hasSavedPosition: boolean;
};

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.25;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const SOURCE_ID = 'you-businesses-source';
const LAYER_ID = 'you-businesses-layer';

function uniqueBusinesses(data: YouState) {
  const map = new Map<string, YouBusiness>();
  [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses].forEach((group) => {
    group.forEach((business) => map.set(business.id, business));
  });
  return Array.from(map.values());
}

function buildPins(businesses: YouBusiness[], userId: string, isAdmin: boolean): MapPin[] {
  return businesses.map((business, index) => {
    const fallbackPosition = getFallbackBusinessPosition(business.id, index);
    return {
      business,
      longitude: business.mapX ?? fallbackPosition.longitude,
      latitude: business.mapY ?? fallbackPosition.latitude,
      isOwned: business.ownerId === userId,
      canPlace: business.ownerId === userId || isAdmin,
      hasSavedPosition: business.mapX != null && business.mapY != null,
      pinColor: getBusinessPinColor(business.typeKey),
    };
  });
}

function buildSourceData(pins: MapPin[], selectedBusinessId: string | null): GeoJSON.FeatureCollection<GeoJSON.Point, BusinessFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pin.longitude, pin.latitude],
      },
      properties: {
        id: pin.business.id,
        name: pin.business.name,
        ownerId: pin.business.ownerId,
        ownerUsername: pin.business.owner.username,
        typeKey: pin.business.typeKey,
        typeLabel: pin.business.type?.label ?? pin.business.typeKey,
        pinColor: pin.pinColor,
        selected: selectedBusinessId === pin.business.id,
        isOwned: pin.isOwned,
        canPlace: pin.canPlace,
        hasSavedPosition: pin.hasSavedPosition,
      },
    })),
  };
}

function formatCoordinates(longitude: number, latitude: number) {
  return `${longitude.toFixed(2)}, ${latitude.toFixed(2)}`;
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
  const editable = business.ownerId === userId || isAdmin;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
            {TYPE_EMOJI[business.typeKey] ?? 'B'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{business.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {business.type?.label ?? business.typeKey} · {business.owner.username}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {business.verified ? <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">Vérifié</Badge> : null}
              {business.ownerId === userId ? <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700">À vous</Badge> : null}
              {business.mapX == null || business.mapY == null ? <Badge variant="outline" className="border-border/60 bg-muted/40 text-muted-foreground">À placer</Badge> : null}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
          <p className="uppercase tracking-[0.18em] text-muted-foreground">Position</p>
          <p className="mt-1 font-medium text-foreground">
            {business.mapX != null && business.mapY != null ? formatCoordinates(business.mapX, business.mapY) : 'Libre sur la carte'}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
          <p className="uppercase tracking-[0.18em] text-muted-foreground">Repère</p>
          <p className="mt-1 font-medium text-foreground">{business.location ?? 'Carte du monde'}</p>
        </div>
      </div>

      {business.avgRating != null && business.ratingCount > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="mr-1 text-amber-500">★</span>
          {business.avgRating.toFixed(1)} sur {business.ratingCount} avis
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {editable ? (
          <Button size="sm" className="gap-1.5" onClick={onPlace}>
            {placementMode ? 'Annuler le placement' : business.mapX == null || business.mapY == null ? 'Placer ici' : 'Déplacer'}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenExplore}>
          <ExternalLink className="h-3.5 w-3.5" />
          Explorer
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => navigate('/you?tab=explore')}>
          Ouvrir le détail
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
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [placingBusinessId, setPlacingBusinessId] = useState<string | null>(null);
  const [savingPlacementBusinessId, setSavingPlacementBusinessId] = useState<string | null>(null);
  const navigate = useNavigate();

  const allBusinesses = useMemo(() => uniqueBusinesses(data), [data]);
  const visibleBusinesses = useMemo(() => {
    const filteredByOwnership = filter === 'mine' ? allBusinesses.filter((business) => business.ownerId === userId) : allBusinesses;

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

  const pins = useMemo(() => buildPins(visibleBusinesses, userId, isAdmin), [visibleBusinesses, userId, isAdmin]);
  const sourceData = useMemo(() => buildSourceData(pins, selectedBusinessId), [pins, selectedBusinessId]);
  const selectedBusiness = allBusinesses.find((business) => business.id === selectedBusinessId) ?? null;

  const ownedVisibleCount = visibleBusinesses.filter((business) => business.ownerId === userId).length;
  const unplacedVisibleCount = visibleBusinesses.filter((business) => business.mapX == null || business.mapY == null).length;
  const placeableVisibleCount = visibleBusinesses.filter((business) => business.ownerId === userId || isAdmin).length;

  useEffect(() => {
    if (selectedBusinessId && !visibleBusinesses.some((business) => business.id === selectedBusinessId)) {
      setSelectedBusinessId(null);
      setPlacingBusinessId(null);
    }
  }, [selectedBusinessId, visibleBusinesses]);

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

    map.on('load', () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: sourceData,
        });

        map.addLayer({
          id: `${LAYER_ID}-glow`,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 18, 13],
            'circle-color': ['get', 'pinColor'],
            'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.16, 0.1],
            'circle-blur': 0.7,
          },
        });

        map.addLayer({
          id: LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 13, 9],
            'circle-color': ['get', 'pinColor'],
            'circle-stroke-color': ['case', ['boolean', ['get', 'selected'], false], '#ffffff', 'rgba(255,255,255,0.75)'],
            'circle-stroke-width': ['case', ['boolean', ['get', 'selected'], false], 3, 1.5],
            'circle-opacity': 0.96,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(sourceData);
  }, [mapReady, sourceData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = async (event: maplibregl.MapMouseEvent) => {
      if (!placingBusinessId) return;
      if (map.queryRenderedFeatures(event.point, { layers: [LAYER_ID, `${LAYER_ID}-glow`] }).length > 0) return;
      const targetBusiness = allBusinesses.find((business) => business.id === placingBusinessId);
      if (!targetBusiness || (!isAdmin && targetBusiness.ownerId !== userId)) {
        setPlacingBusinessId(null);
        return;
      }

      const nextLongitude = clamp(event.lngLat.lng, WORLD_LONGITUDE_LIMITS.min, WORLD_LONGITUDE_LIMITS.max);
      const nextLatitude = clamp(event.lngLat.lat, WORLD_LATITUDE_LIMITS.min, WORLD_LATITUDE_LIMITS.max);

      setSavingPlacementBusinessId(targetBusiness.id);
      try {
        await youApi.updateBusinessProfile(targetBusiness.id, { mapX: nextLongitude, mapY: nextLatitude });
        await onReload();
        setSelectedBusinessId(targetBusiness.id);
        setPlacingBusinessId(null);
        toast({
          title: 'Emplacement mis à jour',
          description: `${targetBusiness.name} est maintenant placé sur la carte du monde.`,
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
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [allBusinesses, isAdmin, mapReady, onReload, placingBusinessId, userId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleBusinessClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const businessId = feature?.properties && 'id' in feature.properties ? String(feature.properties.id) : null;
      if (!businessId || placingBusinessId) return;
      setPlacingBusinessId(null);
      setSelectedBusinessId(businessId);
      const pin = pins.find((entry) => entry.business.id === businessId);
      if (!pin) return;
      map.flyTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(map.getZoom(), 2.4), speed: 0.9 });
    };

    map.on('click', LAYER_ID, handleBusinessClick);
    return () => {
      map.off('click', LAYER_ID, handleBusinessClick);
    };
  }, [mapReady, pins, placingBusinessId]);

  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !mapReady || !container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      map.resize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [mapReady]);

  function centerMap() {
    mapRef.current?.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 });
  }

  function zoomBy(factor: number) {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: clamp(map.getZoom() * factor, MIN_ZOOM, MAX_ZOOM), duration: 400 });
  }

  function focusBusiness(business: YouBusiness) {
    const pin = pins.find((entry) => entry.business.id === business.id);
    if (!pin) return;
    setSelectedBusinessId(business.id);
    mapRef.current?.flyTo({ center: [pin.longitude, pin.latitude], zoom: 2.6, speed: 0.9 });
  }

  function handleStartPlacement(businessId: string) {
    const business = allBusinesses.find((entry) => entry.id === businessId);
    if (!business || (!isAdmin && business.ownerId !== userId)) return;
    if (placingBusinessId === businessId) {
      setPlacingBusinessId(null);
      return;
    }
    setSelectedBusinessId(businessId);
    setPlacingBusinessId(businessId);
    focusBusiness(business);
  }

  function handleSelectBusiness(business: YouBusiness) {
    setPlacingBusinessId(null);
    setSelectedBusinessId(business.id);
    focusBusiness(business);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-border/60 bg-background/95 text-foreground shadow-xl">
        <CardHeader className="shrink-0 border-b border-border/60 px-3 py-3 lg:px-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-foreground lg:text-base">Carte du monde</CardTitle>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground lg:text-sm">Placez les business librement, sans adresse ni géocodage.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="h-8 px-3 text-xs" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Tous
              </Button>
              <Button size="sm" className="h-8 px-3 text-xs" variant={filter === 'mine' ? 'default' : 'outline'} onClick={() => setFilter('mine')}>
                Miens
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-sm lg:text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher un business, un propriétaire ou un type"
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Badge variant="outline" className="justify-between border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span>Visibles</span>
                <span className="ml-3 text-foreground">{visibleBusinesses.length}</span>
              </Badge>
              <Badge variant="outline" className="justify-between border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span>À vous</span>
                <span className="ml-3 text-foreground">{ownedVisibleCount}</span>
              </Badge>
              <Badge variant="outline" className="justify-between border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span>À placer</span>
                <span className="ml-3 text-foreground">{unplacedVisibleCount}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 p-3 lg:p-4">
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_280px]">
            <div className="relative min-h-0 overflow-hidden rounded-3xl border border-border/60 bg-slate-950 shadow-inner">
              <div ref={mapContainerRef} className="absolute inset-0" style={{ cursor: placingBusinessId ? 'crosshair' : 'grab' }} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(245,158,11,0.12),transparent_20%),radial-gradient(circle_at_50%_82%,rgba(129,140,248,0.1),transparent_26%)]" />
              {placingBusinessId ? (
                <Badge className="absolute left-4 top-4 z-10 border-sky-500/20 bg-sky-500/10 text-sky-200">
                  Placement actif
                  {savingPlacementBusinessId === placingBusinessId ? ' · enregistrement…' : ''}
                </Badge>
              ) : null}
              <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
                <Button size="icon" variant="outline" className="h-9 w-9 border-border/60 bg-background/90 shadow-sm" onClick={() => zoomBy(1.15)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-9 w-9 border-border/60 bg-background/90 shadow-sm" onClick={() => zoomBy(1 / 1.15)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-9 w-9 border-border/60 bg-background/90 shadow-sm" onClick={centerMap}>
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 gap-2 overflow-hidden lg:grid-rows-[auto_minmax(0,1fr)]">
              <div className="rounded-3xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sélection</p>
                  {selectedBusiness ? <Badge variant="outline" className="border-border/60 bg-background/80 text-muted-foreground">{selectedBusiness.ownerId === userId ? 'À vous' : 'Visible'}</Badge> : null}
                </div>
                <div className="mt-2">
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
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-3 py-4 text-sm text-muted-foreground">
                      Sélectionnez un business sur la carte.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Résultats</p>
                    <p className="text-xs text-muted-foreground">{placeableVisibleCount} déplaçables</p>
                  </div>
                  <Badge variant="outline" className="border-border/60 bg-background/80 text-[11px] text-muted-foreground">
                    {visibleBusinesses.length}
                  </Badge>
                </div>

                <ScrollArea className="mt-2 min-h-0 flex-1 pr-1">
                  <div className="space-y-1.5 pr-2">
                    {visibleBusinesses.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-3 py-4 text-sm text-muted-foreground">
                        Aucun business ne correspond à la recherche.
                      </div>
                    ) : visibleBusinesses.map((business) => {
                      const isSelected = selectedBusinessId === business.id;
                      const canPlace = business.ownerId === userId || isAdmin;
                      const hasSavedPosition = business.mapX != null && business.mapY != null;

                      return (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => handleSelectBusiness(business)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                            isSelected ? 'border-primary/30 bg-primary/10' : 'border-border/60 bg-background/60 hover:bg-background/80',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-sm font-semibold text-foreground"
                              style={{ boxShadow: `0 0 0 1px ${getBusinessPinColor(business.typeKey)}33 inset` }}
                            >
                              {TYPE_EMOJI[business.typeKey] ?? 'B'}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{business.name}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {business.type?.label ?? business.typeKey} · {business.owner.username}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[10px] text-muted-foreground">
                            <span className={cn('rounded-full px-2 py-0.5 font-medium', business.ownerId === userId ? 'bg-amber-500/10 text-amber-700' : 'bg-muted/60 text-muted-foreground')}>
                              {business.ownerId === userId ? 'À vous' : 'Visible'}
                            </span>
                            <span>{hasSavedPosition ? 'Placé' : 'À placer'}</span>
                            {canPlace ? <span className="text-sky-600">Déplaçable</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
