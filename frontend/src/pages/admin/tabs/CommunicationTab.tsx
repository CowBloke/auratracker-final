import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { Archive, Loader2, Plus, RefreshCw, Send, Upload, X } from 'lucide-react';

export type CommunicationTabProps = Record<string, unknown>;

export function CommunicationTab(props: CommunicationTabProps) {
  const {
    surveys,
    surveysLoading,
    fetchSurveys,
    surveyDialogOpen,
    setSurveyDialogOpen,
    surveyTitle,
    setSurveyTitle,
    surveyDescription,
    setSurveyDescription,
    surveyAudienceType,
    setSurveyAudienceType,
    surveyPopupDelaySeconds,
    setSurveyPopupDelaySeconds,
    surveyOptions,
    setSurveyOptions,
    surveyTargetSearch,
    setSurveyTargetSearch,
    surveySelectedUserIds,
    setSurveySelectedUserIds,
    surveyImageUrl,
    setSurveyImageUrl,
    surveyUploadingImage,
    surveyImageInputRef,
    handleSurveyImageUpload,
    surveyOptionUploadingIndex,
    surveyOptionImageInputRef,
    triggerSurveyOptionImageUpload,
    handleSurveyOptionImageUpload,
    creatingSurvey,
    createSurvey,
    resetSurveyForm,
    archiveSurvey,
    archivingSurveyId,
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

  const audienceLabelMap: Record<string, string> = {
    ALL_USERS: 'Tous les utilisateurs',
    BETA_TESTERS: 'Bêta testeurs',
    ADMINS: 'Admins',
    SELECTED_USERS: 'Utilisateurs choisis',
  };

  const filteredSurveyUsers = users
    .filter((u: any) => !surveySelectedUserIds.includes(u.id))
    .filter((u: any) => u.username.toLowerCase().includes(surveyTargetSearch.toLowerCase()))
    .slice(0, 10);

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

      <Dialog
        open={surveyDialogOpen}
        onOpenChange={(open) => {
          setSurveyDialogOpen(open);
          if (!open) {
            resetSurveyForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau sondage</DialogTitle>
            <DialogDescription>
              Le pop-up sera affiché avec un délai, puis seulement aux utilisateurs ciblés qui n'ont pas encore répondu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Titre</label>
                <Input
                  value={surveyTitle}
                  onChange={(e) => setSurveyTitle(e.target.value)}
                  placeholder="Ex: Quelle fonctionnalité veux-tu en premier ?"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Audience</label>
                <Select value={surveyAudienceType} onValueChange={setSurveyAudienceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_USERS">Tous les utilisateurs</SelectItem>
                    <SelectItem value="BETA_TESTERS">Bêta testeurs</SelectItem>
                    <SelectItem value="ADMINS">Admins</SelectItem>
                    <SelectItem value="SELECTED_USERS">Utilisateurs choisis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={surveyDescription}
                  onChange={(e) => setSurveyDescription(e.target.value)}
                  placeholder="Contexte, objectif, ou ce qu'on attend des joueurs."
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Délai avant pop-up (sec)</label>
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={surveyPopupDelaySeconds}
                  onChange={(e) => setSurveyPopupDelaySeconds(Number(e.target.value) || 45)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Options</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSurveyOptions((prev: Array<{ label: string; color: string; imageUrl: string | null }>) => (
                    prev.length >= 8 ? prev : [...prev, { label: '', color: '#f59e0b', imageUrl: null }]
                  ))}
                  disabled={surveyOptions.length >= 8}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
              <input
                ref={surveyOptionImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleSurveyOptionImageUpload}
                className="hidden"
              />
              <div className="space-y-2">
                {surveyOptions.map((option: { label: string; color: string; imageUrl: string | null }, index: number) => (
                  <div key={index} className="space-y-1.5">
                    <div className="grid gap-2 md:grid-cols-[1fr_90px_36px_36px]">
                      <Input
                        value={option.label}
                        onChange={(e) => setSurveyOptions((prev: Array<{ label: string; color: string; imageUrl: string | null }>) => prev.map((entry, entryIndex) => (
                          entryIndex === index ? { ...entry, label: e.target.value } : entry
                        )))}
                        placeholder={`Option ${index + 1}`}
                        maxLength={80}
                      />
                      <Input
                        type="color"
                        value={option.color}
                        onChange={(e) => setSurveyOptions((prev: Array<{ label: string; color: string; imageUrl: string | null }>) => prev.map((entry, entryIndex) => (
                          entryIndex === index ? { ...entry, color: e.target.value } : entry
                        )))}
                        className="h-10 p-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-9 shrink-0"
                        title="Ajouter une image"
                        disabled={surveyOptionUploadingIndex === index}
                        onClick={() => triggerSurveyOptionImageUpload(index)}
                      >
                        {surveyOptionUploadingIndex === index
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Upload className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-9 shrink-0"
                        onClick={() => setSurveyOptions((prev: Array<{ label: string; color: string; imageUrl: string | null }>) => (
                          prev.length <= 2 ? prev : prev.filter((_, entryIndex) => entryIndex !== index)
                        ))}
                        disabled={surveyOptions.length <= 2}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {option.imageUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={option.imageUrl}
                          alt={`Option ${index + 1}`}
                          className="h-12 w-12 rounded border border-border object-cover"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => setSurveyOptions((prev: Array<{ label: string; color: string; imageUrl: string | null }>) => prev.map((entry, entryIndex) => (
                            entryIndex === index ? { ...entry, imageUrl: null } : entry
                          )))}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Supprimer l'image
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Image du sondage <span className="text-muted-foreground font-normal">(optionnel)</span></label>
              <div className="flex items-center gap-3">
                {surveyImageUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={surveyImageUrl} alt="Aperçu" className="h-16 w-16 rounded border border-border object-cover" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setSurveyImageUrl(null)}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Supprimer
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={surveyUploadingImage}
                    onClick={() => surveyImageInputRef.current?.click()}
                  >
                    {surveyUploadingImage ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                    Ajouter une image
                  </Button>
                )}
                <input
                  ref={surveyImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSurveyImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {surveyAudienceType === 'SELECTED_USERS' && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Utilisateurs ciblés</label>
                  <Input
                    value={surveyTargetSearch}
                    onChange={(e) => setSurveyTargetSearch(e.target.value)}
                    placeholder="Rechercher un utilisateur..."
                  />
                </div>

                {surveySelectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {surveySelectedUserIds.map((userId: string) => {
                      const selectedUser = users.find((user: any) => user.id === userId);
                      if (!selectedUser) return null;
                      return (
                        <button
                          key={userId}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
                          onClick={() => setSurveySelectedUserIds((prev: string[]) => prev.filter((id) => id !== userId))}
                        >
                          {selectedUser.username}
                          <X className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {surveyTargetSearch.trim() && (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
                    {filteredSurveyUsers.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
                    ) : (
                      filteredSurveyUsers.map((user: any) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full border-b border-border/50 px-3 py-2 text-left text-sm hover:bg-muted/50 last:border-b-0"
                          onClick={() => setSurveySelectedUserIds((prev: string[]) => [...prev, user.id])}
                        >
                          {user.username}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSurveyDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={createSurvey} disabled={creatingSurvey}>
              {creatingSurvey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className={TYPOGRAPHY.H4}>Sondages utilisateurs</h3>
                <CardDescription>
                  Crée un sondage, cible une audience, puis archive-le quand tu veux arrêter sa diffusion.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchSurveys}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => setSurveyDialogOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Nouveau sondage
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {surveysLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : surveys.length === 0 ? (
              <p className={cn(TYPOGRAPHY.MUTED, 'py-6 text-center')}>Aucun sondage pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {surveys.map((survey: any) => {
                  const totalVotes = survey.totalResponses || 0;
                  return (
                    <div key={survey.id} className="rounded-lg border border-border/60 bg-background p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold">{survey.title}</h4>
                            <span className={cn(
                              'rounded-full px-2 py-1 text-[10px] font-semibold',
                              survey.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            )}>
                              {survey.status === 'ACTIVE' ? 'Actif' : 'Archivé'}
                            </span>
                            <span className="rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">
                              {audienceLabelMap[survey.audienceType] || survey.audienceType}
                            </span>
                          </div>
                          {survey.description && (
                            <p className="text-sm text-muted-foreground">{survey.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{totalVotes} réponse{totalVotes > 1 ? 's' : ''}</span>
                            {survey.totalTargets !== null && (
                              <span>{survey.pendingTargets} restant{survey.pendingTargets > 1 ? 's' : ''} / {survey.totalTargets}</span>
                            )}
                            <span>Délai: {survey.popupDelaySeconds}s</span>
                            <span>Créé le {new Date(survey.createdAt).toLocaleString('fr-FR')}</span>
                          </div>
                          {survey.selectedUsers?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {survey.selectedUsers.slice(0, 8).map((selectedUser: any) => (
                                <span key={selectedUser.id} className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                                  {selectedUser.username}
                                </span>
                              ))}
                              {survey.selectedUsers.length > 8 && (
                                <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                                  +{survey.selectedUsers.length - 8}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {survey.status === 'ACTIVE' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => archiveSurvey(survey.id)}
                            disabled={archivingSurveyId === survey.id}
                          >
                            {archivingSurveyId === survey.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Archive className="mr-1 h-4 w-4" />
                                Archiver
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {survey.imageUrl && (
                        <img
                          src={survey.imageUrl}
                          alt={survey.title}
                          className="mt-3 max-h-32 w-full rounded-md border border-border object-cover"
                        />
                      )}
                      <div className="mt-4 grid gap-2">
                        {survey.options.map((option: any) => {
                          const percent = totalVotes > 0 ? Math.round((option.responseCount / totalVotes) * 100) : 0;
                          return (
                            <div key={option.id} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  {option.imageUrl
                                    ? <img src={option.imageUrl} alt={option.label} className="h-5 w-5 rounded object-cover border border-border" />
                                    : <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} />
                                  }
                                  <span className="font-medium text-foreground">{option.label}</span>
                                </div>
                                <span className="text-muted-foreground">
                                  {option.responseCount} vote{option.responseCount > 1 ? 's' : ''} · {percent}%
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${percent}%`, backgroundColor: option.color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
