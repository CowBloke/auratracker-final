import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, LocateFixed, Minus, Plus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouState } from '@/services/api';
import {
  CITY_DISTRICTS,
  DISTRICT_FOR_TYPE,
  TYPE_EMOJI,
  djb2Hash,
  getBusinessPinPosition,
} from '../mapConstants';

interface MapPin {
  business: YouBusiness;
  districtId: string;
  x: number;
  y: number;
  isOwned: boolean;
  districtLabel: string;
  pinColor: string;
}

interface BusinessBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  tone: string;
}

const AVENUES = [
  'M40,170 C220,210 350,150 470,178 S740,240 960,188',
  'M70,328 C236,290 330,352 514,330 S760,260 944,320',
  'M86,540 C258,498 372,560 560,540 S798,476 930,520',
  'M248,58 C280,170 268,302 298,430 S330,622 364,668',
  'M650,40 C606,164 632,308 602,442 S570,618 548,664',
];

const RIVER_PATH =
  'M0,438 C122,408 204,352 318,378 C430,404 494,486 600,484 C734,480 842,392 1000,420 L1000,700 L0,700 Z';

const PARKS = [
  'M96,418 C138,386 212,384 252,430 C222,486 140,500 98,462 Z',
  'M734,108 C786,84 862,100 900,154 C870,208 782,214 734,168 Z',
];

function createDistrictBlocks(districtId: string, total = 10): BusinessBlock[] {
  const district = CITY_DISTRICTS.find((entry) => entry.id === districtId);
  if (!district) return [];

  return Array.from({ length: total }, (_, index) => {
    const seed = djb2Hash(`${districtId}-${index}`);
    const width = 18 + (seed % 30);
    const height = 14 + (Math.floor(seed / 13) % 34);
    const x = district.bounds.x + 12 + (Math.floor(seed / 5) % Math.max(28, district.bounds.w - width - 24));
    const y = district.bounds.y + 12 + (Math.floor(seed / 17) % Math.max(28, district.bounds.h - height - 24));
    const rotate = (seed % 14) - 7;
    const tone = ['#1f2937', '#273449', '#31415a'][seed % 3];
    return { id: `${districtId}-${index}`, x, y, width, height, rotate, tone };
  });
}

