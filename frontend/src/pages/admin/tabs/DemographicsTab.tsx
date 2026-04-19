import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Cell, Legend } from 'recharts';
import { Trophy, UserCog, Users, Wallet } from 'lucide-react';
import type { AdminUser } from '../../../services/api';

type CountDistributionPoint = {
  label: string;
  count: number;
  share: number;
};

type ClassAveragePoint = {
  label: string;
  count: number;
  avgAura: number;
  avgMoney: number;
};

type TopUserByLevel = {
  level: string;
  users: AdminUser[];
};

type UsersByClassEntry = {
  classLabel: string;
  users: AdminUser[];
};

type DemographicsTabProps = {
  totalDemographicUsers: number;
  levelDistributionData: CountDistributionPoint[];
  classDistributionData: CountDistributionPoint[];
  classAveragesData: ClassAveragePoint[];
  topUsersByLevel: TopUserByLevel[];
  usersByClass: UsersByClassEntry[];
  activityBreakdownColors: string[];
  formatPercent: (value: number, digits?: number) => string;
  formatBigNumber: (value: number) => string;
};

export function DemographicsTab({
  totalDemographicUsers,
  levelDistributionData,
  classDistributionData,
  classAveragesData,
  topUsersByLevel,
  usersByClass,
  activityBreakdownColors,
  formatPercent,
  formatBigNumber,
}: DemographicsTabProps) {
  return (
    <TabsContent value="demographics" className={SPACING.SECTION_SPACING}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Comptes analysés</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{totalDemographicUsers.toLocaleString('fr-FR')}</p>
            <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Hors super admin.</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <span className="font-semibold text-sm">Niveaux distincts</span>
          </CardHeader>
          <CardContent>
                <p className="text-2xl font-bold tabular-nums">{levelDistributionData.length.toLocaleString('fr-FR')}</p>
                <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Seconde, Première, Terminale, etc.</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <span className="font-semibold text-sm">Classes distinctes</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{classDistributionData.length.toLocaleString('fr-FR')}</p>
            <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>Combinaisons niveau + lettre.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Répartition par niveau</span>
            </div>
          </CardHeader>
          <CardContent>
            {levelDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={levelDistributionData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                    formatter={(value: number, _name: string, props: any) => [`${value} utilisateurs (${formatPercent(props.payload.share)})`, 'Niveau']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {levelDistributionData.map((entry, index) => (
                      <Cell key={entry.label} fill={activityBreakdownColors[index % activityBreakdownColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Répartition par classe (top 12)</span>
            </div>
          </CardHeader>
          <CardContent>
            {classDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={classDistributionData.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 8, left: 20, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                    formatter={(value: number, _name: string, props: any) => [`${value} utilisateurs (${formatPercent(props.payload.share)})`, 'Classe']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3b82f6" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Moyennes par classe (Aura / Argent)</span>
            </div>
          </CardHeader>
          <CardContent>
            {classAveragesData.length > 0 ? (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={classAveragesData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={64} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={(value: number) => formatBigNumber(value)} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem' }}
                      formatter={(value: number, name: string, props: any) => [
                        `${Math.round(value).toLocaleString('fr-FR')} (n=${props.payload.count})`,
                          name === 'avgAura' ? 'Aura moyenne' : 'Argent moyen',
                      ]}
                    />
                    <Bar dataKey="avgAura" name="avgAura" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="avgMoney" name="avgMoney" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {classAveragesData.slice(0, 4).map((entry) => (
                    <div key={entry.label} className="rounded-lg border border-border/40 bg-muted/10 p-3">
                      <p className="text-sm font-medium truncate">{entry.label}</p>
                      <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>n = {entry.count}</p>
                      <p className="text-sm mt-1">Aura moy: <span className="font-semibold tabular-nums">{Math.round(entry.avgAura).toLocaleString('fr-FR')}</span></p>
                      <p className="text-sm">Argent moy: <span className="font-semibold tabular-nums">{Math.round(entry.avgMoney).toLocaleString('fr-FR')}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Top joueurs par niveau (Aura)</span>
            </div>
            <CardDescription>
              Classement interne par niveau scolaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topUsersByLevel.length > 0 ? topUsersByLevel.map((entry) => (
              <div key={entry.level} className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{entry.level}</p>
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>{entry.users.length} affichés</p>
                </div>
                <div className="space-y-1.5">
                  {entry.users.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background font-semibold">
                          {index + 1}
                        </span>
                        <span className="truncate">{member.username}</span>
                      </div>
                      <span className="tabular-nums font-medium">{member.aura.toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Utilisateurs par classe (Aura)</span>
          </div>
          <CardDescription>
            Un tableau par classe avec tous les utilisateurs et leur aura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersByClass.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {usersByClass.map((entry) => (
                <div key={entry.classLabel} className="rounded-lg border border-border/40 bg-muted/10 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
                    <p className="text-sm font-semibold truncate">{entry.classLabel}</p>
                    <p className={cn(TYPOGRAPHY.XS, 'text-muted-foreground')}>{entry.users.length} utilisateur{entry.users.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/30 backdrop-blur">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Utilisateur</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Aura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.users.map((member) => (
                          <tr key={member.id} className="border-t border-border/30">
                            <td className="px-3 py-2">
                              <span className="font-medium">{member.username}</span>
                              {member.firstName ? <span className="text-muted-foreground"> ({member.firstName})</span> : null}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{member.aura.toLocaleString('fr-FR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
