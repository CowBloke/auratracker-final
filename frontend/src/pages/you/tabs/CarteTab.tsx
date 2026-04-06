import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type YouBusiness, type YouState } from '@/services/api';
import {
  CITY_DISTRICTS,
  DISTRICT_FOR_TYPE,
  TYPE_EMOJI,
  getBusinessPinPosition,
} from '../mapConstants';

interface MapPin {
  business: YouBusiness;
  districtId: string;
  x: number;
  y: number;
  isOwned: boolean;
  pinColor: string;
}

function BusinessInfoCard({
  business,
  onClose,
}: {
  business: YouBusiness;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const profit = business.monthlyRevenue - business.monthlyExpenses;

  return (
    <Card className="mt-3 border border-border/60">
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">
              {TYPE_EMOJI[business.typeKey] ?? '🏢'}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-sm truncate">{business.name}</p>
                {business.verified && (
                  <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">
                    Vérifié
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {business.type?.label ?? business.typeKey} · {business.owner.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trésorerie</p>
            <p className="text-sm font-semibold tabular-nums">
              {business.treasuryMoney.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Profit/mois</p>
            <p className={`text-sm font-semibold tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {profit >= 0 ? '+' : ''}{profit.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Satisfaction</p>
            <p className="text-sm font-semibold tabular-nums">{business.satisfaction}%</p>
          </div>
        </div>

        {business.avgRating != null && business.ratingCount > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{business.avgRating.toFixed(1)} ({business.ratingCount} avis)</span>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={() => navigate('/you?tab=explore')}
          >
            <ExternalLink className="h-3 w-3" />
            Voir dans Explore
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CarteTab({
  data,
  userId,
}: {
  data: YouState;
  userId: string;
  isAdmin: boolean;
  onReload: () => Promise<void>;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(0.7);
  const [selectedBusiness, setSelectedBusiness] = useState<YouBusiness | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const allBusinesses = useMemo(
    () => [...data.ownedBusinesses, ...data.exploreBusinesses],
    [data],
  );

  const pins = useMemo<MapPin[]>(() => {
    const source = filter === 'mine' ? data.ownedBusinesses : allBusinesses;
    return source.map((b) => {
      const districtId = DISTRICT_FOR_TYPE[b.typeKey] ?? 'commerce';
      const district = CITY_DISTRICTS.find((d) => d.id === districtId)!;
      const pos = getBusinessPinPosition(b.id, district.bounds);
      return {
        business: b,
        districtId,
        x: pos.x,
        y: pos.y,
        isOwned: b.ownerId === userId,
        pinColor: district.pinColor,
      };
    });
  }, [allBusinesses, data.ownedBusinesses, filter, userId]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslateX((v) => v + dx);
    setTranslateY((v) => v + dy);
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => {
      const next = Math.min(3.0, Math.max(0.3, prev * delta));
      const ratio = next / prev;
      setTranslateX((tx) => cursorX - ratio * (cursorX - tx));
      setTranslateY((ty) => cursorY - ratio * (cursorY - ty));
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold">
              Carte de la ville
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {allBusinesses.length} business{allBusinesses.length !== 1 ? 'es' : ''}
              </span>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setFilter('all')}
              >
                Tous
              </Button>
              <Button
                size="sm"
                variant={filter === 'mine' ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setFilter('mine')}
              >
                Mes businesses
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {/* Map container */}
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg border border-border/40 bg-[#0a0a0f] select-none"
            style={{ aspectRatio: '10 / 7', cursor: dragging.current ? 'grabbing' : 'grab' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <svg
              viewBox="0 0 1000 700"
              width="100%"
              height="100%"
              style={{
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              {/* Background */}
              <rect width="1000" height="700" fill="#0a0a0f" />

              {/* Grid lines */}
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => (
                <line key={`vg-${x}`} x1={x} y1="0" x2={x} y2="700" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              ))}
              {[100, 200, 300, 400, 500, 600].map((y) => (
                <line key={`hg-${y}`} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              ))}

              {/* District dividers */}
              <line x1="400" y1="0" x2="400" y2="350" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
              <line x1="700" y1="0" x2="700" y2="350" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
              <line x1="0" y1="350" x2="1000" y2="350" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
              <line x1="500" y1="350" x2="500" y2="700" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

              {/* District fills and borders */}
              {CITY_DISTRICTS.map((d) => (
                <polygon
                  key={d.id}
                  points={d.svgPath}
                  fill={d.fill}
                  stroke={d.stroke}
                  strokeWidth="1"
                />
              ))}

              {/* District labels */}
              {CITY_DISTRICTS.map((d) => (
                <text
                  key={`label-${d.id}`}
                  x={d.labelX}
                  y={d.labelY}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill="rgba(255,255,255,0.25)"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {d.label.toUpperCase()}
                </text>
              ))}

              {/* Business pins */}
              {pins.map((pin) => (
                <g
                  key={pin.business.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBusiness(pin.business);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow ring for owned businesses */}
                  {pin.isOwned && (
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={17}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      style={{ filter: 'drop-shadow(0 0 5px #f59e0b88)' }}
                    />
                  )}
                  {/* Pin background */}
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={11}
                    fill={pin.isOwned ? '#1c1c2e' : '#111118'}
                    stroke={pin.pinColor}
                    strokeWidth={pin.isOwned ? 2 : 1.5}
                    opacity={pin.isOwned ? 1 : 0.7}
                  />
                  {/* Emoji icon */}
                  <text
                    x={pin.x}
                    y={pin.y + 5}
                    textAnchor="middle"
                    fontSize="11"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {TYPE_EMOJI[pin.business.typeKey] ?? '🏢'}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {CITY_DISTRICTS.map((d) => (
              <div key={d.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: d.pinColor }}
                />
                {d.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-amber-400" />
              Tes businesses
            </div>
          </div>

          {/* Hint */}
          <p className="mt-2 text-[11px] text-muted-foreground/50">
            Scroll pour zoomer · Clic-glisser pour naviguer
          </p>
        </CardContent>
      </Card>

      {/* Business info card */}
      {selectedBusiness && (
        <BusinessInfoCard
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
        />
      )}
    </div>
  );
}