import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { giftsApi, usersApi, Gift, GiftTemplate } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Gift as GiftIcon, Send, Inbox, History, Check } from 'lucide-react';
import GiftOpenAnimation from './GiftOpenAnimation';
import { resolveImageUrl } from '@/lib/images';

interface GiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGiftOpened: () => void;
  initialTab?: string;
}

export default function GiftDialog({ open, onOpenChange, onGiftOpened, initialTab }: GiftDialogProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || 'inbox');
  const maxAuraPerGift = 50;

  // Inbox state
  const [inboxGifts, setInboxGifts] = useState<Gift[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  // Received state
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(false);

  // Send state
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [templates, setTemplates] = useState<GiftTemplate[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [moneyAmount, setMoneyAmount] = useState(0);
  const [auraAmount, setAuraAmount] = useState(0);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
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
      const [usersRes, templatesRes] = await Promise.all([
        usersApi.getAll(),
        giftsApi.getTemplates(),
      ]);
      const allUsers = (usersRes.data as { users?: { id: string; username: string }[] }).users || usersRes.data as unknown as { id: string; username: string }[];
      const userList = Array.isArray(allUsers) ? allUsers : [];
      setUsers(userList.filter((u: { id: string }) => u.id !== user?.id));
      setTemplates(templatesRes.data.templates);
    } catch { /* ignore */ }
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    if (tab === 'inbox') fetchInbox();
    else if (tab === 'received') fetchReceived();
    else if (tab === 'send') fetchSendData();
  }, [open, tab, fetchInbox, fetchReceived, fetchSendData]);

  const templateCost = templates
    .filter(t => selectedTemplates.includes(t.id))
    .reduce((sum, t) => sum + t.price, 0);
  const totalMoneyCost = moneyAmount + templateCost;
  const hasContent = totalMoneyCost > 0 || auraAmount > 0;

  const handleSend = async () => {
    if (!selectedUser || !hasContent) return;
    setSending(true);
    try {
      await giftsApi.send({
        receiverId: selectedUser,
        moneyAmount: moneyAmount > 0 ? moneyAmount : undefined,
        auraAmount: auraAmount > 0 ? auraAmount : undefined,
        templateIds: selectedTemplates.length > 0 ? selectedTemplates : undefined,
        message: message.trim() || undefined,
      });
      setSendSuccess(true);
      setSelectedUser('');
      setMoneyAmount(0);
      setAuraAmount(0);
      setSelectedTemplates([]);
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

  const toggleTemplate = (id: string) => {
    setSelectedTemplates(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
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
            <TabsList className="grid w-full grid-cols-3">
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
                          <p className="font-medium text-sm truncate">
                            Cadeau de {gift.sender.username}
                          </p>
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
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Money amount */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Argent (max $1000)</label>
                    <Input
                      type="number"
                      min={0}
                      max={1000}
                      value={moneyAmount}
                      onChange={(e) => setMoneyAmount(Math.min(1000, Math.max(0, Number(e.target.value))))}
                      placeholder="0"
                    />
                  </div>

                  {/* Aura amount */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Aura (max 50, 5x/jour)</label>
                    <Input
                      type="number"
                      min={0}
                      max={maxAuraPerGift}
                      value={auraAmount}
                      onChange={(e) => setAuraAmount(Math.min(maxAuraPerGift, Math.max(0, Number(e.target.value))))}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ne co\u00fbte pas d'aura</p>
                  </div>

                  {/* Gift templates */}
                  {templates.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Articles cadeaux</label>
                      <div className="space-y-2">
                        {templates.map(t => (
                          <Button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTemplate(t.id)}
                            variant="ghost"
                            className={`h-auto w-full justify-start gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                              selectedTemplates.includes(t.id)
                                ? 'border-primary bg-primary/10'
                                : 'hover:bg-accent/50'
                            }`}
                          >
                            <div className={`h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 ${
                              selectedTemplates.includes(t.id)
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            }`}>
                              {selectedTemplates.includes(t.id) && <Check className="h-3 w-3" />}
                            </div>
                            {t.imageUrl ? (
                              <img src={resolveImageUrl(t.imageUrl)} alt={t.name} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <GiftIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{t.name}</p>
                              {t.description && (
                                <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-medium text-yellow-500">${t.price}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

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
                      {totalMoneyCost > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Co\u00fbt: </span>
                          <span className="font-bold">${totalMoneyCost}</span>
                        </p>
                      )}
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
                          {gift.moneyAmount > 0 && (
                            <p className="text-xs text-yellow-500 font-medium">+${gift.moneyAmount}</p>
                          )}
                          {gift.auraAmount > 0 && (
                            <p className="text-xs text-purple-400 font-medium">+{gift.auraAmount} aura</p>
                          )}
                          {gift.items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {gift.items.map(item => (
                                <span key={item.id} className="inline-flex items-center gap-1 text-xs bg-accent px-1.5 py-0.5 rounded">
                                  {item.giftTemplate.imageUrl ? (
                                    <img src={resolveImageUrl(item.giftTemplate.imageUrl)} alt={item.giftTemplate.name} className="h-4 w-4 rounded object-cover" />
                                  ) : null}
                                  {item.giftTemplate.name}
                                </span>
                              ))}
                            </div>
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
