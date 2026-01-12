import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../services/api';
import { Package, Zap, Sparkles, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      
      let effectText = `Used ${userItem.item.name}!`;
      if (response.data.effect) {
        if (response.data.effect.bonusAura) {
          effectText += ` +${response.data.effect.bonusAura} Aura`;
        }
        if (response.data.effect.bonusMoney) {
          effectText += ` +$${response.data.effect.bonusMoney}`;
        }
      }
      
      setMessage({ type: 'success', text: effectText });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to use item',
      });
    } finally {
      setUsing(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CONSUMABLE':
        return <Zap className="w-5 h-5" />;
      case 'COSMETIC':
        return <Sparkles className="w-5 h-5" />;
      case 'UPGRADE':
        return <Package className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CONSUMABLE':
        return 'text-primary bg-primary/20';
      case 'COSMETIC':
        return 'text-secondary-foreground bg-secondary';
      case 'UPGRADE':
        return 'text-primary bg-primary/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary text-xl">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Package className="w-8 h-8 text-primary" />
          Inventory
        </h1>
        <p className="text-muted-foreground mt-2">
          View and use your items
        </p>
      </div>

      {/* Message */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={cn(
          message.type === 'success' && 'border-primary/50 bg-primary/10'
        )}>
          {message.type === 'success' ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <X className="w-4 h-4" />
          )}
          <AlertDescription className={cn(
            message.type === 'success' && 'text-primary'
          )}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Items Grid */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="text-xl mb-2">Inventory Empty</CardTitle>
              <CardDescription>Visit the marketplace to buy items!</CardDescription>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((userItem) => (
            <Card key={userItem.id} className="overflow-hidden">
              {/* Item Header */}
              <div className="h-24 bg-muted flex items-center justify-center">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center",
                  getTypeColor(userItem.item.type)
                )}>
                  {getTypeIcon(userItem.item.type)}
                </div>
              </div>

              {/* Item Info */}
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg">{userItem.item.name}</CardTitle>
                  <Badge variant="secondary" className={getTypeColor(userItem.item.type)}>
                    {userItem.item.type}
                  </Badge>
                </div>

                <CardDescription className="mb-4">
                  {userItem.item.description}
                </CardDescription>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    Acquired {new Date(userItem.acquiredAt).toLocaleDateString()}
                  </span>
                  <Badge variant="outline">
                    x{userItem.quantity}
                  </Badge>
                </div>

                {userItem.item.type === 'CONSUMABLE' && (
                  <Button
                    onClick={() => handleUseItem(userItem)}
                    disabled={using === userItem.id}
                    className="w-full"
                  >
                    {using === userItem.id ? 'Using...' : 'Use Item'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
