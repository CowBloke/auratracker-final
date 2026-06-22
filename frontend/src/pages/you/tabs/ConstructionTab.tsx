import { useEffect, useMemo, useState } from 'react';
import { Building2, Hammer, Loader2, Wallet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { type YouResourceActionState, type YouSupplyResourceType, youApi } from '@/services/api';
import { SectionTitle } from '../components/YouPrimitives';

type ResourceStockItem = {
  resourceType: YouSupplyResourceType;
  quantity: number;
};

function formatMoney(value: number) {
  return value.toLocaleString('fr-FR');
}

function buildDefaultBusinessName(label: string, existingCount: number) {
  return `${label} ${existingCount + 1}`;
}

export function ConstructionTab({ onReload }: { onReload: () => Promise<void> }) {
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<YouResourceActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingTypeKey, setBuildingTypeKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await youApi.getResourceActionState();
        if (mounted) {
          setState(response.data);
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.error || "Impossible de charger l'onglet Construction.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const ownedBusinesses = useMemo(
    () => (state?.businesses ?? []).filter((business) => business.ownerId === user?.id),
    [state, user?.id],
  );

  const stock = useMemo<ResourceStockItem[]>(() => {
    const totals = new Map<YouSupplyResourceType, number>();
    for (const business of ownedBusinesses) {
      for (const inventory of business.inventories) {
        totals.set(inventory.resourceType, (totals.get(inventory.resourceType) ?? 0) + inventory.quantity);
      }
    }

    return Array.from(totals.entries())
      .map(([resourceType, quantity]) => ({ resourceType, quantity }))
      .sort((a, b) => {
        const labelA = RESOURCE_META[a.resourceType as ResourceType]?.label ?? a.resourceType;
        const labelB = RESOURCE_META[b.resourceType as ResourceType]?.label ?? b.resourceType;
        return labelA.localeCompare(labelB, 'fr');
      });
  }, [ownedBusinesses]);

  const stockByResource = useMemo(
    () => new Map(stock.map((entry) => [entry.resourceType, entry.quantity])),
    [stock],
  );

  const existingCountByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const business of ownedBusinesses) {
      counts.set(business.typeKey, (counts.get(business.typeKey) ?? 0) + 1);
    }
    return counts;
  }, [ownedBusinesses]);

  async function handleBuild(typeKey: string, label: string, description: string, minCapital: number) {
    setBuildingTypeKey(typeKey);
    try {
      await youApi.createConstructionBusiness({
        typeKey,
        name: buildDefaultBusinessName(label, existingCountByType.get(typeKey) ?? 0),
        description,
        capital: minCapital,
      });
      await Promise.all([onReload(), refreshUser()]);
      const response = await youApi.getResourceActionState();
      setState(response.data);
      toast.success('Entreprise creee et chantier lance.');
    } catch (error: any) {
      const code = error?.response?.data?.error ?? '';
      if (typeof code === 'string' && code.startsWith('INSUFFICIENT_INVENTORY_')) {
        const resourceType = code.replace('INSUFFICIENT_INVENTORY_', '') as ResourceType;
        const label = RESOURCE_META[resourceType]?.label ?? resourceType;
        toast.error(`Stock insuffisant pour ${label}.`);
      } else {
        toast.error(code || 'Impossible de lancer cette construction.');
      }
    } finally {
      setBuildingTypeKey(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Chargement de la construction...</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-3">
        <SectionTitle>Mon stock de ressources</SectionTitle>
        {stock.length === 0 ? (
          <Card>
            <CardContent className="px-5 py-8 text-sm text-muted-foreground">
              Aucune ressource stockee pour le moment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stock.map((entry) => {
              const meta = RESOURCE_META[entry.resourceType as ResourceType];
              const Icon = meta?.Icon ?? Building2;
              return (
                <Card key={entry.resourceType} className="overflow-hidden">
                  <CardContent className="flex items-center gap-4 px-5 py-4">
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', meta?.bg ?? 'bg-muted')}>
                      <Icon className={cn('h-5 w-5', meta?.iconColor ?? 'text-foreground')} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{meta?.label ?? entry.resourceType}</p>
                      <p className="text-xs text-muted-foreground">{meta?.description ?? 'Ressource de construction.'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Disponible</p>
                      <p className="text-lg font-black tabular-nums text-foreground">{entry.quantity}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Entreprises disponibles a construire</SectionTitle>
        <div className="grid gap-4">
          {(state?.constructionCatalog ?? []).map((company) => {
            const missing = company.materials
              .map((material) => {
                const available = stockByResource.get(material.resourceType) ?? 0;
                return {
                  ...material,
                  available,
                  missing: Math.max(0, material.quantity - available),
                };
              })
              .filter((material) => material.missing > 0);
            const missingMoney = Math.max(0, company.totalMoneyCost - (user?.money ?? 0));
            const canBuild = missing.length === 0 && missingMoney === 0 && buildingTypeKey === null;

            return (
              <Card key={company.typeKey} className="overflow-hidden border-border/60">
                <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl text-foreground">{company.label}</CardTitle>
                      <p className="text-sm text-muted-foreground">{company.category}</p>
                      <p className="text-sm text-muted-foreground">{company.description}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                      <Wallet className="h-4 w-4" />
                      {company.totalMoneyCost > 0 ? `${formatMoney(company.totalMoneyCost)}€` : 'Sans cout financier'}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 px-5 py-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ressources requises</p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {company.materials.map((material) => {
                        const meta = RESOURCE_META[material.resourceType as ResourceType];
                        const Icon = meta?.Icon ?? Building2;
                        const available = stockByResource.get(material.resourceType) ?? 0;
                        const isMissing = available < material.quantity;
                        return (
                          <div
                            key={`${company.typeKey}-${material.resourceType}`}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border px-3 py-3',
                              isMissing ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5',
                            )}
                          >
                            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta?.bg ?? 'bg-muted')}>
                              <Icon className={cn('h-4 w-4', meta?.iconColor ?? 'text-foreground')} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{meta?.label ?? material.resourceType}</p>
                              <p className={cn('text-xs font-medium', isMissing ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                                {available} / {material.quantity}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1 text-sm">
                      {missing.length > 0 ? (
                        <p className="text-red-500">
                          Il manque{' '}
                          {missing
                            .map((material) => {
                              const label = RESOURCE_META[material.resourceType as ResourceType]?.label ?? material.resourceType;
                              return `${material.missing} ${label}`;
                            })
                            .join(', ')}
                          .
                        </p>
                      ) : (
                        <p className="text-emerald-600 dark:text-emerald-400">Toutes les ressources sont disponibles.</p>
                      )}
                      {missingMoney > 0 ? (
                        <p className="text-red-500">Il manque {formatMoney(missingMoney)}€ pour lancer cette construction.</p>
                      ) : company.totalMoneyCost > 0 ? (
                        <p className="text-muted-foreground">Cout total: {formatMoney(company.totalMoneyCost)}€.</p>
                      ) : null}
                    </div>

                    <Button
                      onClick={() => void handleBuild(company.typeKey, company.label, company.description, company.minCapital)}
                      disabled={!canBuild}
                      className="min-w-[160px]"
                    >
                      {buildingTypeKey === company.typeKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Construction...
                        </>
                      ) : (
                        <>
                          <Hammer className="mr-2 h-4 w-4" />
                          Construire
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
