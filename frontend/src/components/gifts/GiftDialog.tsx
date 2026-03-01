import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { giftsApi, usersApi, Gift } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Gift as GiftIcon, Send, Inbox, History, Check } from 'lucide-react';
import GiftOpenAnimation from './GiftOpenAnimation';
import { UsernameDisplay } from '@/components/ui/username-display';

interface GiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGiftOpened: () => void;
  initialTab?: string;
}

export default function GiftDialog({ open, onOpenChange, onGiftOpened, initialTab }: GiftDialogProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || 'inbox');
  const maxAuraPerDay = 50;

  // Inbox state
  const [inboxGifts, setInboxGifts] = useState<Gift[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  // Received state
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(false);

  // Send state
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [auraAmount, setAuraAmount] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Opening animation state
  const [openingGift, setOpeningGift] = useState<Gift | null>(null);

  // Update tab when initialTab changes
  useEffect(() => {
    if (initialTab && open) setTab(initialTab);
  }, [initialTab, open]);

  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const res = await giftsApi.getInbox();
      setInboxGifts(res.data.gifts);
    } catch { /* ignore */ }
    setLoadingInbox(false);
  }, []);

  const fetchReceived = useCallback(async () => {
    setLoadingReceived(true);
    try {
      const res = await giftsApi.getReceived();
      setReceivedGifts(res.data.gifts);
    } catch { /* ignore */ }
    setLoadingReceived(false);
  }, []);

  const fetchSendData = useCallback(async () => {
    try {
      const usersRes = await usersApi.getAll();
      const allUsers = (usersRes.data as { users?: { id: string; username: string }[] }).users || usersRes.data as unknown as { id: string; username: string }[];
      const userList = Array.isArray(allUsers) ? allUsers : [];
      setUsers(userList.filter((u: { id: string }) => u.id !== user?.id));
    } catch { /* ignore */ }
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    if (tab === 'inbox') fetchInbox();
    else if (tab === 'received') fetchReceived();
    else if (tab === 'send') fetchSendData();
  }, [open, tab, fetchInbox, fetchReceived, fetchSendData]);

  const hasContent = auraAmount > 0;

  const handleSend = async () => {
    if (!selectedUser || !hasContent) return;
    setSending(true);
    try {
      await giftsApi.send({
        receiverId: selectedUser,
        auraAmount,
        message: message.trim() || undefined,
      });
      setSendSuccess(true);
      setSelectedUser('');
      setAuraAmount(0);
      setMessage('');
      setTimeout(() => setSendSuccess(false), 2000);
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleOpenGift = async (gift: Gift) => {
    onOpenChange(false);
    setTimeout(() => setOpeningGift(gift), 200);
  };

  const handleAnimationComplete = async () => {
    if (!openingGift) return;
    try {
      await giftsApi.open(openingGift.id);
    } catch { /* ignore */ }
    onGiftOpened();
    fetchInbox();
    fetchReceived();
  };

  const handleCloseAnimation = () => {
    setOpeningGift(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GiftIcon className="h-5 w-5" />
              Cadeaux
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="inbox" className="flex items-center gap-1">
                <Inbox className="h-3.5 w-3.5" />
                Boite
              </TabsTrigger>
              <TabsTrigger value="send" className="flex items-center gap-1">
                <Send className="h-3.5 w-3.5" />
                Envoyer
              </TabsTrigger>
              <TabsTrigger value="received" className="flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                Historique
              </TabsTrigger>
            </TabsList>

            {/* INBOX TAB */}
            <TabsContent value="inbox">
              <ScrollArea className="h-[400px]">
                {loadingInbox ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : inboxGifts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Pas de cadeaux en attente
                  </div>
                ) : (
                    <div className="space-y-2 pr-4">
                    {inboxGifts.map(gift => (
                      <Button
                        key={gift.id}
                        type="button"
                        onClick={() => handleOpenGift(gift)}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 rounded-lg border p-3 text-left hover:bg-accent/50"
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
                          <GiftIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            Cadeau de <UsernameDisplay username={gift.sender.username} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(gift.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-primary">Ouvrir</span>
                      </Button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* SEND TAB */}
            <TabsContent value="send">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {/* User picker */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Destinataire</label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un utilisateur..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            <UsernameDisplay username={u.username} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Aura amount */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Aura (max 50 par jour)</label>
                    <Input
                      type="number"
                      min={1}
                      max={maxAuraPerDay}
                      value={auraAmount}
                      onChange={(e) => setAuraAmount(Math.min(maxAuraPerDay, Math.max(0, Number(e.target.value))))}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Reset chaque jour a 00:00.</p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Message (optionnel)</label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                      placeholder="Ajouter un message..."
                      rows={2}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{message.length}/200</p>
                  </div>

                  {/* Total & Send */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="space-y-0.5">
                      {auraAmount > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Aura: </span>
                          <span className="font-bold">{auraAmount}</span>
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={!selectedUser || !hasContent || sending}
                      size="sm"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : sendSuccess ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      {sendSuccess ? 'Envoy\u00e9 !' : 'Envoyer'}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* RECEIVED TAB */}
            <TabsContent value="received">
              <ScrollArea className="h-[400px]">
                {loadingReceived ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : receivedGifts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun cadeau re\u00e7u
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {receivedGifts.map(gift => (
                      <div
                        key={gift.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white flex-shrink-0">
                          <GiftIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            De {gift.sender.username}
                          </p>
                          {gift.auraAmount > 0 && (
                            <p className="text-xs text-purple-400 font-medium">+{gift.auraAmount} aura</p>
                          )}
                          {gift.message && (
                            <p className="text-xs text-muted-foreground mt-1 ">"{gift.message}"</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(gift.openedAt || gift.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Opening animation overlay */}
      {openingGift && (
        <GiftOpenAnimation
          gift={openingGift}
          onComplete={handleAnimationComplete}
          onClose={handleCloseAnimation}
        />
      )}
    </>
  );
}
