import { type Dispatch, type ReactNode, type SetStateAction, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SPACING } from '@/lib/design-system';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { ChevronDown, Clock, Download, Gamepad2, Loader2, ScrollText, Search } from 'lucide-react';

type LogFilter = {
  type: string;
  gameType: string;
  username: string;
};

type LogsTabProps = {
  logStats: any;
  logFilter: LogFilter;
  setLogFilter: Dispatch<SetStateAction<LogFilter>>;
  fetchLogs: (page?: number, type?: string, gameType?: string) => void;
  logTypeConfig: Record<string, any>;
  gameTypes: Array<{ value: string; label: string }>;
  logTimelineEnabled: boolean;
  setLogTimelineEnabled: Dispatch<SetStateAction<boolean>>;
  logTimelineDate: string;
  setLogTimelineDate: Dispatch<SetStateAction<string>>;
  logTimelineRange: [number, number];
  setLogTimelineRange: Dispatch<SetStateAction<[number, number]>>;
  formatTimelineMinutes: (value: number) => string;
  setDownloadLogsError: Dispatch<SetStateAction<string | null>>;
  setDownloadLogsOpen: Dispatch<SetStateAction<boolean>>;
  downloadLogsOpen: boolean;
  downloadLogsMode: 'range' | 'all';
  setDownloadLogsMode: Dispatch<SetStateAction<'range' | 'all'>>;
  downloadLogsStartDate: string;
  setDownloadLogsStartDate: Dispatch<SetStateAction<string>>;
  downloadLogsEndDate: string;
  setDownloadLogsEndDate: Dispatch<SetStateAction<string>>;
  downloadLogsError: string | null;
  handleDownloadLogs: () => void;
  downloadingLogs: boolean;
  renderLogsPagination: () => ReactNode;
  loadingLogs: boolean;
  logs: Array<any>;
  expandedLogIds: Set<string>;
  renderLogSummary: (log: any) => ReactNode;
  getGameDisplayInfo: (log: any) => { isMultiplayer: boolean };
  toggleLogExpand: (logId: string) => void;
  skipMetadataKeys: Set<string>;
  metadataLabels: Record<string, string>;
  renderMetadataValue: (key: string, value: unknown) => ReactNode;
};

