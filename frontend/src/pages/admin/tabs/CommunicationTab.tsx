import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { Loader2, Plus, RefreshCw, Send, Upload, X } from 'lucide-react';

export type CommunicationTabProps = Record<string, unknown>;

export function CommunicationTab(props: CommunicationTabProps) {
  const {
    newThreadOpen,
    setNewThreadOpen,
    setNewThreadUserId,
    setNewThreadBody,
    setNewThreadSearch,
    newThreadSearch,
    users,
    newThreadUserId,
    newThreadBody,
    newThreadSending,
    handleStartThread,
    supportReportsLoading,
    supportReports,
    fetchSupportReports,
    reviewingSupportReportId,
    handleReviewSupportReport,
    fetchSupportThreads,
    supportThreadsLoading,
    supportThreads,
    openSupportThread,
    activeThreadUserId,
    activeThreadUser,
    activeThreadMessages,
    supportMessagesEndRef,
    supportReplyImages,
    removeSupportReplyImage,
    supportUploadingImage,
    supportSending,
    supportImageInputRef,
    handleSupportImageUpload,
    supportReply,
    setSupportReply,
    handleSupportReply,
  } = props as any;

  return (
    <TabsContent value="communication" className={"space-y-8"}>
      <Dialog open={newThreadOpen} onOpenChange={(o) => { setNewThreadOpen(o); if (!o) { setNewThreadUserId(''); setNewThreadBody(''); setNewThreadSearch(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
            <DialogDescription>Envoie un premier message a un utilisateur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Utilisateur</label>
              <Input
                placeholder="Rechercher un utilisateur..."
                value={newThreadSearch}
                onChange={(e) => { setNewThreadSearch(e.target.value); setNewThreadUserId(''); }}
                className="mb-2"
              />
              {newThreadSearch.trim() && (
                <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                  {users
                    .filter((u: any) => u.username.toLowerCase().includes(newThreadSearch.toLowerCase()))
                    .slice(0, 10)
                    .map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        className={cn('w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors', newThreadUserId === u.id && 'bg-muted font-medium')}
                        onClick={() => { setNewThreadUserId(u.id); setNewThreadSearch(u.username); }}
                      >
                        {u.username}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Message</label>
              <Textarea
                value={newThreadBody}
                onChange={(e) => setNewThreadBody(e.target.value)}
                placeholder="Votre message..."
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewThreadOpen(false)}>Annuler</Button>
            <Button disabled={!newThreadUserId || !newThreadBody.trim() || newThreadSending} onClick={handleStartThread}>
              {newThreadSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className={TYPOGRAPHY.H4}>Signalements de conversations</h3>
              <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Les derniers messages sont envoyes ici quand un joueur signale un DM ou un groupe.</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchSupportReports}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          {supportReportsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : supportReports.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, 'text-center')}>Aucun signalement.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {supportReports.slice(0, 8).map((report: any) => (
                <div key={report.id} className="rounded-lg border border-border/60 bg-background p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{report.conversationTitle || report.conversationType || 'Conversation'}</p>
                      <p className="text-xs text-muted-foreground">Signale par {report.reporter.username} • {new Date(report.createdAt).toLocaleString('fr-FR')}</p>
                    </div>
                    <span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', report.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400' : report.status === 'ACTION_TAKEN' ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400')}>
                      {report.status}
                    </span>
                  </div>
                  {report.reason && <p className="text-sm text-foreground">{report.reason}</p>}
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-2">
                    {report.snapshot.map((message: any) => (
                      <div key={message.id} className="rounded-md bg-background/80 px-2 py-1.5 text-xs whitespace-pre-wrap break-words">
                        <span className="font-semibold">{message.sender?.username ?? 'Systeme'}:</span> {message.body}
                      </div>
                    ))}
                  </div>
                  {report.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={reviewingSupportReportId === report.id} onClick={() => handleReviewSupportReport(report.id, 'ACTION_TAKEN')}>
                        Action prise
                      </Button>
                      <Button size="sm" variant="outline" disabled={reviewingSupportReportId === report.id} onClick={() => handleReviewSupportReport(report.id, 'DISMISSED')}>
                        Ignorer
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4 h-[600px]">
          <div className="w-72 shrink-0 flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <h3 className={TYPOGRAPHY.H4}>Conversations</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Nouvelle conversation" onClick={() => setNewThreadOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchSupportThreads}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {supportThreadsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : supportThreads.length === 0 ? (
                <p className={cn(TYPOGRAPHY.MUTED, 'p-4 text-center')}>Aucune conversation.</p>
              ) : (
                supportThreads.map((thread: any) => (
                  <button
                    key={thread.userId}
                    type="button"
                    onClick={() => openSupportThread(thread.userId)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors',
                      activeThreadUserId === thread.userId && 'bg-muted'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {thread.user?.username ?? thread.userId}
                      </span>
                      {thread.unreadCount > 0 && (
                        <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold shrink-0">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {thread.lastFromAdmin ? '↩ ' : ''}{thread.lastBody}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col border border-border rounded-lg overflow-hidden">
            {!activeThreadUserId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Selectionne une conversation.
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border bg-muted/40">
                  <h3 className={TYPOGRAPHY.H4}>{activeThreadUser?.username ?? activeThreadUserId}</h3>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {activeThreadMessages.map((msg: any) => {
                    const messageImages = msg.images ? JSON.parse(msg.images) : [];
                    return (
                      <div key={msg.id} className={cn('flex', msg.fromAdmin ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                          msg.fromAdmin
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted text-foreground rounded-tl-sm'
                        )}>
                          {!msg.fromAdmin && (
                            <p className="text-[10px] font-semibold text-primary mb-0.5">{activeThreadUser?.username}</p>
                          )}
                          {messageImages.length > 0 && (
                            <div className="flex gap-1 mb-2 flex-wrap">
                              {messageImages.map((img: string, idx: number) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt={`Message ${idx}`}
                                  className="h-16 w-16 object-cover rounded"
                                />
                              ))}
                            </div>
                          )}
                          <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                          <p className={cn('text-[10px] mt-1', msg.fromAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={supportMessagesEndRef} />
                </div>
                <div className="border-t border-border p-3 space-y-2">
                  {supportReplyImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {supportReplyImages.map((img: string, idx: number) => (
                        <div key={idx} className="relative group">
                          <img
                            src={img}
                            alt={`Support ${idx}`}
                            className="h-12 w-12 object-cover rounded border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => removeSupportReplyImage(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Supprimer l'image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 hover:bg-primary/10 hover:text-primary text-xs"
                        disabled={supportUploadingImage || supportReplyImages.length >= 5 || supportSending}
                        onClick={() => supportImageInputRef.current?.click()}
                        title="Ajouter une image"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Image
                      </Button>
                      <input
                        ref={supportImageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleSupportImageUpload}
                        className="hidden"
                      />
                    </div>
                    <Textarea
                      value={supportReply}
                      onChange={(e) => setSupportReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSupportReply(); }
                      }}
                      placeholder="Repondre..."
                      className="resize-none text-sm min-h-[36px] max-h-24 py-2"
                      rows={1}
                      maxLength={1000}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={(!supportReply.trim() && supportReplyImages.length === 0) || supportSending || supportUploadingImage}
                      onClick={handleSupportReply}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