function BusinessInfoCard({
  business,
  districtLabel,
  onClose,
}: {
  business: YouBusiness;
  districtLabel: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const profit = business.monthlyRevenue - business.monthlyExpenses;

  return (
    <Card className="border border-border/60 bg-background/95 backdrop-blur">
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-sm font-semibold">
                {TYPE_EMOJI[business.typeKey] ?? 'B'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{business.name}</p>
                <p className="text-xs text-muted-foreground">
                  {business.type?.label ?? business.typeKey} • {districtLabel}
                </p>
              </div>
            </div>
            {business.verified ? (
              <div className="mt-2 inline-flex rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-400">
                Vérifié
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Trésorerie</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{business.treasuryMoney.toLocaleString('fr-FR')}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Profit</p>
            <p className={cn('mt-1 text-sm font-semibold tabular-nums', profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {profit >= 0 ? '+' : ''}
              {profit.toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Satisf.</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{business.satisfaction}%</p>
          </div>
        </div>

        {business.avgRating != null && business.ratingCount > 0 ? (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {business.avgRating.toFixed(1)} sur {business.ratingCount} avis
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/you?tab=explore')}>
            <ExternalLink className="h-3.5 w-3.5" />
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
  const [scale, setScale] = useState(0.88);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const allBusinesses = useMemo(
    () => [...data.ownedBusinesses, ...data.exploreBusinesses],
    [data.exploreBusinesses, data.ownedBusinesses],
  );

  const filteredBusinesses = filter === 'mine' ? data.ownedBusinesses : allBusinesses;

  const districtBlocks = useMemo(
    () => CITY_DISTRICTS.flatMap((district) => createDistrictBlocks(district.id, district.id === 'justice' ? 16 : 12)),
    [],
  );

  const pins = useMemo<MapPin[]>(() => (
    filteredBusinesses.map((business) => {
      const districtId = DISTRICT_FOR_TYPE[business.typeKey] ?? 'commerce';
      const district = CITY_DISTRICTS.find((entry) => entry.id === districtId) ?? CITY_DISTRICTS[0];
      const pos = getBusinessPinPosition(business.id, district.bounds);
      return {
        business,
        districtId,
        x: pos.x,
        y: pos.y,
        isOwned: business.ownerId === userId,
        districtLabel: district.label,
        pinColor: district.pinColor,
      };
    })
  ), [filteredBusinesses, userId]);

  const selectedPin = pins.find((pin) => pin.business.id === selectedBusinessId) ?? null;

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    lastPos.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = event.clientX - lastPos.current.x;
    const dy = event.clientY - lastPos.current.y;
    lastPos.current = { x: event.clientX, y: event.clientY };
    setTranslateX((value) => value + dx);
    setTranslateY((value) => value + dy);
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  function adjustZoom(nextScale: number) {
    setScale(Math.min(2.6, Math.max(0.55, nextScale)));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const ratio = event.deltaY > 0 ? 0.92 : 1.08;

    setScale((previous) => {
      const next = Math.min(2.6, Math.max(0.55, previous * ratio));
      const scaleRatio = next / previous;
      setTranslateX((value) => cursorX - scaleRatio * (cursorX - value));
      setTranslateY((value) => cursorY - scaleRatio * (cursorY - value));
      return next;
    });
  }

  function centerMap() {
    setTranslateX(0);
    setTranslateY(0);
    setScale(0.88);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-border/60 bg-[linear-gradient(180deg,rgba(7,17,31,0.98),rgba(12,28,44,0.94))] text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <CardHeader className="border-b border-white/10 px-5 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-white">Plan de ville des entreprises</CardTitle>
              <p className="mt-1 text-sm text-slate-300">
                Une lecture stylisée de la ville, par quartiers, flux et zones d’influence.
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Adresses</div>
              <div className="mt-1 text-2xl font-semibold text-white">{filteredBusinesses.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Vous possédez</div>
              <div className="mt-1 text-2xl font-semibold text-amber-300">{data.ownedBusinesses.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Quartiers actifs</div>
              <div className="mt-1 text-2xl font-semibold text-sky-300">
                {new Set(filteredBusinesses.map((business) => DISTRICT_FOR_TYPE[business.typeKey] ?? 'commerce')).size}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div
                ref={containerRef}
                className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#07111d] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                style={{ aspectRatio: '16 / 10', cursor: dragging.current ? 'grabbing' : 'grab' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(245,158,11,0.18),transparent_20%),radial-gradient(circle_at_50%_82%,rgba(129,140,248,0.16),transparent_26%)]" />
                <svg
                  viewBox="0 0 1000 700"
                  width="100%"
                  height="100%"
                  style={{
                    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                  onClick={() => setSelectedBusinessId(null)}
                >
                  <defs>
                    <linearGradient id="city-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#07101b" />
                    </linearGradient>
                    <linearGradient id="river" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(56,189,248,0.24)" />
                      <stop offset="100%" stopColor="rgba(14,165,233,0.10)" />
                    </linearGradient>
                  </defs>

                  <rect width="1000" height="700" fill="url(#city-glow)" />

                  {PARKS.map((path) => (
                    <path key={path} d={path} fill="rgba(74, 222, 128, 0.08)" stroke="rgba(74, 222, 128, 0.18)" strokeWidth="2" />
                  ))}

                  <path d={RIVER_PATH} fill="url(#river)" />

                  {AVENUES.map((path) => (
                    <path key={path} d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" strokeLinecap="round" />
                  ))}
                  {AVENUES.map((path) => (
                    <path key={`${path}-center`} d={path} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" strokeDasharray="8 12" strokeLinecap="round" />
                  ))}

                  {districtBlocks.map((block) => (
                    <rect
                      key={block.id}
                      x={block.x}
                      y={block.y}
                      width={block.width}
                      height={block.height}
                      rx="4"
                      fill={block.tone}
                      opacity="0.9"
                      transform={`rotate(${block.rotate} ${block.x + block.width / 2} ${block.y + block.height / 2})`}
                    />
                  ))}

                  {CITY_DISTRICTS.map((district) => (
                    <path
                      key={district.id}
                      d={`M${district.svgPath}`}
                      fill={district.fill}
                      stroke={district.stroke}
                      strokeWidth="3"
                    />
                  ))}

                  {CITY_DISTRICTS.map((district) => (
                    <g key={`${district.id}-label`}>
                      <text
                        x={district.labelX}
                        y={district.labelY}
                        textAnchor="middle"
                        fontSize="20"
                        fontWeight="700"
                        fill="rgba(255,255,255,0.82)"
                        letterSpacing="2.5"
                      >
                        {district.label.toUpperCase()}
                      </text>
                    </g>
                  ))}

                  {pins.map((pin) => {
                    const selected = selectedBusinessId === pin.business.id;
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
                        <path
                          d={`M ${pin.x} ${pin.y - 18} C ${pin.x + 15} ${pin.y - 18}, ${pin.x + 18} ${pin.y + 4}, ${pin.x} ${pin.y + 22} C ${pin.x - 18} ${pin.y + 4}, ${pin.x - 15} ${pin.y - 18}, ${pin.x} ${pin.y - 18} Z`}
                          fill={pin.isOwned ? '#f8fafc' : '#101828'}
                          stroke={pin.pinColor}
                          strokeWidth={selected ? 3 : 2}
                        />
                        <circle cx={pin.x} cy={pin.y - 4} r="11" fill={pin.pinColor} />
                        <text
                          x={pin.x}
                          y={pin.y}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill="#08111d"
                        >
                          {TYPE_EMOJI[pin.business.typeKey] ?? 'B'}
                        </text>
                        {pin.isOwned ? (
                          <circle cx={pin.x + 14} cy={pin.y - 14} r="8" fill="#f59e0b" stroke="#fff7ed" strokeWidth="1.5" />
                        ) : null}
                      </g>
                    );
                  })}
                </svg>

                <div className="absolute right-3 top-3 flex flex-col gap-2">
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={() => adjustZoom(scale * 1.12)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={() => adjustZoom(scale / 1.12)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-9 w-9 border-white/15 bg-slate-950/70 text-white hover:bg-slate-900" onClick={centerMap}>
                    <LocateFixed className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {CITY_DISTRICTS.map((district) => (
                  <div key={district.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: district.pinColor }} />
                    {district.label}
                  </div>
                ))}
                <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
                  Halo or = vos business
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Molette pour zoomer • cliquer-glisser pour naviguer • cliquer sur une adresse pour ouvrir sa fiche
              </p>
            </div>

            <div className="space-y-4">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-3 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Sélection</div>
                  {selectedPin ? (
                    <BusinessInfoCard
                      business={selectedPin.business}
                      districtLabel={selectedPin.districtLabel}
                      onClose={() => setSelectedBusinessId(null)}
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
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Pulse urbain</div>
                  {CITY_DISTRICTS.map((district) => {
                    const total = pins.filter((pin) => pin.districtId === district.id).length;
                    const owned = pins.filter((pin) => pin.districtId === district.id && pin.isOwned).length;
                    return (
                      <div key={district.id} className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{district.label}</div>
                            <div className="text-xs text-slate-400">{owned} à vous • {total} visibles</div>
                          </div>
                          <div className="h-2.5 w-16 rounded-full bg-white/10">
                            <div
                              className="h-2.5 rounded-full"
                              style={{
                                width: `${total === 0 ? 0 : Math.max(10, Math.round((owned / total) * 100))}%`,
                                backgroundColor: district.pinColor,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