export function LogsTab(props: LogsTabProps) {
  const {
    logStats,
    logFilter,
    setLogFilter,
    fetchLogs,
    logTypeConfig,
    gameTypes,
    logTimelineEnabled,
    setLogTimelineEnabled,
    logTimelineDate,
    setLogTimelineDate,
    logTimelineRange,
    setLogTimelineRange,
    formatTimelineMinutes,
    setDownloadLogsError,
    setDownloadLogsOpen,
    downloadLogsOpen,
    downloadLogsMode,
    setDownloadLogsMode,
    downloadLogsStartDate,
    setDownloadLogsStartDate,
    downloadLogsEndDate,
    setDownloadLogsEndDate,
    downloadLogsError,
    handleDownloadLogs,
    downloadingLogs,
    renderLogsPagination,
    loadingLogs,
    logs,
    expandedLogIds,
    renderLogSummary,
    getGameDisplayInfo,
    toggleLogExpand,
    skipMetadataKeys,
    metadataLabels,
    renderMetadataValue,
  } = props;

  const [timelineModalOpen, setTimelineModalOpen] = useState(false);

  return (
    <TabsContent value="logs" className={SPACING.CARD_SPACING}>
      {logStats && (
        <TooltipProvider delayDuration={150}>
          <ToggleGroup
            type="single"
            value={logFilter.type === 'ALL' ? '' : logFilter.type}
            onValueChange={(value) => {
              const newType = value || 'ALL';
              setLogFilter((prev) => ({ ...prev, type: newType, gameType: 'ALL' }));
              setTimeout(() => fetchLogs(0, newType, 'ALL'), 0);
            }}
            className="flex flex-wrap justify-start gap-2"
          >
            {Object.entries(logStats.byType).map(([type, count]) => {
              const config = logTypeConfig[type];
              if (!config) return null;
              const Icon = config.icon;
              const isSelected = logFilter.type === type;

              return (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value={type}
                      variant="outline"
                      size="sm"
                      className={cn(
                        'rounded-full text-xs transition-all data-[state=on]:hover:text-white px-2.5',
                        isSelected
                          ? `${config.bgColor} ${config.borderColor} text-white hover:${config.bgColor}`
                          : `${config.borderColor} ${config.color} bg-transparent hover:bg-muted/30 hover:${config.color}`
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <span className="font-medium">{config.label}</span>
                    <span className="ml-1.5 text-muted-foreground tabular-nums">({count as ReactNode})</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </ToggleGroup>
        </TooltipProvider>
      )}

      {logFilter.type === 'GAME' && (
        <ToggleGroup
          type="single"
          value={logFilter.gameType === 'ALL' ? '' : logFilter.gameType}
          onValueChange={(value) => {
            const newGameType = value || 'ALL';
            setLogFilter((prev) => ({ ...prev, gameType: newGameType }));
            setTimeout(() => fetchLogs(0, undefined, newGameType), 0);
          }}
          className="flex flex-wrap justify-start gap-2"
        >
          {gameTypes.map((game) => {
            const isSelected = logFilter.gameType === game.value;
            return (
              <ToggleGroupItem
                key={game.value}
                value={game.value}
                variant="outline"
                size="sm"
                className={cn(
                  'rounded-full text-xs transition-all',
                  isSelected
                    ? 'border-purple-500 bg-purple-500 text-white hover:bg-purple-500'
                    : 'border-purple-500 text-purple-400 bg-transparent hover:bg-muted/30 hover:text-purple-300'
                )}
              >
                <Gamepad2 className="h-3 w-3" />
                <span>{game.label}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par utilisateur..."
            value={logFilter.username}
            onChange={(e) => setLogFilter((prev) => ({ ...prev, username: e.target.value }))}
            className="pl-9 bg-transparent border-border/50 h-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTimelineModalOpen(true)}
          className={cn('h-9', logTimelineEnabled && 'border-primary/60 text-primary')}
        >
          <Clock className="h-4 w-4 mr-2" />
          Filtre horaire
          {logTimelineEnabled && (
            <span className="ml-1.5 text-xs opacity-70">
              {formatTimelineMinutes(logTimelineRange[0])}–{formatTimelineMinutes(logTimelineRange[1])}
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDownloadLogsError(null);
            setDownloadLogsOpen(true);
          }}
          className="h-9"
        >
          <Download className="h-4 w-4 mr-2" />
          Télécharger les logs
        </Button>
      </div>

      {/* Timeline filter modal */}
      <Dialog open={timelineModalOpen} onOpenChange={setTimelineModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Filtre horaire
            </DialogTitle>
            <DialogDescription>
              Sélectionne un créneau précis sur une journée via la timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {logTimelineEnabled ? 'Activé' : 'Désactivé'}
              </span>
              <Switch
                checked={logTimelineEnabled}
                onCheckedChange={(checked) => {
                  setLogTimelineEnabled(checked);
                  setTimeout(() => fetchLogs(0), 0);
                }}
              />
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jour</label>
                <Input
                  type="date"
                  value={logTimelineDate}
                  disabled={!logTimelineEnabled}
                  onChange={(e) => {
                    setLogTimelineDate(e.target.value);
                    setTimeout(() => fetchLogs(0), 0);
                  }}
                  className="h-9 w-full md:w-[210px]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!logTimelineEnabled}
                onClick={() => {
                  setLogTimelineRange([0, 1439]);
                  setTimeout(() => fetchLogs(0), 0);
                }}
                className="h-9 md:self-end"
              >
                Toute la journée
              </Button>
            </div>

            <div className={cn('space-y-4 transition-opacity', !logTimelineEnabled && 'opacity-50')}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="rounded-full border border-border/50 px-2.5 py-1 font-mono">
                  Début {formatTimelineMinutes(logTimelineRange[0])}
                </span>
                <span className="text-muted-foreground">
                  {Math.max(15, logTimelineRange[1] - logTimelineRange[0] + 1)} min sélectionnées
                </span>
                <span className="rounded-full border border-border/50 px-2.5 py-1 font-mono">
                  Fin {formatTimelineMinutes(logTimelineRange[1])}
                </span>
              </div>

              <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-5">
                <Slider
                  min={0}
                  max={1439}
                  step={15}
                  minStepsBetweenThumbs={1}
                  value={logTimelineRange}
                  disabled={!logTimelineEnabled}
                  onValueChange={(value) => {
                    if (value.length !== 2) return;
                    setLogTimelineRange([value[0], value[1]]);
                  }}
                  onValueCommit={(value) => {
                    if (value.length !== 2) return;
                    setLogTimelineRange([value[0], value[1]]);
                    fetchLogs(0);
                  }}
                  className="py-3"
                />

                <div className="mt-3 grid grid-cols-6 gap-2 text-[11px] text-muted-foreground sm:grid-cols-8 lg:grid-cols-12">
                  {Array.from({ length: 12 }, (_, index) => {
                    const hour = index * 2;
                    return (
                      <div key={hour} className="text-center font-mono">
                        {String(hour).padStart(2, '0')}h
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineModalOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={downloadLogsOpen}
        onOpenChange={(open) => {
          setDownloadLogsOpen(open);
          if (!open) {
            setDownloadLogsError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Télécharger les logs</DialogTitle>
            <DialogDescription>
              Exporte une plage de dates précise ou la totalité des logs. En mode plage de dates, les filtres actifs (type, jeu, pseudo) sont appliqués.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={downloadLogsMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDownloadLogsMode('range');
                  setDownloadLogsError(null);
                }}
              >
                Plage de dates
              </Button>
              <Button
                type="button"
                variant={downloadLogsMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDownloadLogsMode('all');
                  setDownloadLogsError(null);
                }}
              >
                Tous les temps
              </Button>
            </div>
            {downloadLogsMode === 'range' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Depuis le</label>
                  <Input
                    type="date"
                    value={downloadLogsStartDate}
                    onChange={(e) => setDownloadLogsStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Jusqu'au</label>
                  <Input
                    type="date"
                    value={downloadLogsEndDate}
                    onChange={(e) => setDownloadLogsEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tous les logs seront exportés sans aucun filtre ni limite de date.
              </p>
            )}
            {downloadLogsError && <p className="text-xs text-red-400">{downloadLogsError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDownloadLogsOpen(false)}
              disabled={downloadingLogs}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleDownloadLogs}
              disabled={downloadingLogs}
            >
              {downloadingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Télécharger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderLogsPagination()}

      {loadingLogs ? (
        <div className="flex justify-center py-12">
          <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <ScrollText className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Aucun log trouvé</p>
        </div>
      ) : (
        <div className="border border-border/30 rounded overflow-hidden divide-y divide-border/30">
          {logs.map((log) => {
            const config = logTypeConfig[log.type];
            const Icon = config?.icon || ScrollText;
            const isExpanded = expandedLogIds.has(log.id);
            const summaryNode = renderLogSummary(log);
            const gameDisplayInfo = getGameDisplayInfo(log);
            const gameRowAccentClass =
              log.type === 'GAME'
                ? gameDisplayInfo.isMultiplayer
                  ? 'bg-cyan-500/[0.05] hover:bg-cyan-500/[0.10]'
                  : 'bg-amber-500/[0.05] hover:bg-amber-500/[0.10]'
                : 'hover:bg-muted/20';
            const gameDetailsAccentClass =
              log.type === 'GAME'
                ? gameDisplayInfo.isMultiplayer
                  ? 'bg-cyan-500/[0.04]'
                  : 'bg-amber-500/[0.04]'
                : 'bg-muted/10';
            const typePillClass =
              log.type === 'GAME'
                ? gameDisplayInfo.isMultiplayer
                  ? 'bg-cyan-600'
                  : 'bg-amber-600'
                : (config?.bgColor || 'bg-muted');

            return (
              <div key={log.id}>
                <Button
                  variant="ghost"
                  onClick={() => toggleLogExpand(log.id)}
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-2 transition-colors text-left',
                    gameRowAccentClass
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0',
                      typePillClass,
                      'text-white'
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {config?.label || humanizeUiLabel(log.type)}
                  </span>

                  <span className="text-sm truncate flex-1">
                    <span className="font-medium">{summaryNode}</span>
                  </span>

                  <span className="text-xs text-muted-foreground/60 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </Button>

                {isExpanded && (
                  <div className={cn('px-3 pb-3 pt-1 border-t border-border/20', gameDetailsAccentClass)}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="text-muted-foreground">Date</div>
                      <div>
                        {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>

                      {log.username && (
                        <>
                          <div className="text-muted-foreground">Utilisateur</div>
                          <div>{log.username}</div>
                        </>
                      )}

                      {log.targetName && (
                        <>
                          <div className="text-muted-foreground">Cible</div>
                          <div>{log.targetName}</div>
                        </>
                      )}

                      {log.ipAddress && (
                        <>
                          <div className="text-muted-foreground">Adresse réseau</div>
                          <div className="font-mono">{log.ipAddress}</div>
                        </>
                      )}

                      {Object.entries(log.metadata ?? log.details ?? {})
                        .filter(([key]) => !skipMetadataKeys.has(key))
                        .map(([key, value]) => (
                          <div key={key} className="contents">
                            <div className="text-muted-foreground">{metadataLabels[key] || humanizeUiLabel(key)}</div>
                            <div>{renderMetadataValue(key, value)}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {renderLogsPagination()}
    </TabsContent>
  );
}
