import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi } from '../services/api';
import { Package, Zap, Sparkles, Check, X } from 'lucide-react';

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
        return 'text-accent-orange bg-accent-orange/20';
      case 'COSMETIC':
        return 'text-accent-pink bg-accent-pink/20';
      case 'UPGRADE':
        return 'text-accent-cyan bg-accent-cyan/20';
      default:
        return 'text-gray-400 bg-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary text-xl font-display">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-3">
          <Package className="w-8 h-8 text-accent-cyan" />
          Inventory
        </h1>
        <p className="text-gray-400 mt-2">
          View and use your items
        </p>
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

      {/* Items Grid */}
      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-400 mb-2">Inventory Empty</h2>
          <p className="text-gray-500">Visit the marketplace to buy items!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((userItem) => (
            <div key={userItem.id} className="card overflow-hidden">
              {/* Item Header */}
              <div className="h-24 bg-gradient-to-br from-surface to-background flex items-center justify-center">
                <div className={`w-14 h-14 rounded-xl ${getTypeColor(userItem.item.type)} flex items-center justify-center`}>
                  {getTypeIcon(userItem.item.type)}
                </div>
              </div>

              {/* Item Info */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">{userItem.item.name}</h3>
                  <span className={`badge ${getTypeColor(userItem.item.type)}`}>
                    {userItem.item.type}
                  </span>
                </div>

                <p className="text-gray-400 text-sm mb-4">
                  {userItem.item.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500">
                    Acquired {new Date(userItem.acquiredAt).toLocaleDateString()}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-light font-mono">
                    x{userItem.quantity}
                  </span>
                </div>

                {userItem.item.type === 'CONSUMABLE' && (
                  <button
                    onClick={() => handleUseItem(userItem)}
                    disabled={using === userItem.id}
                    className="btn-primary w-full"
                  >
                    {using === userItem.id ? 'Using...' : 'Use Item'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
