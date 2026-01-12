import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../services/api';
import {
  ShoppingBag,
  Package,
  Sparkles as SparklesIcon,
  Zap,
  Filter,
  Check,
  X,
  Coins,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
      
      setMessage({ type: 'success', text: `Successfully purchased ${item.name}!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to purchase item',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CONSUMABLE':
        return <Zap className="w-5 h-5" />;
      case 'COSMETIC':
        return <SparklesIcon className="w-5 h-5" />;
      case 'UPGRADE':
        return <Package className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CONSUMABLE':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'COSMETIC':
        return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
      case 'UPGRADE':
        return 'bg-primary/20 text-primary border-primary/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const canAfford = (item: Item) => {
    return (user?.money || 0) >= item.price && (user?.aura || 0) >= item.auraCost;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-primary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground mt-2">
            Buy items, cosmetics, and upgrades
          </p>
        </div>
        
        {/* Balance Display */}
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-2 px-4 py-2 bg-primary/10 border-primary/30">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">
              {user?.aura.toLocaleString()}
            </span>
          </Badge>
          <Badge variant="outline" className="gap-2 px-4 py-2 bg-primary/10 border-primary/30">
            <Coins className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">
              ${user?.money.toLocaleString()}
            </span>
          </Badge>
        </div>
      </div>

      {/* Message */}
      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          {message.type === 'success' ? (
            <Check className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="CONSUMABLE">Consumable</TabsTrigger>
          <TabsTrigger value="COSMETIC">Cosmetic</TabsTrigger>
          <TabsTrigger value="UPGRADE">Upgrade</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-muted-foreground mb-2">No Items Available</h2>
            <p className="text-muted-foreground">Check back later for new items!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden group">
              {/* Item Image/Icon */}
              <div className="h-32 bg-gradient-to-br from-muted to-background flex items-center justify-center">
                <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center border", getTypeColor(item.type))}>
                  {getTypeIcon(item.type)}
                </div>
              </div>

              {/* Item Info */}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge variant="outline" className={getTypeColor(item.type)}>
                    {item.type}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {item.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {/* Price */}
                <div className="flex items-center gap-4 mb-4">
                  {item.price > 0 && (
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-primary">
                        ${item.price}
                      </span>
                    </div>
                  )}
                  {item.auraCost > 0 && (
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-primary">
                        {item.auraCost}
                      </span>
                    </div>
                  )}
                </div>

                {/* Buy Button */}
                <Button
                  onClick={() => handlePurchase(item)}
                  disabled={!canAfford(item) || purchasing === item.id}
                  className="w-full"
                  variant={canAfford(item) ? 'default' : 'secondary'}
                >
                  {purchasing === item.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Purchasing...
                    </>
                  ) : canAfford(item) ? (
                    'Buy Now'
                  ) : (
                    'Insufficient Funds'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
