import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { adminApi, AdminUser, ShopItem, BugReport, PendingUser, AdminInventoryItem } from '../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, Save, MessageSquareX, AlertTriangle, Plus, Package, Edit2, X, Bug, Check, UserPlus, UserX } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Effect types for items
const EFFECT_TYPES = [
  { value: 'USERNAME_COLOR', label: 'Couleur de pseudo', description: 'Permet de choisir une couleur pour le pseudo dans le chat' },
  { value: 'PROFILE_PICTURE', label: 'Photo de profil', description: 'Permet de téléverser une photo affichée dans le chat' },
  { value: 'BONUS_AURA', label: 'Bonus Aura', description: 'Donne un bonus d\'aura à l\'utilisation' },
  { value: 'BONUS_MONEY', label: 'Bonus Argent', description: 'Donne un bonus d\'argent à l\'utilisation' },
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

interface ItemFormData {
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
  price: number;
  auraCost: number;
  imageUrl: string;
  effectType: string;
  effectValue: string;
}

const defaultItemForm: ItemFormData = {
  name: '',
  description: '',
  type: 'COSMETIC',
  price: 0,
  auraCost: 0,
  imageUrl: '',
  effectType: 'USERNAME_COLOR',
  effectValue: '',
};

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ aura: number; money: number; dailyAuraLimit: number }>({ aura: 0, money: 0, dailyAuraLimit: 50 });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearingChat, setClearingChat] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryUser, setInventoryUser] = useState<AdminUser | null>(null);
  const [inventoryItems, setInventoryItems] = useState<AdminInventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryQuantities, setInventoryQuantities] = useState<Record<string, number>>({});
  const [inventoryAddItemId, setInventoryAddItemId] = useState<string>('');
  const [inventoryAddQuantity, setInventoryAddQuantity] = useState(1);
  const [addingInventoryItem, setAddingInventoryItem] = useState(false);
  const [updatingInventoryItem, setUpdatingInventoryItem] = useState<string | null>(null);
  const [removingInventoryItem, setRemovingInventoryItem] = useState<string | null>(null);

  // Items state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  // Bug reports state
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [updatingBug, setUpdatingBug] = useState<string | null>(null);
  const [deletingBug, setDeletingBug] = useState<string | null>(null);

  // Pending users state
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [rejectingUser, setRejectingUser] = useState<string | null>(null);

  // Redirect non-admin users
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchUsers();
    fetchItems();
    fetchBugReports();
    fetchPendingUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await adminApi.getUsers();
      setUsers(res.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      showMessage('error', 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await adminApi.getItems();
      setItems(res.data.items);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      showMessage('error', 'Erreur lors du chargement des objets');
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchBugReports = async () => {
    try {
      setLoadingBugs(true);
      const res = await adminApi.getBugReports();
      setBugReports(res.data.bugReports);
    } catch (error) {
      console.error('Failed to fetch bug reports:', error);
      showMessage('error', 'Erreur lors du chargement des bugs');
    } finally {
      setLoadingBugs(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      setLoadingPending(true);
      const res = await adminApi.getPendingUsers();
      setPendingUsers(res.data.pendingUsers);
    } catch (error) {
      console.error('Failed to fetch pending users:', error);
      showMessage('error', 'Erreur lors du chargement des demandes');
    } finally {
      setLoadingPending(false);
    }
  };

  const approveUser = async (id: string) => {
    setApprovingUser(id);
    try {
      await adminApi.approveUser(id);
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      showMessage('success', 'Utilisateur approuvé');
      // Refresh users list to include newly approved user
      fetchUsers();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setApprovingUser(null);
    }
  };

  const rejectUser = async (id: string) => {
    setRejectingUser(id);
    try {
      await adminApi.rejectUser(id);
      setPendingUsers(prev => prev.filter(u => u.id !== id));
      showMessage('success', 'Demande rejetée');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setRejectingUser(null);
    }
  };

  const toggleBugStatus = async (bug: BugReport) => {
    setUpdatingBug(bug.id);
    try {
      const newStatus = bug.status === 'PENDING' ? 'DONE' : 'PENDING';
      const res = await adminApi.updateBugReport(bug.id, { status: newStatus });
      setBugReports(prev => prev.map(b => b.id === bug.id ? res.data.bugReport : b));
      showMessage('success', newStatus === 'DONE' ? 'Bug marqué comme résolu' : 'Bug marqué comme en attente');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingBug(null);
    }
  };

  const deleteBug = async (id: string) => {
    setDeletingBug(id);
    try {
      await adminApi.deleteBugReport(id);
      setBugReports(prev => prev.filter(b => b.id !== id));
      showMessage('success', 'Rapport de bug supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeletingBug(null);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Parse effect string to get type and value
  const parseEffect = (effectStr: string | null): { type: string; value: string } => {
    if (!effectStr) return { type: 'USERNAME_COLOR', value: '' };
    try {
      const effect = JSON.parse(effectStr);
      return { type: effect.type || 'USERNAME_COLOR', value: effect.value || '' };
    } catch {
      return { type: 'USERNAME_COLOR', value: '' };
    }
  };

  // Open dialog for creating new item
  const openCreateItemDialog = () => {
    setEditingItem(null);
    setItemForm(defaultItemForm);
    setItemDialogOpen(true);
  };

  // Open dialog for editing item
  const openEditItemDialog = (item: ShopItem) => {
    setEditingItem(item);
    const { type: effectType, value: effectValue } = parseEffect(item.effect);
    setItemForm({
      name: item.name,
      description: item.description,
      type: item.type,
      price: item.price,
      auraCost: item.auraCost,
      imageUrl: item.imageUrl || '',
      effectType,
      effectValue,
    });
    setItemDialogOpen(true);
  };

  // Save item (create or update)
  const saveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.description.trim()) {
      showMessage('error', 'Nom et description requis');
      return;
    }

    setSavingItem(true);
    try {
      // Build effect JSON
      const effect = JSON.stringify({
        type: itemForm.effectType,
        value: itemForm.effectValue,
      });

      const data = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        type: itemForm.type,
        price: itemForm.price,
        auraCost: itemForm.auraCost,
        imageUrl: itemForm.imageUrl.trim() || undefined,
        effect,
      };

      if (editingItem) {
        const res = await adminApi.updateItem(editingItem.id, data);
        setItems(prev => prev.map(i => i.id === editingItem.id ? res.data.item : i));
        showMessage('success', 'Objet modifié');
      } else {
        const res = await adminApi.createItem(data);
        setItems(prev => [res.data.item, ...prev]);
        showMessage('success', 'Objet créé');
      }
      setItemDialogOpen(false);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSavingItem(false);
    }
  };

  // Delete item
  const deleteItem = async (id: string) => {
    setDeletingItem(id);
    try {
      await adminApi.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      showMessage('success', 'Objet supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeletingItem(null);
    }
  };

  const startEditing = (u: AdminUser) => {
    setEditingUser(u.id);
    setEditValues({
      aura: u.aura,
      money: u.money,
      dailyAuraLimit: u.dailyAuraLimit,
    });
  };

  const cancelEditing = () => {
    setEditingUser(null);
  };

  const saveUser = async (id: string) => {
    setSaving(true);
    try {
      const res = await adminApi.updateUser(id, editValues);
      setUsers(prev => prev.map(u => u.id === id ? res.data.user : u));
      setEditingUser(null);
      showMessage('success', 'Utilisateur mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: string) => {
    setDeleting(id);
    try {
      await adminApi.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showMessage('success', 'Utilisateur supprimé');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setDeleting(null);
    }
  };

  const clearChat = async () => {
    setClearingChat(true);
    try {
      const res = await adminApi.clearChat();
      showMessage('success', res.data.message);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setClearingChat(false);
    }
  };

  const openInventory = (u: AdminUser) => {
    setInventoryUser(u);
    setInventoryDialogOpen(true);
    setInventoryAddQuantity(1);
    setInventoryAddItemId(items[0]?.id || '');
    fetchUserInventory(u.id);
  };

  const closeInventory = () => {
    setInventoryDialogOpen(false);
    setInventoryUser(null);
    setInventoryItems([]);
    setInventoryQuantities({});
    setInventoryAddItemId('');
  };

  const fetchUserInventory = async (userId: string) => {
    try {
      setLoadingInventory(true);
      const res = await adminApi.getUserInventory(userId);
      setInventoryItems(res.data.items);
      setInventoryQuantities(res.data.items.reduce((acc, item) => {
        acc[item.id] = item.quantity;
        return acc;
      }, {} as Record<string, number>));
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      showMessage('error', 'Erreur lors du chargement de l\'inventaire');
    } finally {
      setLoadingInventory(false);
    }
  };

  const addInventoryItem = async () => {
    if (!inventoryUser || !inventoryAddItemId) {
      showMessage('error', 'Sélectionnez un objet');
      return;
    }
    if (inventoryAddQuantity <= 0) {
      showMessage('error', 'Quantité invalide');
      return;
    }

    try {
      setAddingInventoryItem(true);
      const res = await adminApi.addUserInventoryItem(inventoryUser.id, {
        itemId: inventoryAddItemId,
        quantity: inventoryAddQuantity,
      });
      setInventoryItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.item.id === inventoryAddItemId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = res.data.item;
          return updated;
        }
        return [res.data.item, ...prev];
      });
      setInventoryQuantities((prev) => ({
        ...prev,
        [res.data.item.id]: res.data.item.quantity,
      }));
      showMessage('success', 'Objet ajouté');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setAddingInventoryItem(false);
    }
  };

  const updateInventoryQuantity = async (userItemId: string) => {
    if (!inventoryUser) return;
    const nextQuantity = inventoryQuantities[userItemId];
    if (nextQuantity === undefined) return;

    try {
      setUpdatingInventoryItem(userItemId);
      const res = await adminApi.updateUserInventoryItem(inventoryUser.id, userItemId, {
        quantity: nextQuantity,
      });
      if (res.data.removed) {
        setInventoryItems((prev) => prev.filter((item) => item.id !== userItemId));
        setInventoryQuantities((prev) => {
          const { [userItemId]: _removed, ...rest } = prev;
          return rest;
        });
      } else if (res.data.item) {
        setInventoryItems((prev) => prev.map((item) => item.id === userItemId ? res.data.item! : item));
        setInventoryQuantities((prev) => ({
          ...prev,
          [userItemId]: res.data.item!.quantity,
        }));
      }
      showMessage('success', 'Inventaire mis à jour');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setUpdatingInventoryItem(null);
    }
  };

  const removeInventoryItem = async (userItemId: string) => {
    if (!inventoryUser) return;
    try {
      setRemovingInventoryItem(userItemId);
      await adminApi.deleteUserInventoryItem(inventoryUser.id, userItemId);
      setInventoryItems((prev) => prev.filter((item) => item.id !== userItemId));
      setInventoryQuantities((prev) => {
        const { [userItemId]: _removed, ...rest } = prev;
        return rest;
      });
      showMessage('success', 'Objet retiré');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Erreur');
    } finally {
      setRemovingInventoryItem(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Panel
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Administration
            </h1>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={cn(
          "px-4 py-3 border",
          message.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive'
        )}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-8">
        <TabsList className="bg-transparent border border-border/30 p-1">
          <TabsTrigger 
            value="pending"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Demandes
            {pendingUsers.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="users"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger 
            value="items"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Objets
          </TabsTrigger>
          <TabsTrigger 
            value="chat"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Chat
          </TabsTrigger>
          <TabsTrigger 
            value="bugs"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Bugs
            {bugReports.filter(b => b.status === 'PENDING').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-destructive/20 text-destructive rounded">
                {bugReports.filter(b => b.status === 'PENDING').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Users Tab */}
        <TabsContent value="pending" className="space-y-6">
          <div className="h-px bg-border" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Demandes d'inscription en attente
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4" />
              <span>{pendingUsers.length} en attente</span>
            </div>
          </div>

          {loadingPending ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Aucune demande en attente
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="py-4 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{u.username}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          En attente
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {u.email}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Demandé le {new Date(u.createdAt).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveUser(u.id)}
                        disabled={approvingUser === u.id}
                        className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10"
                      >
                        {approvingUser === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Approuver
                          </>
                        )}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                            disabled={rejectingUser === u.id}
                          >
                            {rejectingUser === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserX className="h-4 w-4 mr-1" />
                                Rejeter
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Rejeter la demande de {u.username} ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              L'utilisateur devra créer un nouveau compte s'il souhaite réessayer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => rejectUser(u.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Rejeter
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="h-px bg-border" />
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun utilisateur
            </p>
          ) : (
            <div className="space-y-0">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    "py-4 border-b border-border/30 last:border-0",
                    u.isAdmin && "bg-muted/20 -mx-4 px-4"
                  )}
                >
                  {editingUser === u.id ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{u.username}</span>
                          {u.isAdmin && (
                            <span className="ml-2 text-xs text-amber-500">admin</span>
                          )}
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            className="h-8 border-border/50"
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveUser(u.id)}
                            disabled={saving}
                            className="h-8"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Aura</label>
                          <Input
                            type="number"
                            value={editValues.aura}
                            onChange={(e) => setEditValues(prev => ({ ...prev, aura: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Argent</label>
                          <Input
                            type="number"
                            value={editValues.money}
                            onChange={(e) => setEditValues(prev => ({ ...prev, money: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Limite aura/jour</label>
                          <Input
                            type="number"
                            value={editValues.dailyAuraLimit}
                            onChange={(e) => setEditValues(prev => ({ ...prev, dailyAuraLimit: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                            min={0}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{u.username}</span>
                            {u.isAdmin && (
                              <span className="text-xs text-amber-500">admin</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="text-right">
                            <p className="tabular-nums">{u.aura.toLocaleString()} aura</p>
                          </div>
                          <div className="text-right">
                            <p className="tabular-nums">${u.money.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="tabular-nums">{u.dailyAuraGiven}/{u.dailyAuraLimit} donné</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(u)}
                            className="h-8 border-border/50"
                          >
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInventory(u)}
                            className="h-8 border-border/50"
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Inventaire
                          </Button>
                          
                          {!u.isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                                  disabled={deleting === u.id}
                                >
                                  {deleting === u.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Supprimer {u.username} ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. Toutes les données de l'utilisateur seront définitivement supprimées (messages, transferts, statistiques, inventaire, etc.).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser(u.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-6">
          <div className="h-px bg-border" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Gestion des objets de la boutique
            </h2>
            <Button
              onClick={openCreateItemDialog}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvel objet
            </Button>
          </div>

          {loadingItems ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun objet créé
            </p>
          ) : (
            <div className="space-y-0">
              {items.map((item) => {
                const { type: effectType } = parseEffect(item.effect);
                const effectLabel = EFFECT_TYPES.find(e => e.value === effectType)?.label || effectType;
                
                return (
                  <div
                    key={item.id}
                    className="py-4 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">
                              {item.type}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            Effet: {effectLabel}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right text-sm text-muted-foreground">
                          <p className="tabular-nums">${item.price}</p>
                          {item.auraCost > 0 && (
                            <p className="tabular-nums text-xs">{item.auraCost} aura</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditItemDialog(item)}
                            className="h-8 border-border/50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                                disabled={deletingItem === item.id}
                              >
                                {deletingItem === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Supprimer {item.name} ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  L'objet sera supprimé de la boutique. Les utilisateurs qui le possèdent le garderont.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteItem(item.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-6">
          <div className="h-px bg-border" />
          
          <section className="space-y-6">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Gestion du chat
            </h2>
            
            <div className="p-6 border border-border/30 space-y-4">
              <div className="flex items-start gap-4">
                <MessageSquareX className="h-8 w-8 text-muted-foreground shrink-0 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-medium">Vider le chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Supprime définitivement tous les messages du chat global. Cette action est irréversible.
                  </p>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    disabled={clearingChat}
                  >
                    {clearingChat ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Vider le chat
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Vider le chat ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Tous les messages du chat seront définitivement supprimés. Cette action ne peut pas être annulée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={clearChat}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Vider le chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </TabsContent>

        {/* Bugs Tab */}
        <TabsContent value="bugs" className="space-y-6">
          <div className="h-px bg-border" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Rapports de bugs des utilisateurs
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bug className="h-4 w-4" />
              <span>{bugReports.filter(b => b.status === 'PENDING').length} en attente</span>
            </div>
          </div>

          {loadingBugs ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : bugReports.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun rapport de bug
            </p>
          ) : (
            <div className="space-y-0">
              {bugReports.map((bug) => (
                <div
                  key={bug.id}
                  className={cn(
                    "py-4 border-b border-border/30 last:border-0",
                    bug.status === 'DONE' && "opacity-60"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "font-medium",
                            bug.status === 'DONE' && "line-through"
                          )}>
                            {bug.title}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            bug.status === 'PENDING' 
                              ? "bg-amber-500/20 text-amber-400" 
                              : "bg-green-500/20 text-green-400"
                          )}>
                            {bug.status === 'PENDING' ? 'En attente' : 'Résolu'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Par <span className="text-foreground">{bug.user.username}</span> • {new Date(bug.createdAt).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleBugStatus(bug)}
                          disabled={updatingBug === bug.id}
                          className={cn(
                            "h-8",
                            bug.status === 'DONE' 
                              ? "border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                              : "border-green-500/50 text-green-500 hover:bg-green-500/10"
                          )}
                        >
                          {updatingBug === bug.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : bug.status === 'DONE' ? (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Rouvrir
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Résolu
                            </>
                          )}
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={deletingBug === bug.id}
                            >
                              {deletingBug === bug.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Supprimer ce rapport ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Le rapport de bug sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBug(bug.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded">
                      {bug.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* User Inventory Dialog */}
      <Dialog
        open={inventoryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeInventory();
          } else {
            setInventoryDialogOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Inventaire de {inventoryUser?.username || 'l\'utilisateur'}
            </DialogTitle>
            <DialogDescription>
              Consultez et ajustez les objets détenus par l'utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="border border-border/30 rounded p-4 space-y-3">
              <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
                Ajouter un objet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Objet</label>
                  <Select
                    value={inventoryAddItemId}
                    onValueChange={(value) => setInventoryAddItemId(value)}
                  >
                    <SelectTrigger className="bg-transparent">
                      <SelectValue placeholder="Choisir un objet" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Aucun objet disponible
                        </SelectItem>
                      ) : (
                        items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} • {ITEM_TYPE_LABELS[item.type] || item.type}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Quantité</label>
                  <Input
                    type="number"
                    min={1}
                    value={inventoryAddQuantity}
                    onChange={(e) => setInventoryAddQuantity(parseInt(e.target.value) || 1)}
                    className="bg-transparent"
                  />
                </div>
                <Button
                  onClick={addInventoryItem}
                  disabled={addingInventoryItem || items.length === 0 || !inventoryAddItemId}
                  className="h-9"
                >
                  {addingInventoryItem ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
                  Inventaire actuel
                </h3>
                <span className="text-xs text-muted-foreground">
                  Définissez 0 pour supprimer un objet
                </span>
              </div>

              {loadingInventory ? (
                <div className="flex justify-center py-8">
                  <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
                </div>
              ) : inventoryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucun objet dans l'inventaire
                </p>
              ) : (
                <div className="space-y-0">
                  {inventoryItems.map((inventoryItem) => {
                    const effect = inventoryItem.item.effect ? parseEffect(inventoryItem.item.effect) : null;
                    const effectLabel = effect
                      ? EFFECT_TYPES.find((effectItem) => effectItem.value === effect.type)?.label || effect.type
                      : null;

                    return (
                      <div
                        key={inventoryItem.id}
                        className="py-4 border-b border-border/30 last:border-0"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-4 min-w-0">
                            {inventoryItem.item.imageUrl ? (
                              <img
                                src={inventoryItem.item.imageUrl}
                                alt={inventoryItem.item.name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{inventoryItem.item.name}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  {ITEM_TYPE_LABELS[inventoryItem.item.type] || inventoryItem.item.type}
                                </span>
                              </div>
                              {effectLabel && (
                                <p className="text-xs text-muted-foreground/70">
                                  Effet: {effectLabel}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground/60">
                                Ajouté le {new Date(inventoryItem.acquiredAt).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={inventoryQuantities[inventoryItem.id] ?? inventoryItem.quantity}
                              onChange={(e) =>
                                setInventoryQuantities((prev) => ({
                                  ...prev,
                                  [inventoryItem.id]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-9 w-24 bg-transparent"
                            />
                            <Button
                              size="sm"
                              onClick={() => updateInventoryQuantity(inventoryItem.id)}
                              disabled={updatingInventoryItem === inventoryItem.id}
                              className="h-9"
                            >
                              {updatingInventoryItem === inventoryItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 border-destructive/50 text-destructive hover:bg-destructive/10"
                                  disabled={removingInventoryItem === inventoryItem.id}
                                >
                                  {removingInventoryItem === inventoryItem.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Retirer {inventoryItem.item.name} ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    L'objet sera supprimé de l'inventaire de l'utilisateur.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeInventoryItem(inventoryItem.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Retirer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeInventory}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Create/Edit Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Modifier l\'objet' : 'Créer un objet'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifiez les propriétés de l\'objet.' : 'Créez un nouvel objet pour la boutique.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Nom</label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nom de l'objet"
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description de l'objet"
                className="bg-transparent resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Type</label>
                <Select
                  value={itemForm.type}
                  onValueChange={(value: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE') => 
                    setItemForm(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger className="bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COSMETIC">Cosmétique</SelectItem>
                    <SelectItem value="CONSUMABLE">Consommable</SelectItem>
                    <SelectItem value="UPGRADE">Amélioration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Prix ($)</label>
                <Input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                  className="bg-transparent"
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Image URL (optionnel)</label>
              <Input
                value={itemForm.imageUrl}
                onChange={(e) => setItemForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="bg-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Effet</label>
              <Select
                value={itemForm.effectType}
                onValueChange={(value) => setItemForm(prev => ({ ...prev, effectType: value }))}
              >
                <SelectTrigger className="bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFECT_TYPES.map((effect) => (
                    <SelectItem key={effect.value} value={effect.value}>
                      {effect.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {EFFECT_TYPES.find(e => e.value === itemForm.effectType)?.description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={saveItem}
              disabled={savingItem}
            >
              {savingItem ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingItem ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
