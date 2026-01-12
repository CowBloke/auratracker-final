import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../services/api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserItem {
  id: string;
  quantity: number;
  acquiredAt: string;
  item: {
    id: string;
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
    effect?: string;
  };
}

const typeLabels: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

export default function Inventory() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await marketplaceApi.getInventory(user!.id);
      setItems(response.data.items);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseItem = async (userItem: UserItem) => {
    if (using) return;
    
    try {
      setUsing(userItem.id);
      setMessage(null);
      
      const response = await marketplaceApi.useItem(userItem.id);
      await refreshUser();
      await fetchInventory();
      
      let effectText = `${userItem.item.name} utilisé`;
      if (response.data.effect) {
        if (response.data.effect.bonusAura) {
          effectText += ` → +${response.data.effect.bonusAura} aura`;
        }
        if (response.data.effect.bonusMoney) {
          effectText += ` → +$${response.data.effect.bonusMoney}`;
        }
      }
      
      setMessage({ type: 'success', text: effectText });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec',
      });
    } finally {
      setUsing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Objets
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Inventaire
        </h1>
        <p className="text-muted-foreground">
          {items.length} objet{items.length !== 1 ? 's' : ''}
        </p>
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

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Items */}
      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Inventaire vide
        </p>
      ) : (
        <div className="space-y-0">
          {items.map((userItem) => (
            <div
              key={userItem.id}
              className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-medium">{userItem.item.name}</h2>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {typeLabels[userItem.item.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ×{userItem.quantity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground max-w-md">
                  {userItem.item.description}
                </p>
              </div>
              
              {userItem.item.type === 'CONSUMABLE' && (
                <button
                  onClick={() => handleUseItem(userItem)}
                  disabled={using === userItem.id}
                  className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                >
                  {using === userItem.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Utiliser'
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
