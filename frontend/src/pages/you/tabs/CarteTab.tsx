import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ExternalLink, LocateFixed, Minus, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.25;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

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

function createPinElement(pin: MapPin, selected: boolean, placementMode: boolean) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = cn(
    'group relative flex h-12 w-12 items-center justify-center rounded-full border transition-transform duration-200',
    placementMode ? 'pointer-events-none' : 'pointer-events-auto hover:scale-105',
  );
  button.style.borderColor = pin.pinColor;
  button.style.background = pin.isOwned ? 'rgba(248, 250, 252, 0.96)' : 'rgba(15, 23, 42, 0.96)';
  button.style.boxShadow = selected
    ? '0 0 0 10px rgba(125, 211, 252, 0.18), 0 10px 35px rgba(0, 0, 0, 0.28)'
    : pin.isOwned
      ? '0 0 0 8px rgba(245, 158, 11, 0.16), 0 10px 35px rgba(0, 0, 0, 0.22)'
      : '0 10px 35px rgba(0, 0, 0, 0.22)';
  button.setAttribute('aria-label', pin.business.name);
  button.innerHTML = `
    <span style="display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:9999px;background:${pin.pinColor};color:#08111d;font-size:11px;font-weight:800;letter-spacing:0.02em;">${TYPE_EMOJI[pin.business.typeKey] ?? 'B'}</span>
    ${pin.isOwned ? '<span style="position:absolute;right:-2px;top:-2px;height:10px;width:10px;border-radius:9999px;background:#f59e0b;border:1.5px solid #fff7ed;"></span>' : ''}
    ${!pin.hasSavedPosition ? '<span style="position:absolute;inset:-6px;border-radius:9999px;border:1px dashed rgba(255,255,255,0.25);"></span>' : ''}
  `;
  return button;
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
  const profit = business.monthlyRevenue - business.monthlyExpenses;

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
              <p className="text-xs text-slate-400">{business.type?.label ?? business.typeKey} • {business.owner.username}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {business.verified ? <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-300">Vérifié</span> : null}
            {business.ownerId === userId ? <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-200">À vous</span> : null}
            {business.mapX == null || business.mapY == null ? <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300">À placer</span> : null}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 transition-colors hover:text-white">
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
          <p className="uppercase tracking-[0.18em] text-slate-400">Position</p>
          <p className="mt-1 font-medium text-white">{business.mapX != null && business.mapY != null ? formatCoordinates(business.mapX, business.mapY) : 'Libre sur la carte'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="uppercase tracking-[0.18em] text-slate-400">Repère</p>
          <p className="mt-1 font-medium text-white">{business.location ?? 'Carte du monde'}</p>
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
            {placementMode ? 'Annuler le placement' : business.mapX == null || business.mapY == null ? 'Placer ici' : 'Déplacer'}
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [placingBusinessId, setPlacingBusinessId] = useState<string | null>(null);
  const [savingPlacementBusinessId, setSavingPlacementBusinessId] = useState<string | null>(null);
  const navigate = useNavigate();

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

  const pins = useMemo(() => buildPins(visibleBusinesses, userId, isAdmin), [visibleBusinesses, userId, isAdmin]);
  const selectedBusiness = allBusinesses.find((business) => business.id === selectedBusinessId) ?? null;

  const ownedVisibleCount = visibleBusinesses.filter((business) => business.ownerId === userId).length;
  const unplacedVisibleCount = visibleBusinesses.filter((business) => business.mapX == null || business.mapY == null).length;
  const placeableVisibleCount = visibleBusinesses.filter((business) => business.ownerId === userId || isAdmin).length;

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

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = async (event: maplibregl.MapMouseEvent) => {
      if (!placingBusinessId) return;
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

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    pins.forEach((pin) => {
      const isSelected = selectedBusinessId === pin.business.id;
      const element = createPinElement(pin, isSelected, Boolean(placingBusinessId));
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        if (placingBusinessId) return;
        setSelectedBusinessId(pin.business.id);
        map.flyTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(map.getZoom(), 2.4), speed: 0.9 });
      });

      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [mapReady, pins, placingBusinessId, selectedBusinessId]);

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
    setSelectedBusinessId(business.id);
    focusBusiness(business);
  }

  return (
    <div className="space-y-4 pb-8">
      <Card className="overflow-hidden border border-border/60 bg-[linear-gradient(180deg,rgba(7,17,31,0.98),rgba(12,28,44,0.94))] text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <CardHeader className="border-b border-white/10 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-white">Carte du monde des entreprises</CardTitle>
              <p className="max-w-2xl text-sm text-slate-300">
                Une vraie carte du monde. Les business se placent librement n’importe où, sans adresse ni géocodage.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="h-8 border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setFilter('all')}>
                Toute la carte
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <div
                ref={mapContainerRef}
                className={cn(
                  'relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07111d] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                  placingBusinessId ? 'ring-1 ring-sky-300/20' : '',
                )}
                style={{ aspectRatio: '16 / 10', cursor: placingBusinessId ? 'crosshair' : 'grab' }}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(245,158,11,0.18),transparent_20%),radial-gradient(circle_at_50%_82%,rgba(129,140,248,0.16),transparent_26%)]" />
                {placingBusinessId ? (
                  <div className="absolute left-3 top-3 z-10 max-w-sm rounded-2xl border border-sky-300/20 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-lg backdrop-blur">
                    <p className="font-medium text-white">Mode placement actif</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Cliquez n’importe où sur la carte du monde pour enregistrer la position du business sélectionné.
                    </p>
                    {savingPlacementBusinessId === placingBusinessId ? (
                      <p className="mt-2 text-xs font-medium text-sky-300">Enregistrement en cours…</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={() => zoomBy(1.15)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={() => zoomBy(1 / 1.15)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={centerMap}>
                    <LocateFixed className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
                  Vos business
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-sky-300" />
                  Carte réelle
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-white/70" />
                  Placement libre
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Molette pour zoomer • glisser pour naviguer • cliquer un business pour l’ouvrir • aucune adresse requise
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
                      const canPlace = business.ownerId === userId || isAdmin;
                      const hasSavedPosition = business.mapX != null && business.mapY != null;

                      return (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => handleSelectBusiness(business)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-sky-300/30 bg-sky-400/10'
                              : 'border-white/10 bg-slate-950/35 hover:bg-white/5',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white" style={{ boxShadow: `0 0 0 1px ${getBusinessPinColor(business.typeKey)}33 inset` }}>
                              {TYPE_EMOJI[business.typeKey] ?? 'B'}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{business.name}</div>
                              <div className="truncate text-xs text-slate-400">
                                {business.type?.label ?? business.typeKey} • {business.owner.username}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right text-[11px] text-slate-400">
                            <span className={cn('rounded-full px-2 py-0.5 font-medium', business.ownerId === userId ? 'bg-amber-400/10 text-amber-200' : 'bg-white/5 text-slate-300')}>
                              {business.ownerId === userId ? 'À vous' : 'Visible'}
                            </span>
                            <span>{hasSavedPosition ? 'Placé' : 'À placer'}</span>
                            {canPlace ? <span className="text-sky-300">Déplaçable</span> : null}
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
