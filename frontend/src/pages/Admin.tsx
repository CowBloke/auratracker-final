import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { adminApi, AdminUser } from '../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Save, MessageSquareX, AlertTriangle } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ aura: number; money: number; dailyAuraGiven: number }>({ aura: 0, money: 0, dailyAuraGiven: 0 });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearingChat, setClearingChat] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect non-admin users
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchUsers();
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

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const startEditing = (u: AdminUser) => {
    setEditingUser(u.id);
    setEditValues({
      aura: u.aura,
      money: u.money,
      dailyAuraGiven: u.dailyAuraGiven,
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
      <Tabs defaultValue="users" className="space-y-8">
        <TabsList className="bg-transparent border border-border/30 p-1">
          <TabsTrigger 
            value="users"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger 
            value="chat"
            className="data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
          >
            Chat
          </TabsTrigger>
        </TabsList>

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
                          <label className="text-xs text-muted-foreground">Quota aura donné</label>
                          <Input
                            type="number"
                            value={editValues.dailyAuraGiven}
                            onChange={(e) => setEditValues(prev => ({ ...prev, dailyAuraGiven: parseInt(e.target.value) || 0 }))}
                            className="h-9 bg-transparent border-border/50"
                            min={0}
                            max={50}
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
                            <p className="tabular-nums">{u.dailyAuraGiven}/50 donné</p>
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
      </Tabs>
    </div>
  );
}
