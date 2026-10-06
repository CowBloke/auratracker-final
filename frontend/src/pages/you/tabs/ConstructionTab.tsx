import { useEffect, useMemo, useState } from 'react';
import { Building2, Hammer, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { type YouResourceActionState, type YouSupplyResourceType, youApi } from '@/services/api';

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
      toast.success('Entreprise créée et chantier lance.');
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
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Chargement de la construction...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mon stock de ressources</h2>
        {stock.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyDescription>Aucune ressource stockée pour le moment.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stock.map((entry) => {
              const meta = RESOURCE_META[entry.resourceType as ResourceType];
              const Icon = meta?.Icon ?? Building2;
              return (
                <Item key={entry.resourceType} variant="outline">
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{meta?.label ?? entry.resourceType}</ItemTitle>
                    <ItemDescription>{meta?.description ?? 'Ressource de construction.'}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-lg font-semibold tabular-nums">{entry.quantity}</span>
                  </ItemActions>
                </Item>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Entreprises disponibles à construire</h2>
        <div className="grid gap-4">
          {(state?.constructionCatalog ?? []).map((company) => {
            const missing = company.materials
              .map((material) => {
                const available = stockByResource.get(material.resourceType) ?? 0;
                return { ...material, available, missing: Math.max(0, material.quantity - available) };
              })
              .filter((material) => material.missing > 0);
            const missingMoney = Math.max(0, company.totalMoneyCost - (user?.money ?? 0));
            const canBuild = missing.length === 0 && missingMoney === 0 && buildingTypeKey === null;

            return (
              <Card key={company.typeKey}>
                <CardHeader>
                  <CardTitle>{company.label}</CardTitle>
                  <CardDescription>
                    {company.category} · {company.description}
                  </CardDescription>
                  <CardAction>
                    <Badge variant="warning">
                      <Wallet />
                      {company.totalMoneyCost > 0 ? `${formatMoney(company.totalMoneyCost)}€` : 'Sans coût financier'}
                    </Badge>
                  </CardAction>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-muted-foreground">Ressources requises</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {company.materials.map((material) => {
                      const meta = RESOURCE_META[material.resourceType as ResourceType];
                      const Icon = meta?.Icon ?? Building2;
                      const available = stockByResource.get(material.resourceType) ?? 0;
                      const isMissing = available < material.quantity;
                      return (
                        <Item key={`${company.typeKey}-${material.resourceType}`} variant="outline" size="sm">
                          <ItemMedia variant="icon">
                            <Icon />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>{meta?.label ?? material.resourceType}</ItemTitle>
                          </ItemContent>
                          <ItemActions>
                            <Badge variant={isMissing ? 'destructive' : 'success'} className="tabular-nums">
                              {available} / {material.quantity}
                            </Badge>
                          </ItemActions>
                        </Item>
                      );
                    })}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-1 text-sm">
                    {missing.length > 0 ? (
                      <p className="text-destructive">
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
                      <p className="text-success">Toutes les ressources sont disponibles.</p>
                    )}
                    {missingMoney > 0 ? (
                      <p className="text-destructive">Il manque {formatMoney(missingMoney)}€ pour lancer cette construction.</p>
                    ) : company.totalMoneyCost > 0 ? (
                      <p className="text-muted-foreground">Coût total : {formatMoney(company.totalMoneyCost)}€.</p>
                    ) : null}
                  </div>

                  <Button
                    onClick={() => void handleBuild(company.typeKey, company.label, company.description, company.minCapital)}
                    disabled={!canBuild}
                  >
                    {buildingTypeKey === company.typeKey ? (
                      <>
                        <Spinner />
                        Construction...
                      </>
                    ) : (
                      <>
                        <Hammer />
                        Construire
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
