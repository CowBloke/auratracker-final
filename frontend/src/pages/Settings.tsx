import { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Loader2,
  Check,
  User,
  Copy,
  Ticket,
  Keyboard,
  RotateCcw,
  Paintbrush,
  ChevronRight,
  Pencil,
  ChevronLeft,
  Lock,
  Eye,
  EyeOff,
  Volume2,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CenteredSkeletonCard } from '@/components/ui/loading-skeletons';
import {
  CustomThemeConfig,
  DEFAULT_CUSTOM_THEME,
  getCustomThemePreviewVars,
  sanitizeCustomTheme,
} from '@/lib/custom-theme';
import { PageShell } from '@/components/layout/page-shell';
import { ReferralSummary, authApi, usersApi } from '@/services/api';
import ReferralClaimAnimation from '@/components/referrals/ReferralClaimAnimation';
import { toast } from '@/hooks/use-toast';
import {
  useSoundEnabled,
  useSoundVolume,
  setSoundEnabled,
  setSoundVolume,
} from '@/lib/sound-preferences';
import { playNotification, playReward, playClick } from '@/lib/sound-engine';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutCombo,
  getShortcutComboFromEvent,
  resetKeyboardShortcuts,
  updateKeyboardShortcut,
  useKeyboardShortcuts,
  type KeyboardShortcutActionId,
} from '@/lib/keyboard-shortcuts';
import { t } from '@/lib/i18n';

interface ColorSchemeEntry {
  id: string;
  label: string;
}

const CUSTOM_SCHEME_ENTRY: ColorSchemeEntry = { id: 'custom', label: t('settings_custom_scheme_entry') };

function parseRootVars(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const rootStart = css.indexOf(':root');
  if (rootStart === -1) return vars;
  const braceOpen = css.indexOf('{', rootStart);
  if (braceOpen === -1) return vars;
  let depth = 1;
  let i = braceOpen + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  const inner = css.slice(braceOpen + 1, i - 1);
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

type SectionId = 'personnalisation' | 'sons' | 'compte' | 'parrainage' | 'raccourcis';

const SECTIONS: { id: SectionId; label: string; iconBg: string; icon: React.ElementType }[] = [
  { id: 'personnalisation', label: t('settings_appearance_group'), iconBg: 'bg-blue-500', icon: Paintbrush },
  { id: 'sons', label: t('settings_sound_group'), iconBg: 'bg-emerald-500', icon: Volume2 },
  { id: 'compte', label: t('settings_account_group'), iconBg: 'bg-zinc-500', icon: User },
  { id: 'parrainage', label: t('settings_referral_group'), iconBg: 'bg-purple-500', icon: Ticket },
  { id: 'raccourcis', label: t('settings_shortcuts_group'), iconBg: 'bg-indigo-500', icon: Keyboard },
];

/* ─── Primitives ─────────────────────────────────────────────────────────── */

function SettingsGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
      {children}
    </p>
  );
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/40 bg-muted/20', className)}>
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  description,
  children,
  last,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3',
        !last && 'border-b border-border/30'
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}


/* ─── Color Scheme Carousel ──────────────────────────────────────────────── */

