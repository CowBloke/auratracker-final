import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import type { Settings } from '@/types'
import { X, Pin } from 'lucide-react'

const ACCENT_COLORS = [
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Bleu', value: '#2563eb' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Vert', value: '#059669' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Rose', value: '#db2777' },
  { label: 'Rouge', value: '#dc2626' },
]

const THEMES = [
  { label: 'Dark', value: 'dark' as const },
  { label: 'Darker', value: 'darker' as const },
  { label: 'Midnight', value: 'midnight' as const },
  { label: 'Slate', value: 'slate' as const },
]

interface Props {
  settings: Settings
  onChange: (s: Partial<Settings>) => void
  allUsers: string[]
}

export function SettingsPanel({ settings, onChange, allUsers }: Props) {
  const toggleUser = (user: string) => {
    const next = settings.highlightedUsers.includes(user)
      ? settings.highlightedUsers.filter((u) => u !== user)
      : [...settings.highlightedUsers, user]
    onChange({ highlightedUsers: next })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 text-sm">
      {/* Affichage */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
          Affichage
        </h3>
        <div className="space-y-3">
          <SettingRow label="Mode condensé" description="Réduit l'espacement">
            <Switch checked={settings.condensed} onCheckedChange={(v) => onChange({ condensed: v })} />
          </SettingRow>
          <SettingRow label="Horodatage" description="Affiche l'heure">
            <Switch checked={settings.showTimestamps} onCheckedChange={(v) => onChange({ showTimestamps: v })} />
          </SettingRow>
          <SettingRow label="Images" description="Affiche les images">
            <Switch checked={settings.showImages} onCheckedChange={(v) => onChange({ showImages: v })} />
          </SettingRow>
          <SettingRow label="Messages système" description="Événements automatiques">
            <Switch
              checked={settings.showSystemMessages}
              onCheckedChange={(v) => onChange({ showSystemMessages: v })}
            />
          </SettingRow>
          <SettingRow label="Grouper les messages" description="Regrouper par utilisateur">
            <Switch checked={settings.groupMessages} onCheckedChange={(v) => onChange({ groupMessages: v })} />
          </SettingRow>
          <SettingRow label={<><Pin className="inline w-3.5 h-3.5 mr-1" />Épinglés seulement</>}>
            <Switch checked={settings.pinnedOnly} onCheckedChange={(v) => onChange({ pinnedOnly: v })} />
          </SettingRow>
        </div>
      </section>

      <Separator />

      {/* Apparence */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
          Apparence
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">
              Taille de police — <span className="text-[hsl(var(--primary))]">{settings.fontSize}px</span>
            </Label>
            <Slider
              min={11}
              max={18}
              step={1}
              value={[settings.fontSize]}
              onValueChange={([v]) => onChange({ fontSize: v })}
            />
          </div>

          <div>
            <Label className="mb-2 block">Thème</Label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <Button
                  key={t.value}
                  variant={settings.theme === t.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChange({ theme: t.value })}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Couleur d'accent</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => onChange({ accentColor: c.value })}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: settings.accentColor === c.value ? 'white' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Mise en avant */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">
          Mettre en avant
        </h3>
        <p className="text-[hsl(var(--muted-foreground))] text-xs mb-3">
          Cliquez sur un utilisateur pour le mettre en surbrillance.
        </p>
        <div className="flex flex-wrap gap-2">
          {allUsers.map((user) => {
            const active = settings.highlightedUsers.includes(user)
            return (
              <button key={user} onClick={() => toggleUser(user)}>
                <Badge
                  variant={active ? 'default' : 'secondary'}
                  className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                >
                  {user}
                  {active && <X className="w-3 h-3" />}
                </Badge>
              </button>
            )
          })}
        </div>
        {settings.highlightedUsers.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-[hsl(var(--muted-foreground))]"
            onClick={() => onChange({ highlightedUsers: [] })}
          >
            Tout effacer
          </Button>
        )}
      </section>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: React.ReactNode
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[hsl(var(--foreground))]">{label}</div>
        {description && <div className="text-xs text-[hsl(var(--muted-foreground))]">{description}</div>}
      </div>
      {children}
    </div>
  )
}
