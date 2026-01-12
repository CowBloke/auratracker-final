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
} from 'lucide-react';

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
        return 'text-accent-orange bg-accent-orange/20';
      case 'COSMETIC':
        return 'text-accent-pink bg-accent-pink/20';
      case 'UPGRADE':
        return 'text-accent-cyan bg-accent-cyan/20';
      default:
        return 'text-gray-400 bg-gray-700';
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
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-money" />
            Marketplace
          </h1>
          <p className="text-gray-400 mt-2">
            Buy items, cosmetics, and upgrades
          </p>
        </div>
        
        {/* Balance Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aura/10 border border-aura/30">
            <Sparkles className="w-5 h-5 text-aura-light" />
            <span className="font-mono font-semibold text-aura-light">
              {user?.aura.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-money/10 border border-money/30">
            <Coins className="w-5 h-5 text-money-light" />
            <span className="font-mono font-semibold text-money-light">
              ${user?.money.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-accent-green/10 border border-accent-green/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5 text-accent-green" />
          ) : (
            <X className="w-5 h-5 text-red-400" />
          )}
          <span className={message.type === 'success' ? 'text-accent-green' : 'text-red-400'}>
            {message.text}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-5 h-5 text-gray-400" />
        {['all', 'CONSUMABLE', 'COSMETIC', 'UPGRADE'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === type
                ? 'bg-primary text-white'
                : 'bg-surface hover:bg-surface-hover text-gray-400'
            }`}
          >
            {type === 'all' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-primary text-xl font-display">
            Loading...
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-400 mb-2">No Items Available</h2>
          <p className="text-gray-500">Check back later for new items!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="card overflow-hidden group">
              {/* Item Image/Icon */}
              <div className="h-32 bg-gradient-to-br from-surface to-background flex items-center justify-center">
                <div className={`w-16 h-16 rounded-xl ${getTypeColor(item.type)} flex items-center justify-center`}>
                  {getTypeIcon(item.type)}
                </div>
              </div>

              {/* Item Info */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">{item.name}</h3>
                  <span className={`badge ${getTypeColor(item.type)}`}>
                    {item.type}
                  </span>
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {item.description}
                </p>

                {/* Price */}
                <div className="flex items-center gap-4 mb-4">
                  {item.price > 0 && (
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-money" />
                      <span className="font-mono font-semibold text-money-light">
                        ${item.price}
                      </span>
                    </div>
                  )}
                  {item.auraCost > 0 && (
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-aura" />
                      <span className="font-mono font-semibold text-aura-light">
                        {item.auraCost}
                      </span>
                    </div>
                  )}
                </div>

                {/* Buy Button */}
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={!canAfford(item) || purchasing === item.id}
                  className={`w-full py-2 rounded-lg font-medium transition-all ${
                    canAfford(item)
                      ? 'btn-primary'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {purchasing === item.id
                    ? 'Purchasing...'
                    : canAfford(item)
                    ? 'Buy Now'
                    : 'Insufficient Funds'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
