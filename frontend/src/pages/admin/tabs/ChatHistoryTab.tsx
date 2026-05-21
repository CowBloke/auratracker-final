import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';

export type ChatHistoryTabProps = Record<string, unknown>;

export function ChatHistoryTab(props: ChatHistoryTabProps) {
  const {
    fetchChatHistoryDays,
    loadingChatHistoryDays,
    loadingMoreChatHistoryDays,
    exportChat,
    exportingChat,
    showDeletedChatMessages,
    setShowDeletedChatMessages,
    chatHistoryDays,
    chatHistoryDay,
    fetchChatHistoryDay,
    chatHistoryCursor,
    chatHistoryMessages,
    loadingChatHistoryMessages,
    exportingChatDay,
    softDeletingChatMessageId,
    softDeleteChatMessage,
  } = props as any;

  return (
    <TabsContent value="chat-history" className={SPACING.SECTION_SPACING}>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className={TYPOGRAPHY.H4}>Historique chat global</h3>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>
                  Tous les messages de tous les temps, classes par jour (00:00 a 00:00 heure de Paris).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchChatHistoryDays()}
                  disabled={loadingChatHistoryDays || loadingMoreChatHistoryDays}
                >
                  {(loadingChatHistoryDays || loadingMoreChatHistoryDays)
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Rafraichir
                </Button>
                <Button variant="outline" size="sm" onClick={() => void exportChat()} disabled={exportingChat}>
                  {exportingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  Export total
                </Button>
                <div className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <Switch checked={showDeletedChatMessages} onCheckedChange={setShowDeletedChatMessages} />
                  <span className="text-xs text-muted-foreground">Afficher les supprimes</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/60 bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Jours
                </div>
                <div className="max-h-[620px] overflow-y-auto">
                  {loadingChatHistoryDays && chatHistoryDays.length === 0 ? (
                    <div className="p-4 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : chatHistoryDays.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Aucun message trouve.</p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {chatHistoryDays.map((dayEntry: any) => {
                        const selected = chatHistoryDay === dayEntry.day;
                        return (
                          <button
                            key={dayEntry.day}
                            type="button"
                            onClick={() => void fetchChatHistoryDay(dayEntry.day, showDeletedChatMessages)}
                            className={cn('w-full px-3 py-2 text-left transition-colors hover:bg-muted/30', selected && 'bg-muted/50')}
                          >
                            <div className="text-sm font-medium">
                              {new Date(`${dayEntry.day}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{dayEntry.totalMessages.toLocaleString('fr-FR')} total</span>
                              <span>{dayEntry.visibleMessages.toLocaleString('fr-FR')} visibles</span>
                              <span>{dayEntry.deletedMessages.toLocaleString('fr-FR')} supprimes</span>
                            </div>
                          </button>
                        );
                      })}
                      {chatHistoryCursor && (
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            disabled={loadingMoreChatHistoryDays}
                            onClick={() => void fetchChatHistoryDays(true)}
                          >
                            {loadingMoreChatHistoryDays ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Charger plus de jours
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {chatHistoryDay
                      ? `Messages du ${new Date(`${chatHistoryDay}T00:00:00`).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}`
                      : 'Selectionne un jour'}
                  </div>
                  {chatHistoryDay && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void exportChat(chatHistoryDay)}
                      disabled={exportingChatDay === chatHistoryDay}
                    >
                      {exportingChatDay === chatHistoryDay ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                      Export jour
                    </Button>
                  )}
                </div>

                <div className="max-h-[620px] overflow-y-auto p-3 space-y-2">
                  {loadingChatHistoryMessages ? (
                    <div className="py-8 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : chatHistoryMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun message pour ce jour.</p>
                  ) : (
                    chatHistoryMessages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={cn('rounded-lg border px-3 py-2', msg.deletedAt ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-background')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{msg.user?.username || 'Systeme'}</span>
                              <span>{new Date(msg.createdAt).toLocaleString('fr-FR')}</span>
                              <span className="uppercase">{msg.type}</span>
                              {msg.deletedAt && <span className="text-destructive font-medium">SUPPRIME VISUELLEMENT</span>}
                            </div>
                            <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                              {(msg.originalMessage || msg.message) || '(message vide)'}
                            </p>
                            {msg.originalMessage && msg.originalMessage !== msg.message && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Version publique : <span className="font-mono">{msg.message}</span>
                              </p>
                            )}
                            {msg.imageUrl && (
                              <a
                                href={resolveImageUrl(msg.imageUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs text-blue-400 hover:underline"
                              >
                                Ouvrir image
                              </a>
                            )}
                          </div>
                          {!msg.deletedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/40 text-destructive hover:bg-destructive/10"
                              disabled={softDeletingChatMessageId === msg.id}
                              onClick={() => void softDeleteChatMessage(msg.id)}
                            >
                              {softDeletingChatMessageId === msg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