function ColorSchemeCarousel({
  colorScheme,
  setColorScheme,
  colorSchemes,
  themeVars,
}: {
  colorScheme: string;
  setColorScheme: (id: string) => void;
  colorSchemes: ColorSchemeEntry[];
  themeVars: Record<string, Record<string, string>>;
}) {
  const n = colorSchemes.length;
  const activeIdx = Math.max(0, colorSchemes.findIndex((s) => s.id === colorScheme));

  const go = (dir: -1 | 1) => {
    setColorScheme(colorSchemes[(activeIdx + dir + n) % n].id);
  };

  const slots = n >= 5 ? [-2, -1, 0, 1, 2] : n === 1 ? [0] : [-1, 0, 1];

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(-1)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5">
        {slots.map((offset) => {
          const idx = (activeIdx + offset + n) % n;
          const scheme = colorSchemes[idx];
          const vars = scheme.id !== 'default' ? themeVars[scheme.id] : undefined;
          const isActive = offset === 0;
          const dist = Math.abs(offset);

          const cardStyle: React.CSSProperties = vars
            ? ({ ...vars, backgroundColor: 'hsl(var(--card))', fontFamily: 'var(--font-sans)' } as React.CSSProperties)
            : { backgroundColor: 'hsl(var(--card))', fontFamily: 'var(--font-sans)' };

          return (
            <button
              key={scheme.id + offset}
              type="button"
              onClick={() => setColorScheme(scheme.id)}
              style={cardStyle}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-xl border transition-all duration-150',
                isActive
                  ? 'w-[76px] border-primary shadow-sm scale-[1.05]'
                  : dist === 1
                    ? 'w-[60px] border-border/40 opacity-60 hover:opacity-90'
                    : 'w-[48px] border-border/25 opacity-35 hover:opacity-60'
              )}
            >
              <div style={{ height: '3px', backgroundColor: 'hsl(var(--primary))' }} />
              <div style={{ padding: '5px 7px 7px' }}>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '4px', alignItems: 'center' }}>
                  <div style={{ height: '4px', width: '16px', borderRadius: '9999px', backgroundColor: 'hsl(var(--primary))' }} />
                  <div style={{ height: '4px', flex: 1, borderRadius: '9999px', backgroundColor: 'hsl(var(--muted))' }} />
                </div>
                <div style={{ height: '3px', width: '60%', borderRadius: '9999px', backgroundColor: 'hsl(var(--muted))' }} />
                {isActive && (
                  <p style={{ marginTop: '5px', fontSize: '9px', fontWeight: 600, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {scheme.label}
                  </p>
                )}
              </div>
              {isActive && (
                <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2 w-2 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ColorSchemeList({
  colorScheme,
  setColorScheme,
  colorSchemes,
}: {
  colorScheme: string;
  setColorScheme: (id: string) => void;
  colorSchemes: ColorSchemeEntry[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colorSchemes.map((scheme) => {
        const active = scheme.id === colorScheme;
        return (
          <button
            key={scheme.id}
            type="button"
            onClick={() => setColorScheme(scheme.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/40 bg-background hover:border-border hover:bg-muted/60'
            )}
          >
            {scheme.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorInputField({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground uppercase">{value}</span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/70 px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 border-border/40 bg-transparent font-mono text-xs uppercase"
        />
      </div>
    </label>
  );
}

function CustomThemeEditor({
  colorScheme,
  setColorScheme,
  customTheme,
  setCustomTheme,
}: {
  colorScheme: string;
  setColorScheme: (id: string) => void;
  customTheme: CustomThemeConfig;
  setCustomTheme: (value: CustomThemeConfig) => void;
}) {
  const updateTheme = (patch: Partial<CustomThemeConfig>) => {
    setCustomTheme(sanitizeCustomTheme({ ...customTheme, ...patch }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('settings_custom_theme_title')}</p>
          <p className="text-xs text-muted-foreground">{t('settings_custom_theme_description')}</p>
        </div>
        <div className="flex gap-2">
          {colorScheme !== 'custom' && (
            <Button size="sm" variant="outline" onClick={() => setColorScheme('custom')}>
              {t('settings_use')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCustomTheme(DEFAULT_CUSTOM_THEME);
              setColorScheme('custom');
            }}
          >
            {t('settings_reset')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ColorInputField
          label={t('settings_primary_color')}
          description={t('settings_primary_color_description')}
          value={customTheme.primary}
          onChange={(primary) => updateTheme({ primary })}
        />
        <ColorInputField
          label={t('settings_accent_color')}
          description={t('settings_accent_color_description')}
          value={customTheme.accent}
          onChange={(accent) => updateTheme({ accent })}
        />
        <ColorInputField
          label={t('settings_light_background')}
          description={t('settings_light_background_description')}
          value={customTheme.backgroundLight}
          onChange={(backgroundLight) => updateTheme({ backgroundLight })}
        />
        <ColorInputField
          label={t('settings_light_cards')}
          description={t('settings_light_cards_description')}
          value={customTheme.surfaceLight}
          onChange={(surfaceLight) => updateTheme({ surfaceLight })}
        />
        <ColorInputField
          label={t('settings_dark_background')}
          description={t('settings_dark_background_description')}
          value={customTheme.backgroundDark}
          onChange={(backgroundDark) => updateTheme({ backgroundDark })}
        />
        <ColorInputField
          label={t('settings_dark_cards')}
          description={t('settings_dark_cards_description')}
          value={customTheme.surfaceDark}
          onChange={(surfaceDark) => updateTheme({ surfaceDark })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t('settings_radius')}</p>
              <p className="text-xs text-muted-foreground">{t('settings_radius_description')}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(customTheme.radius)} px
            </span>
          </div>
          <Slider
            value={[customTheme.radius]}
            min={4}
            max={32}
            step={1}
            onValueChange={([radius]) => updateTheme({ radius })}
          />
        </div>

        <div className="rounded-xl border border-border/40 bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t('settings_shadows')}</p>
              <p className="text-xs text-muted-foreground">{t('settings_shadows_description')}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(customTheme.shadowOpacity * 100)}%
            </span>
          </div>
          <Slider
            value={[customTheme.shadowOpacity]}
            min={0.04}
            max={0.6}
            step={0.01}
            onValueChange={([shadowOpacity]) => updateTheme({ shadowOpacity })}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Sections ────────────────────────────────────────────────────────────── */

function PersonnalisationSection({
  theme,
  setTheme,
  colorScheme,
  setColorScheme,
  colorSchemes,
  themeVars,
  customTheme,
  setCustomTheme,
}: {
  theme: string;
  setTheme: (t: 'light' | 'dark') => void;
  colorScheme: string;
  setColorScheme: (id: string) => void;
  colorSchemes: ColorSchemeEntry[];
  themeVars: Record<string, Record<string, string>>;
  customTheme: CustomThemeConfig;
  setCustomTheme: (value: CustomThemeConfig) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Apparence */}
      <div>
        <SettingsGroupLabel>{t('settings_appearance_group')}</SettingsGroupLabel>
        <SettingsCard>
          <SettingsRow label={t('settings_theme_row')} description={t('settings_theme_row_description')} last>
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Palette */}
      <div>
        <SettingsGroupLabel>{t('settings_palette_group')}</SettingsGroupLabel>
        <SettingsCard>
          <div className="space-y-4 px-4 py-3">
            <ColorSchemeCarousel
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              colorSchemes={colorSchemes}
              themeVars={themeVars}
            />
            <ColorSchemeList
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              colorSchemes={colorSchemes}
            />
            <div className="border-t border-border/30 pt-4">
              <CustomThemeEditor
                colorScheme={colorScheme}
                setColorScheme={setColorScheme}
                customTheme={customTheme}
                setCustomTheme={setCustomTheme}
              />
            </div>
          </div>
        </SettingsCard>
      </div>

    </div>
  );
}

function CompteSection({
  user,
  requestedUsername,
  setRequestedUsername,
  nameChangeReason,
  setNameChangeReason,
  submittingNameChange,
  nameChangeSuccess,
  nameChangeError,
  handleNameChangeSubmit,
}: {
  user: { username?: string } | null;
  requestedUsername: string;
  setRequestedUsername: (v: string) => void;
  nameChangeReason: string;
  setNameChangeReason: (v: string) => void;
  submittingNameChange: boolean;
  nameChangeSuccess: boolean;
  nameChangeError: string | null;
  handleNameChangeSubmit: () => Promise<boolean>;
}) {
  const [nameChangeOpen, setNameChangeOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError(t('settings_password_min_error'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings_password_mismatch_error'));
      return;
    }
    setPasswordSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordChangeOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(t('settings_password_updated_title'), { description: t('settings_password_updated_description'), duration: 3000 });
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || t('settings_password_change_error'));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informations */}
      <div>
        <SettingsGroupLabel>{t('settings_information_group')}</SettingsGroupLabel>
        <SettingsCard>
          <SettingsRow label={t('settings_current_username')} last>
            <span className="text-sm text-muted-foreground">{user?.username ?? '—'}</span>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Compte actions */}
      <div>
        <SettingsGroupLabel>{t('settings_account_group')}</SettingsGroupLabel>
        <SettingsCard>
          <SettingsRow label={t('settings_change_username')} description={t('settings_change_username_description')}>
            {nameChangeSuccess ? (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                {t('settings_name_change_sent')}
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setNameChangeOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {t('settings_request')}
              </Button>
            )}
          </SettingsRow>
          <SettingsRow label={t('settings_change_password')} description={t('settings_change_password_description')}>
            <Button size="sm" variant="outline" onClick={() => setPasswordChangeOpen(true)}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {t('settings_modify')}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Modal: changement de pseudo */}
      <Dialog open={nameChangeOpen} onOpenChange={setNameChangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings_change_username_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">{t('settings_username_change_help')}</p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t('settings_new_username_label')}</label>
              <Input
                value={requestedUsername}
                onChange={(e) => setRequestedUsername(e.target.value)}
                placeholder={t('settings_new_username_placeholder')}
                maxLength={20}
                className="h-9 bg-transparent border-border/40"
              />
              <p className="text-[11px] text-muted-foreground/60">{t('settings_username_rules')}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t('settings_reason_label')}</label>
              <Textarea
                value={nameChangeReason}
                onChange={(e) => setNameChangeReason(e.target.value)}
                placeholder={t('settings_reason_placeholder')}
                maxLength={300}
                rows={3}
                className="resize-none bg-transparent border-border/40"
              />
            </div>
            {nameChangeError && <p className="text-xs text-destructive">{nameChangeError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNameChangeOpen(false)}>
                {t('settings_cancel')}
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await handleNameChangeSubmit();
                  if (ok) setNameChangeOpen(false);
                }}
                disabled={submittingNameChange || requestedUsername.trim().length < 3}
              >
                {submittingNameChange ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings_send_request')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: changement de mot de passe */}
      <Dialog open={passwordChangeOpen} onOpenChange={(open) => {
        setPasswordChangeOpen(open);
        if (!open) { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings_change_password')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t('settings_current_password')}</label>
              <div className="relative">
                <Input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('settings_password_placeholder')}
                  className="h-9 bg-transparent border-border/40 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t('settings_new_password')}</label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings_password_placeholder')}
                  className="h-9 bg-transparent border-border/40 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/60">{t('settings_min_8_chars')}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t('settings_confirm_new_password')}</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings_password_placeholder')}
                className="h-9 bg-transparent border-border/40"
              />
            </div>
            {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPasswordChangeOpen(false)}>
                {t('settings_cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handlePasswordChange}
                disabled={passwordSubmitting || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings_save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParrainageSection({
  referralEnabled,
  referralLoading,
  referralSummary,
  onCopy,
}: {
  referralEnabled: boolean;
  referralLoading: boolean;
  referralSummary: ReferralSummary | null;
  onCopy: () => void;
}) {
  if (!referralEnabled) {
    return (
      <div>
        <SettingsGroupLabel>{t('settings_referral_group')}</SettingsGroupLabel>
        <SettingsCard>
          <div className="px-4 py-4">
            <p className="text-sm font-medium">{t('settings_referral_disabled_title')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('settings_referral_disabled_description')}</p>
          </div>
        </SettingsCard>
      </div>
    );
  }

  if (referralLoading) {
    return (
      <div>
        <SettingsGroupLabel>{t('settings_referral_group')}</SettingsGroupLabel>
        <SettingsCard>
          <div className="px-4 py-4">
            <CenteredSkeletonCard />
          </div>
        </SettingsCard>
      </div>
    );
  }

  if (!referralSummary) {
    return (
      <div>
        <SettingsGroupLabel>{t('settings_referral_group')}</SettingsGroupLabel>
        <SettingsCard>
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground">{t('settings_referral_unavailable')}</p>
          </div>
        </SettingsCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Code */}
      <div>
        <SettingsGroupLabel>{t('settings_your_code')}</SettingsGroupLabel>
        <SettingsCard>
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('settings_referral_code')}</p>
                  <p className="font-mono text-base font-semibold tracking-[0.25em]">
                    {referralSummary.referralCode}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 border border-border/40">
                +{referralSummary.rewardAmount} chacun
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCopy}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                {t('settings_copy')}
              </Button>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Stats */}
      <div>
        <SettingsGroupLabel>{t('settings_statistics')}</SettingsGroupLabel>
        <SettingsCard>
          <SettingsRow label={t('settings_validated_referrals')}>
            <span className="text-sm font-semibold tabular-nums">
              {referralSummary.successfulReferrals}
            </span>
          </SettingsRow>
          <SettingsRow label={t('settings_pending')}>
            <span className="text-sm font-semibold tabular-nums">
              {referralSummary.pendingReferrals}
            </span>
          </SettingsRow>
          <SettingsRow label={t('settings_rewards_earned')} last>
            <span className="text-sm font-semibold tabular-nums">
              {referralSummary.totalRewardsEarned}
            </span>
          </SettingsRow>
        </SettingsCard>
      </div>
    </div>
  );
}

function RaccourcisSection({
  keyboardShortcuts,
  capturingShortcutId,
  onCapture,
  onKeyDown,
  onReset,
  onResetAll,
}: {
  keyboardShortcuts: ReturnType<typeof useKeyboardShortcuts>;
  capturingShortcutId: KeyboardShortcutActionId | null;
  onCapture: (id: KeyboardShortcutActionId) => void;
  onKeyDown: (id: KeyboardShortcutActionId, e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onReset: (id: KeyboardShortcutActionId) => void;
  onResetAll: () => void;
}) {
  const getDefault = (id: KeyboardShortcutActionId) =>
    DEFAULT_KEYBOARD_SHORTCUTS.find((s) => s.id === id);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <SettingsGroupLabel>{t('settings_shortcuts_group')}</SettingsGroupLabel>
          <button
            type="button"
            onClick={onResetAll}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            {t('settings_reset_all')}
          </button>
        </div>

        <div className="space-y-2">
          {keyboardShortcuts.map((shortcut) => {
            const defaultShortcut = getDefault(shortcut.id);
            const isCapturing = capturingShortcutId === shortcut.id;
            const isCustomized =
              shortcut.combo !== defaultShortcut?.combo ||
              shortcut.enabled !== defaultShortcut?.enabled;

            return (
              <SettingsCard key={shortcut.id}>
                <div className="px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Label + description */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{shortcut.label}</p>
                        {isCustomized && (
                          <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                            {t('settings_modified')}
                          </Badge>
                        )}
                        {!shortcut.enabled && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                            {t('settings_disabled')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{shortcut.description}</p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <code className="rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 font-mono text-[11px]">
                          {formatShortcutCombo(shortcut.combo)}
                        </code>
                        {defaultShortcut && isCustomized && (
                          <>
                            <ChevronRight className="h-3 w-3 text-muted-foreground/50 rotate-180" />
                            <code className="rounded-md border border-border/30 bg-muted/20 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {formatShortcutCombo(defaultShortcut.combo)}
                            </code>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">{t('settings_active')}</span>
                        <Switch
                          checked={shortcut.enabled}
                          onCheckedChange={(enabled) =>
                            updateKeyboardShortcut(shortcut.id, { enabled })
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        variant={isCapturing ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onCapture(shortcut.id)}
                        onKeyDown={(e) => {
                          if (isCapturing) onKeyDown(shortcut.id, e);
                        }}
                        className="text-xs"
                      >
                        {isCapturing ? t('settings_press_shortcut') : t('settings_modify')}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onReset(shortcut.id)}
                        className="text-xs"
                      >
                        {t('settings_default')}
                      </Button>
                    </div>
                  </div>
                </div>
              </SettingsCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Sons ────────────────────────────────────────────────────────────────── */

function SonsSection() {
  const soundEnabled = useSoundEnabled();
  const soundVolume = useSoundVolume();

  const PREVIEWS: { label: string; fn: () => void }[] = [
    { label: t('settings_notification'), fn: playNotification },
    { label: t('settings_reward'), fn: playReward },
    { label: t('settings_click'), fn: playClick },
  ];

  return (
    <div className="space-y-6">
      <div>
        <SettingsGroupLabel>{t('settings_sound_group')}</SettingsGroupLabel>
        <SettingsCard>
          <SettingsRow
            label={t('settings_sounds_enabled')}
            description={t('settings_sounds_enabled_description')}
          >
            <Switch
              checked={soundEnabled}
              onCheckedChange={(v) => setSoundEnabled(v)}
            />
          </SettingsRow>
          <SettingsRow
            label={t('settings_volume')}
            description={t('settings_volume_description')}
            last
          >
            <div className="flex w-36 items-center gap-2">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(soundVolume * 100)]}
                onValueChange={([v]) => setSoundVolume(v / 100)}
                disabled={!soundEnabled}
                className="flex-1"
              />
              <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                {Math.round(soundVolume * 100)}%
              </span>
            </div>
          </SettingsRow>
        </SettingsCard>
      </div>

      <div>
        <SettingsGroupLabel>{t('settings_preview_group')}</SettingsGroupLabel>
        <SettingsCard>
          {PREVIEWS.map(({ label, fn }, i) => (
            <SettingsRow
              key={label}
              label={label}
              description={t('settings_click_to_listen')}
              last={i === PREVIEWS.length - 1}
            >
              <Button
                size="sm"
                variant="outline"
                disabled={!soundEnabled}
                onClick={fn}
              >
                {t('settings_listen')}
              </Button>
            </SettingsRow>
          ))}
        </SettingsCard>
      </div>
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

export default function Settings() {
  const { theme, setTheme, colorScheme, setColorScheme, customTheme, setCustomTheme } =
    useTheme();
  const { user } = useAuth();
  const { maintenanceStatus } = useFeatures();
  const [activeSection, setActiveSection] = useState<SectionId>('personnalisation');
  const [colorSchemes, setColorSchemes] = useState<ColorSchemeEntry[]>([
    { id: 'default', label: t('settings_default') },
  ]);
  const [themeVars, setThemeVars] = useState<Record<string, Record<string, string>>>({});
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralClaimOpen, setReferralClaimOpen] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const keyboardShortcuts = useKeyboardShortcuts();
  const [capturingShortcutId, setCapturingShortcutId] = useState<KeyboardShortcutActionId | null>(
    null
  );

  const [requestedUsername, setRequestedUsername] = useState('');
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [submittingNameChange, setSubmittingNameChange] = useState(false);
  const [nameChangeSuccess, setNameChangeSuccess] = useState(false);
  const [nameChangeError, setNameChangeError] = useState<string | null>(null);
  const referralEnabled = maintenanceStatus.referralEnabled;

  useEffect(() => {
    fetch('/themes/manifest.json')
      .then((r) => r.json())
      .then((data: ColorSchemeEntry[]) => {
        const schemes = data.some((scheme) => scheme.id === CUSTOM_SCHEME_ENTRY.id)
          ? data
          : [...data, CUSTOM_SCHEME_ENTRY];
        setColorSchemes(schemes);
        schemes.forEach(async (scheme) => {
          if (scheme.id === 'default') return;
          if (scheme.id === CUSTOM_SCHEME_ENTRY.id) return;
          try {
            const css = await fetch(`/themes/${scheme.id}.css`).then((r) => r.text());
            const vars = parseRootVars(css);
            if (Object.keys(vars).length > 0) {
              setThemeVars((prev) => ({ ...prev, [scheme.id]: vars }));
            }
          } catch {
            // ignore
          }
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setThemeVars((prev) => ({
      ...prev,
      [CUSTOM_SCHEME_ENTRY.id]: getCustomThemePreviewVars(customTheme),
    }));
  }, [customTheme]);

  useEffect(() => {
    if (!referralEnabled) {
      setReferralSummary(null);
      return;
    }
    let cancelled = false;
    setReferralLoading(true);
    authApi
      .getReferralSummary()
      .then((res) => {
        if (!cancelled) setReferralSummary(res.data);
      })
      .catch(() => {
        if (!cancelled) setReferralSummary(null);
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [referralEnabled]);

  const handleNameChangeSubmit = async (): Promise<boolean> => {
    if (!requestedUsername.trim()) return false;
    setSubmittingNameChange(true);
    setNameChangeError(null);
    try {
      await usersApi.requestNameChange({
        requestedUsername: requestedUsername.trim(),
        reason: nameChangeReason.trim() || undefined,
      });
      setNameChangeSuccess(true);
      setRequestedUsername('');
      setNameChangeReason('');
      return true;
    } catch (err: any) {
      setNameChangeError(err.response?.data?.error || "Erreur lors de l'envoi");
      return false;
    } finally {
      setSubmittingNameChange(false);
    }
  };

  const handleReferralCopy = async () => {
    if (!referralSummary?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referralSummary.referralCode);
      toast(t('settings_code_copied'), {
        description: `${referralSummary.referralCode} ${t('settings_code_ready_suffix')}`,
        duration: 3000,
      });
    } catch {
      toast(t('settings_copy_failed_title'), {
        description: t('settings_copy_failed_description'),
        duration: 3000,
      });
    }
  };

  const handleShortcutCapture = (shortcutId: KeyboardShortcutActionId) => {
    setCapturingShortcutId(shortcutId);
  };

  const handleShortcutKeyDown = (
    shortcutId: KeyboardShortcutActionId,
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    if (event.key === 'Escape') {
      setCapturingShortcutId(null);
      return;
    }
    const combo = getShortcutComboFromEvent(event);
    if (!combo) {
      toast(t('settings_shortcut_invalid'), {
        description: t('settings_shortcut_invalid_description'),
        duration: 3000,
      });
      return;
    }
    updateKeyboardShortcut(shortcutId, { combo, enabled: true });
    setCapturingShortcutId(null);
    toast(t('settings_shortcut_updated'), {
      description: `${t('settings_shortcut_updated_prefix')} ${formatShortcutCombo(combo)}.`,
      duration: 3000,
    });
  };

  const handleShortcutReset = (shortcutId: KeyboardShortcutActionId) => {
    const def = DEFAULT_KEYBOARD_SHORTCUTS.find((s) => s.id === shortcutId);
    if (!def) return;
    updateKeyboardShortcut(shortcutId, { combo: def.combo, enabled: def.enabled });
  };

  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label ?? '';

  return (
    <PageShell size="wide">
      <div className="flex gap-0 min-h-[560px]">
        {/* ── Apple-style settings sidebar ─────────────────────────── */}
        <aside className="w-52 shrink-0 pr-2">
          {/* User card */}
          {user && (
            <div className="mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.username}</p>
                <p className="text-xs text-muted-foreground">{t('settings_account_group')}</p>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="space-y-0.5">
            {SECTIONS.map(({ id, label, iconBg, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
                      iconBg
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ───────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 pl-8">
          {/* Section title */}
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">{activeLabel}</h2>

          {activeSection === 'personnalisation' && (
            <PersonnalisationSection
              theme={theme}
              setTheme={setTheme}
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              colorSchemes={colorSchemes}
              themeVars={themeVars}
              customTheme={customTheme}
              setCustomTheme={setCustomTheme}
            />
          )}

          {activeSection === 'sons' && <SonsSection />}

          {activeSection === 'compte' && (
            <CompteSection
              user={user}
              requestedUsername={requestedUsername}
              setRequestedUsername={setRequestedUsername}
              nameChangeReason={nameChangeReason}
              setNameChangeReason={setNameChangeReason}
              submittingNameChange={submittingNameChange}
              nameChangeSuccess={nameChangeSuccess}
              nameChangeError={nameChangeError}
              handleNameChangeSubmit={handleNameChangeSubmit}
            />
          )}

          {activeSection === 'parrainage' && (
            <ParrainageSection
              referralEnabled={referralEnabled}
              referralLoading={referralLoading}
              referralSummary={referralSummary}
              onCopy={handleReferralCopy}
            />
          )}

          {activeSection === 'raccourcis' && (
            <RaccourcisSection
              keyboardShortcuts={keyboardShortcuts}
              capturingShortcutId={capturingShortcutId}
              onCapture={handleShortcutCapture}
              onKeyDown={handleShortcutKeyDown}
              onReset={handleShortcutReset}
              onResetAll={() => {
                resetKeyboardShortcuts();
                setCapturingShortcutId(null);
              }}
            />
          )}
        </div>
      </div>

      {referralSummary && (
        <ReferralClaimAnimation
          open={referralClaimOpen}
          code={referralSummary.referralCode}
          rewardAmount={referralSummary.rewardAmount}
          successfulReferrals={referralSummary.successfulReferrals}
          onClose={() => setReferralClaimOpen(false)}
        />
      )}
    </PageShell>
  );
}
