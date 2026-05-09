import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  Activity,
  BellRing,
  Building2,
  ChevronDown,
  ExternalLink,
  Globe,
  Map as MapIcon,
  MapPin,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Map as MapView, MapControls, MapMarker, MarkerContent, MarkerLabel, MarkerTooltip, useMap } from '@/components/ui/map';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { type YouBusiness, type YouState, youApi } from '@/services/api';
import { BusinessBrowserModal } from '../components/BusinessBrowserModal';
import {
  WORLD_LATITUDE_LIMITS,
  WORLD_LONGITUDE_LIMITS,
  clamp,
  getBusinessPinColor,
} from '../mapConstants';
import { BUSINESS_ICON_MAP } from '../constants';
import { getYouNotificationMeta, isYouNotification, relativeTime } from '../utils';

// ── helpers ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.25;
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const CONSTRUCTION_STRIPES = 'repeating-linear-gradient(135deg,#facc15 0 6px,#111827 6px 12px)';

function getBizIcon(typeKey: string) {
  return BUSINESS_ICON_MAP[typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
}

function uniqueBusinesses(data: YouState): YouBusiness[] {
  const map = new Map<string, YouBusiness>();
  [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses].forEach((g) =>
    g.forEach((b) => map.set(b.id, b)),
  );
  return Array.from(map.values());
}

function canUserPlaceBusiness(business: YouBusiness, userId: string, isAdmin: boolean) {
  return isAdmin || business.ownerId === userId;
}

type PlacedBusiness = { business: YouBusiness; longitude: number; latitude: number; isOwned: boolean; pinColor: string };

function buildPlaced(businesses: YouBusiness[], userId: string): PlacedBusiness[] {
  return businesses
    .filter((b) => b.mapX != null && b.mapY != null)
    .map((b) => ({
      business: b,
      longitude: b.mapX!,
      latitude: b.mapY!,
      isOwned: b.ownerId === userId,
      pinColor: getBusinessPinColor(b.typeKey),
    }));
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} €`;
}

async function isOnLand(lat: number, lon: number): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const data = await res.json();
    return Boolean(data.countryCode);
  } catch {
    return true;
  }
}

// ── map sub-components ─────────────────────────────────────────────────────

/** Attaches a raw map click handler for placement mode using the useMap hook. */
function PlacementClickHandler({
  active,
  markerClickedRef,
  onPlace,
}: {
  active: boolean;
  markerClickedRef: React.MutableRefObject<boolean>;
  onPlace: (lng: number, lat: number) => void;
}) {
  const { map } = useMap();
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;

  useEffect(() => {
    if (!map || !active) return;
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (markerClickedRef.current) { markerClickedRef.current = false; return; }
      onPlaceRef.current(e.lngLat.lng, e.lngLat.lat);
    };
    map.on('click', handleClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => { map.off('click', handleClick); map.getCanvas().style.cursor = ''; };
  }, [map, active, markerClickedRef]);

  return null;
}

/** Flies to the default world view on mount — used for the locate/home button. */
function MapCenterButton({ onClick }: { onClick: (map: maplibregl.Map) => void }) {
  const { map } = useMap();
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  // expose the map instance to parent via callback
  useEffect(() => { if (map) onClickRef.current(map); }, [map]);
  return null;
}

// ── business pin ───────────────────────────────────────────────────────────

function BusinessPin({
  business,
  selected,
  hovered,
  pinColor,
}: {
  business: YouBusiness;
  selected: boolean;
  hovered: boolean;
  pinColor: string;
}) {
  const BizIcon = getBizIcon(business.typeKey);
  const underConstruction = Boolean(business.underConstruction);
  const size = selected ? 'size-9' : hovered ? 'size-8' : 'size-7';
  const iconSize = selected ? 'size-4' : 'size-3.5';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full transition-all duration-150',
        size,
      )}
      style={{
        background: underConstruction ? CONSTRUCTION_STRIPES : pinColor,
        boxShadow: selected
          ? `0 0 0 2.5px white, 0 0 0 4.5px ${pinColor}, 0 4px 12px ${pinColor}55`
          : hovered
            ? `0 0 0 2px white, 0 0 0 3.5px ${pinColor}90`
            : `0 2px 6px rgba(0,0,0,.35)`,
      }}
    >
      <BizIcon className={cn('text-white drop-shadow-sm', iconSize)} />
      {underConstruction && (
        <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full bg-amber-400 text-[7px] font-bold text-black shadow">
          ⚒
        </span>
      )}
    </div>
  );
}

// ── hover tooltip content ──────────────────────────────────────────────────

function PinTooltip({ business, pinColor }: { business: YouBusiness; pinColor: string }) {
  return (
    <div className="min-w-[160px] max-w-[220px] space-y-1">
      <p className="truncate text-[12px] font-semibold text-popover-foreground">{business.name}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        @{business.owner.username} · {business.type?.label ?? business.typeKey}
      </p>
      {business.description?.trim() && (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{business.description}</p>
      )}
      {business.avgRating != null && business.ratingCount > 0 && (
        <div className="mt-1.5 text-[10px]">
          <span style={{ color: pinColor }} className="font-semibold">
            ★ {business.avgRating.toFixed(1)}
          </span>
          <span className="ml-1 text-muted-foreground">{business.ratingCount} avis</span>
        </div>
      )}
    </div>
  );
}

// ── business info panel ────────────────────────────────────────────────────

function BusinessInfoPanel({
  business,
  userId,
  onClose,
  onPlace,
  onViewDetail,
  placementMode,
}: {
  business: YouBusiness;
  userId: string;
  onClose: () => void;
  onPlace: () => void;
  onViewDetail?: () => void;
  placementMode: boolean;
}) {
  const canPlace = business.ownerId === userId;
  const isPlaced = business.mapX != null && business.mapY != null;
  const pinColor = getBusinessPinColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);

  const approvedFormations = (business.formationProducts ?? []).filter((f) => f.status === 'APPROVED');
  const customItems = business.customData ?? [];
  const deployedProducts = (business.startupProducts ?? []).filter((p) => p.deployedLevel > 0);

  const services =
    approvedFormations.length > 0
      ? approvedFormations.slice(0, 5).map((f) => ({ key: f.id, label: f.title, price: f.price, emoji: null }))
      : customItems.length > 0
        ? customItems.slice(0, 5).map((it) => ({ key: it.key, label: it.label, price: it.price, emoji: it.emoji ?? null }))
        : deployedProducts.slice(0, 5).map((p) => ({ key: p.id, label: p.name, price: p.currentRevenue, emoji: null }));

  return (
    <div className="w-[260px] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
      {/* Header: icon + name + owner + rating */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${pinColor}18`, border: `1.5px solid ${pinColor}40` }}
        >
          <BizIcon className="size-5" style={{ color: pinColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{business.name}</p>
          <p className="truncate text-xs text-muted-foreground">@{business.owner.username}</p>
          {business.avgRating != null && business.ratingCount > 0 ? (
            <p className="text-xs">
              <span className="text-amber-500">★ {business.avgRating.toFixed(1)}</span>
              <span className="ml-1 text-muted-foreground">{business.ratingCount} avis</span>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/60">Pas encore noté</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {business.description?.trim() && (
        <div className="border-t border-border px-4 py-2.5">
          <p className="line-clamp-3 text-[11px] text-muted-foreground">{business.description}</p>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="border-t border-border">
          {services.map((s) => (
            <div key={s.key} className="flex items-center justify-between border-b border-border/40 px-4 py-2 last:border-0">
              <span className="truncate text-xs text-foreground">
                {s.emoji ? `${s.emoji} ` : ''}{s.label}
              </span>
              {s.price > 0 && (
                <span className="ml-3 shrink-0 text-xs font-medium text-muted-foreground">
                  {deployedProducts.length > 0 ? `+${formatMoney(s.price)}/m` : formatMoney(s.price)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className={cn('flex gap-2 p-3', services.length > 0 && 'border-t border-border')}>
        {canPlace && (
          <Button size="sm" variant="ghost" className="shrink-0 px-2.5 text-muted-foreground" onClick={onPlace}>
            <MapPin className="size-3.5" />
            {placementMode ? 'Annuler' : isPlaced ? 'Déplacer' : 'Placer'}
          </Button>
        )}
        {onViewDetail && (
          <Button size="sm" className={cn('gap-1.5', canPlace ? 'flex-1' : 'w-full')} onClick={onViewDetail}>
            <ExternalLink className="size-3.5" />
            Voir le détail
          </Button>
        )}
      </div>
    </div>
  );
}

// ── ticker item ────────────────────────────────────────────────────────────

type TickerItem = {
  label: string;
  value: string;
  icon: React.ElementType;
  valueClass: string;
};

// ── main component ─────────────────────────────────────────────────────────

export type CarteTabHandle = { startPlacing: (id: string) => void };

export const CarteTab = forwardRef<
  CarteTabHandle,
  {
    data: YouState;
    userId: string;
    isAdmin: boolean;
    onReload: () => Promise<void>;
    embedded?: boolean;
    externalSelectedId?: string | null;
  }
>(function CarteTab({ data, userId, isAdmin, onReload, embedded = false, externalSelectedId }, ref) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerClickedRef = useRef(false);
  const { notifications, unreadCount } = useNotifications();

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [placingBusinessId, setPlacingBusinessId] = useState<string | null>(null);
  const [savingPlacementId, setSavingPlacementId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'map' | 'globe'>('map');
  const [tickerOffset, setTickerOffset] = useState(0);
  const [showBrowserModal, setShowBrowserModal] = useState(false);
  const [browserInitialId, setBrowserInitialId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ startPlacing: handleStartPlacement }));

  useEffect(() => {
    if (externalSelectedId != null) setSelectedBusinessId(externalSelectedId);
  }, [externalSelectedId]);

  const allBusinesses = useMemo(() => uniqueBusinesses(data), [data]);
  const ownedBusinesses = useMemo(() => data.ownedBusinesses, [data.ownedBusinesses]);

  const placed = useMemo(() => {
    const source = ownerFilter === 'mine' ? ownedBusinesses : allBusinesses;
    return buildPlaced(source, userId);
  }, [ownerFilter, ownedBusinesses, allBusinesses, userId, isAdmin]);

  const selectedBusiness = allBusinesses.find((b) => b.id === selectedBusinessId) ?? null;
  const placingBusiness = allBusinesses.find((b) => b.id === placingBusinessId) ?? null;

  const youNotifications = useMemo(
    () => notifications.filter(isYouNotification).slice(0, 40),
    [notifications],
  );

  const tickerItems: TickerItem[] = useMemo(() => {
    const placedCount = ownedBusinesses.filter((b) => b.mapX != null).length;
    const totalTreasury = ownedBusinesses.reduce((s, b) => s + b.treasuryMoney, 0);
    const totalRevenue = ownedBusinesses.reduce((s, b) => s + b.monthlyRevenue, 0);
    const totalExpenses = ownedBusinesses.reduce((s, b) => s + b.monthlyExpenses, 0);
    const activeLoans = [...ownedBusinesses, ...data.exploreBusinesses]
      .flatMap((b) => b.recentLoans)
      .filter((l) => l.status === 'ACTIVE').length;

    return [
      { label: 'EMP', value: `${ownedBusinesses.length} entrep.`, icon: Building2, valueClass: 'text-foreground' },
      { label: 'MAP', value: `${placedCount} placés`, icon: MapPin, valueClass: 'text-sky-500' },
      { label: 'TRE', value: formatMoney(totalTreasury), icon: Wallet, valueClass: 'text-foreground' },
      { label: 'REV', value: `+${formatMoney(totalRevenue)}/mois`, icon: TrendingUp, valueClass: 'text-emerald-500' },
      { label: 'COST', value: `-${formatMoney(totalExpenses)}/mois`, icon: TrendingDown, valueClass: 'text-rose-500' },
      { label: 'LOAN', value: `${activeLoans} prêts`, icon: Activity, valueClass: 'text-foreground' },
      { label: 'SOC', value: `${data.relationships.length} relations`, icon: Users, valueClass: 'text-foreground' },
    ];
  }, [ownedBusinesses, data.exploreBusinesses, data.relationships.length]);

  // Ticker animation
  useEffect(() => {
    const id = window.setInterval(() => setTickerOffset((o) => (o + 0.6) % 1800), 30);
    return () => window.clearInterval(id);
  }, []);

  // Clean up selection if business disappears
  useEffect(() => {
    if (selectedBusinessId && !allBusinesses.some((b) => b.id === selectedBusinessId)) {
      setSelectedBusinessId(null);
      setPlacingBusinessId(null);
    }
  }, [allBusinesses, selectedBusinessId]);

  function handleSelectBusiness(business: YouBusiness) {
    setPlacingBusinessId(null);
    setSelectedBusinessId(business.id);
    if (business.mapX != null && business.mapY != null) {
      mapRef.current?.flyTo({ center: [business.mapX, business.mapY], zoom: Math.max(mapRef.current.getZoom(), 2.4), speed: 0.9 });
    }
  }

  function handleStartPlacement(businessId: string) {
    const business = allBusinesses.find((b) => b.id === businessId);
    if (!business || !canUserPlaceBusiness(business, userId, isAdmin)) return;
    if (placingBusinessId === businessId) { setPlacingBusinessId(null); return; }
    setSelectedBusinessId(businessId);
    setPlacingBusinessId(businessId);
  }

  const handleMapPlace = useCallback(
    async (lng: number, lat: number) => {
      if (!placingBusinessId) return;
      const target = allBusinesses.find((b) => b.id === placingBusinessId);
      if (!target || !canUserPlaceBusiness(target, userId, isAdmin)) { setPlacingBusinessId(null); return; }

      const clampedLng = clamp(lng, WORLD_LONGITUDE_LIMITS.min, WORLD_LONGITUDE_LIMITS.max);
      const clampedLat = clamp(lat, WORLD_LATITUDE_LIMITS.min, WORLD_LATITUDE_LIMITS.max);

      const onLand = await isOnLand(clampedLat, clampedLng);
      if (!onLand) {
        toast({ title: 'Emplacement invalide', description: 'Les businesses ne peuvent être placés que sur la terre ferme.', variant: 'destructive' });
        return;
      }

      setSavingPlacementId(target.id);
      try {
        await youApi.updateBusinessProfile(target.id, { mapX: clampedLng, mapY: clampedLat });
        await onReload();
        setSelectedBusinessId(target.id);
        setPlacingBusinessId(null);
        toast({ title: 'Emplacement mis à jour', description: `${target.name} est maintenant placé sur la carte.` });
      } catch (error: any) {
        toast({ title: 'Impossible de placer le business', description: error?.response?.data?.error ?? 'Réessayez dans un instant.', variant: 'destructive' });
      } finally {
        setSavingPlacementId(null);
      }
    },
    [placingBusinessId, allBusinesses, userId, isAdmin, onReload],
  );

  return (
    <div className={cn('relative flex h-full min-h-0 w-full flex-1 overflow-hidden', !embedded && 'rounded-2xl border border-border/60 shadow-xl')}>
      {/* Map */}
      <div className="absolute inset-0">
        <MapView
          key={mapType}
          ref={mapRef as any}
          center={DEFAULT_CENTER}
          zoom={mapType === 'globe' ? 2.5 : DEFAULT_ZOOM}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          dragRotate={mapType === 'globe'}
          pitchWithRotate={mapType === 'globe'}
          renderWorldCopies={mapType === 'map'}
          projection={mapType === 'globe' ? { type: 'globe' } : undefined}
          className="size-full"
        >
          {/* Placement click handler */}
          <PlacementClickHandler
            active={!!placingBusinessId}
            markerClickedRef={markerClickedRef}
            onPlace={handleMapPlace}
          />

          {/* Expose map ref for imperative controls */}
          <MapCenterButton
            onClick={(m) => { mapRef.current = m; }}
          />

          {/* Business markers */}
          {placed.map((p) => {
            const isSelected = p.business.id === selectedBusinessId;
            const isHovered = p.business.id === hoveredId;
            return (
              <MapMarker
                key={p.business.id}
                longitude={p.longitude}
                latitude={p.latitude}
                onClick={() => {
                  if (placingBusinessId) { markerClickedRef.current = true; return; }
                  handleSelectBusiness(p.business);
                }}
                onMouseEnter={() => setHoveredId(p.business.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <MarkerContent>
                  <BusinessPin
                    business={p.business}
                    selected={isSelected}
                    hovered={isHovered}
                    pinColor={p.pinColor}
                  />
                </MarkerContent>
                <MarkerTooltip className="bg-popover text-popover-foreground border border-border/60 shadow-lg backdrop-blur-sm">
                  <PinTooltip business={p.business} pinColor={p.pinColor} />
                </MarkerTooltip>
                {(isSelected || isHovered) && (
                  <MarkerLabel position="bottom">
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                      {p.business.name}
                    </span>
                  </MarkerLabel>
                )}
              </MapMarker>
            );
          })}

          {/* Map controls */}
          <MapControls
            position="top-right"
            showZoom
            showCompass
            showLocate
            showFullscreen
          />
        </MapView>
      </div>

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/10" />

      {/* Owner filter pills & Map type toggle */}
      <div className={cn('pointer-events-auto absolute top-3 z-10 flex gap-3', embedded ? 'left-3' : 'left-[236px]')}>
        <div className="flex gap-1.5">
          {(['all', 'mine'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setOwnerFilter(f)}
              style={
                ownerFilter === f
                  ? { background: 'hsl(var(--foreground))', color: 'hsl(var(--background))', borderColor: 'hsl(var(--foreground))' }
                  : { background: 'hsl(0 0% 0% / 0.45)', backdropFilter: 'blur(6px)', color: 'hsl(0 0% 85%)', borderColor: 'hsl(var(--border) / 0.3)' }
              }
              className="rounded-full border px-3 py-1 text-[11px] font-medium transition-all"
            >
              {f === 'all' ? 'Tout' : 'À toi'}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {(['map', 'globe'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMapType(t)}
              style={
                mapType === t
                  ? { background: 'hsl(var(--foreground))', color: 'hsl(var(--background))', borderColor: 'hsl(var(--foreground))' }
                  : { background: 'hsl(0 0% 0% / 0.45)', backdropFilter: 'blur(6px)', color: 'hsl(0 0% 85%)', borderColor: 'hsl(var(--border) / 0.3)' }
              }
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all"
            >
              {t === 'map' ? <MapIcon className="size-3" /> : <Globe className="size-3" />}
              {t === 'map' ? 'Carte' : 'Globe'}
            </button>
          ))}
        </div>
      </div>

      {/* Left panel — business browser button */}
      {!embedded && (
        <div className="pointer-events-none absolute bottom-3 left-3 top-3 z-10 flex w-[220px] flex-col gap-2" data-tutorial-id="carte-browse-section">
          <button
            type="button"
            onClick={() => setShowBrowserModal(true)}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-4 py-3.5 shadow-lg backdrop-blur-sm transition-all hover:border-border hover:bg-background hover:shadow-xl active:scale-[0.98]"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4.5" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[13px] font-semibold text-foreground">Entreprises</p>
              <p className="text-[11px] text-muted-foreground">{allBusinesses.length} sur la carte</p>
            </div>
            <ChevronDown className="ml-auto size-3.5 shrink-0 -rotate-90 text-muted-foreground" />
          </button>
        </div>
      )}

      <BusinessBrowserModal
        open={showBrowserModal}
        onClose={() => { setShowBrowserModal(false); setBrowserInitialId(null); }}
        businesses={allBusinesses}
        userId={userId}
        onReload={onReload}
        onSelectOnMap={handleSelectBusiness}
        initialBusinessId={browserInitialId}
      />

      {/* Selected business info panel */}
      {selectedBusiness && (
        <div className={cn('pointer-events-auto absolute top-3 z-10 w-[280px]', embedded ? 'right-3' : 'right-[312px]')}>
          <BusinessInfoPanel
            business={selectedBusiness}
            userId={userId}
            placementMode={placingBusinessId === selectedBusiness.id}
            onClose={() => { setSelectedBusinessId(null); setPlacingBusinessId(null); }}
            onPlace={() => handleStartPlacement(selectedBusiness.id)}
            onViewDetail={() => { setBrowserInitialId(selectedBusiness.id); setShowBrowserModal(true); }}
          />
        </div>
      )}

      {/* Notifications panel */}
      {!embedded && (
        <div
          className="pointer-events-auto absolute bottom-14 right-3 top-3 z-10 w-[300px] overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-sm"
          data-tutorial-id="carte-notifications-pane"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between p-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notifications</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <BellRing className="size-3" />
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
                          <ItemIcon className="size-3.5" />
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

      {/* Placement banner */}
      {placingBusinessId && (
        <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
            <MapPin className="size-4 shrink-0 text-sky-500" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {savingPlacementId ? 'Enregistrement…' : 'Cliquez sur la carte pour placer'}
              </p>
              {placingBusiness && !savingPlacementId && (
                <p className="text-[10px] text-muted-foreground">{placingBusiness.name}</p>
              )}
            </div>
            <button
              onClick={() => setPlacingBusinessId(null)}
              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom metrics ticker */}
      {!embedded && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/92 backdrop-blur-sm">
          <div className="flex h-10 items-center overflow-hidden px-4">
            <div className="mr-3 inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-3" />
              Flux
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div
                className="flex items-center gap-6 whitespace-nowrap"
                style={{ transform: `translateX(${-tickerOffset}px)` }}
              >
                {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5 text-[11px]">
                      <ItemIcon className={cn('size-3 shrink-0', item.valueClass)} />
                      <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {item.label}
                      </span>
                      <span className={cn('font-medium', item.valueClass)}>{item.value}</span>
                      <span className="text-muted-foreground/40">·</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="ml-3 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
              <BellRing className="size-3" />
              Live
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
