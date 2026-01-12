import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../services/api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Item {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
  price: number;
  auraCost: number;
  imageUrl?: string;
  effect?: string;
}

const typeLabels: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

export default function Marketplace() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchItems();
  }, [filter]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { type: filter } : {};
      const response = await marketplaceApi.getItems(params);
      setItems(response.data.items);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (item: Item) => {
    if (purchasing) return;
    
    try {
      setPurchasing(item.id);
      setMessage(null);
      
      await marketplaceApi.purchase({ itemId: item.id });
      await refreshUser();
      
      setMessage({ type: 'success', text: `${item.name} acheté` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'achat',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const canAfford = (item: Item) => {
    return (user?.money || 0) >= item.price && (user?.aura || 0) >= item.auraCost;
  };

  const filters = ['all', 'CONSUMABLE', 'COSMETIC', 'UPGRADE'];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Acheter
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Marché
            </h1>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            <div>{user?.aura.toLocaleString()} aura</div>
            <div>${user?.money.toLocaleString()}</div>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <p className={cn(
          "text-sm",
          message.type === 'success' ? 'text-foreground' : 'text-destructive'
        )}>
          {message.text}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 text-sm border transition-colors",
              filter === f
                ? "border-foreground text-foreground"
                : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {f === 'all' ? 'Tout' : typeLabels[f]}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Items */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Aucun article disponible
        </p>
      ) : (
        <div className="space-y-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-medium">{item.name}</h2>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {typeLabels[item.type]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground max-w-md">
                  {item.description}
                </p>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right text-sm tabular-nums text-muted-foreground">
                  {item.price > 0 && <div>${item.price}</div>}
                  {item.auraCost > 0 && <div>{item.auraCost} aura</div>}
                </div>
                
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={!canAfford(item) || purchasing === item.id}
                  className={cn(
                    "px-4 py-2 text-sm border transition-colors",
                    canAfford(item)
                      ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                      : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                  )}
                >
                  {purchasing === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : canAfford(item) ? (
                    'Acheter'
                  ) : (
                    'Insuffisant'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
