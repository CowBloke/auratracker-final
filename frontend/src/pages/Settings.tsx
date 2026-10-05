import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, Moon, RotateCcw, Sun, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import ReferralClaimAnimation from '@/components/referrals/ReferralClaimAnimation';
import {
  ReferralSummary,
  authApi,
  usersApi,
  notificationsApi,
  type NotificationCategoryId,
  type NotificationPreferences,
} from '@/services/api';
import { useSoundEnabled, useSoundVolume, setSoundEnabled, setSoundVolume } from '@/lib/sound-preferences';
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

/* ─── Apparence ──────────────────────────────────────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings_appearance_group')}</CardTitle>
        <CardDescription>{t('settings_theme_row_description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="theme-switch">{t('settings_theme_row')}</FieldLabel>
            <FieldDescription className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {theme === 'dark' ? 'Mode sombre' : 'Mode clair'}
            </FieldDescription>
          </FieldContent>
          <Switch
            id="theme-switch"
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

/* ─── Sons ───────────────────────────────────────────────────────────────── */

function SoundSection() {
  const soundEnabled = useSoundEnabled();
  const soundVolume = useSoundVolume();

  const previews: { label: string; play: () => void }[] = [
    { label: t('settings_notification'), play: playNotification },
    { label: t('settings_reward'), play: playReward },
    { label: t('settings_click'), play: playClick },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings_sound_group')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="sounds-enabled">{t('settings_sounds_enabled')}</FieldLabel>
                <FieldDescription>{t('settings_sounds_enabled_description')}</FieldDescription>
              </FieldContent>
              <Switch id="sounds-enabled" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </Field>
            <FieldSeparator />
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="sound-volume">{t('settings_volume')}</FieldLabel>
                <span className="text-sm tabular-nums text-muted-foreground">{Math.round(soundVolume * 100)}%</span>
              </div>
              <Slider
                id="sound-volume"
                min={0}
                max={100}
                step={1}
                value={[Math.round(soundVolume * 100)]}
                onValueChange={([value]) => setSoundVolume(value / 100)}
                disabled={!soundEnabled}
              />
              <FieldDescription>{t('settings_volume_description')}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings_preview_group')}</CardTitle>
          <CardDescription>{t('settings_click_to_listen')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            {previews.map(({ label, play }, index) => (
              <div key={label}>
                {index > 0 ? <ItemSeparator /> : null}
                <Item>
                  <ItemContent>
                    <ItemTitle>{label}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Button size="sm" variant="outline" disabled={!soundEnabled} onClick={play}>
                      {t('settings_listen')}
                    </Button>
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Notifications ──────────────────────────────────────────────────────── */

const NOTIF_CATEGORIES: { id: NotificationCategoryId; label: string; description: string }[] = [
  { id: 'aura', label: t('settings_notif_cat_aura'), description: t('settings_notif_cat_aura_desc') },
  { id: 'clans', label: t('settings_notif_cat_clans'), description: t('settings_notif_cat_clans_desc') },
  { id: 'social', label: t('settings_notif_cat_social'), description: t('settings_notif_cat_social_desc') },
  { id: 'quetes', label: t('settings_notif_cat_quetes'), description: t('settings_notif_cat_quetes_desc') },
  { id: 'polymarket', label: t('settings_notif_cat_polymarket'), description: t('settings_notif_cat_polymarket_desc') },
  { id: 'systeme', label: t('settings_notif_cat_systeme'), description: t('settings_notif_cat_systeme_desc') },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .getPreferences()
      .then((res) => {
        if (!cancelled) setPrefs(res.data.preferences);
      })
      .catch(() => {
        if (!cancelled) setPrefs(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (id: NotificationCategoryId, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [id]: value };
    setPrefs(next);
    try {
      await notificationsApi.updatePreferences(next);
    } catch {
      setPrefs(previous);
      toast.error(t('settings_notifications_save_error'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings_notifications_section_label')}</CardTitle>
        <CardDescription>{t('settings_notifications_section_description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !prefs ? (
          <div className="flex flex-col gap-4">
            {NOTIF_CATEGORIES.map((category) => (
              <Skeleton key={category.id} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <FieldGroup>
            {NOTIF_CATEGORIES.map((category, index) => (
              <div key={category.id} className="flex flex-col gap-6">
                {index > 0 ? <FieldSeparator /> : null}
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={`notif-${category.id}`}>{category.label}</FieldLabel>
                    <FieldDescription>{category.description}</FieldDescription>
                  </FieldContent>
                  <Switch
                    id={`notif-${category.id}`}
                    checked={prefs[category.id]}
                    onCheckedChange={(value) => toggle(category.id, value)}
                  />
                </Field>
              </div>
            ))}
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Compte ─────────────────────────────────────────────────────────────── */

type AccountSectionProps = {
  username?: string;
  requestedUsername: string;
  setRequestedUsername: (value: string) => void;
  nameChangeReason: string;
  setNameChangeReason: (value: string) => void;
  submittingNameChange: boolean;
  nameChangeSuccess: boolean;
  nameChangeError: string | null;
  handleNameChangeSubmit: () => Promise<boolean>;
};

function AccountSection({
  username,
  requestedUsername,
  setRequestedUsername,
  nameChangeReason,
  setNameChangeReason,
  submittingNameChange,
  nameChangeSuccess,
  nameChangeError,
  handleNameChangeSubmit,
}: AccountSectionProps) {
  const [nameChangeOpen, setNameChangeOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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
      toast.success(t('settings_password_updated_title'), { description: t('settings_password_updated_description') });
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || t('settings_password_change_error'));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings_account_group')}</CardTitle>
          <CardDescription>
            {t('settings_current_username')} : <span className="font-medium text-foreground">{username ?? '—'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <Item>
              <ItemContent>
                <ItemTitle>{t('settings_change_username')}</ItemTitle>
                <ItemDescription>{t('settings_change_username_description')}</ItemDescription>
              </ItemContent>
              <ItemActions>
                {nameChangeSuccess ? (
                  <Badge variant="secondary">{t('settings_name_change_sent')}</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setNameChangeOpen(true)}>
                    {t('settings_request')}
                  </Button>
                )}
              </ItemActions>
            </Item>
            <ItemSeparator />
            <Item>
              <ItemContent>
                <ItemTitle>{t('settings_change_password')}</ItemTitle>
                <ItemDescription>{t('settings_change_password_description')}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm" variant="outline" onClick={() => setPasswordChangeOpen(true)}>
                  {t('settings_modify')}
                </Button>
              </ItemActions>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>

      <Dialog open={nameChangeOpen} onOpenChange={setNameChangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings_change_username_title')}</DialogTitle>
            <DialogDescription>{t('settings_username_change_help')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="requested-username">{t('settings_new_username_label')}</FieldLabel>
              <Input
                id="requested-username"
                value={requestedUsername}
                onChange={(event) => setRequestedUsername(event.target.value)}
                placeholder={t('settings_new_username_placeholder')}
                maxLength={20}
              />
              <FieldDescription>{t('settings_username_rules')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="name-change-reason">{t('settings_reason_label')}</FieldLabel>
              <Textarea
                id="name-change-reason"
                value={nameChangeReason}
                onChange={(event) => setNameChangeReason(event.target.value)}
                placeholder={t('settings_reason_placeholder')}
                maxLength={300}
                rows={3}
              />
            </Field>
            {nameChangeError ? (
              <Alert variant="destructive">
                <AlertDescription>{nameChangeError}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameChangeOpen(false)}>
              {t('settings_cancel')}
            </Button>
            <Button
              onClick={async () => {
                const ok = await handleNameChangeSubmit();
                if (ok) setNameChangeOpen(false);
              }}
              disabled={submittingNameChange || requestedUsername.trim().length < 3}
            >
              {submittingNameChange ? <Spinner /> : t('settings_send_request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordChangeOpen}
        onOpenChange={(open) => {
          setPasswordChangeOpen(open);
          if (!open) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings_change_password')}</DialogTitle>
            <DialogDescription>{t('settings_change_password_description')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">{t('settings_current_password')}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder={t('settings_password_placeholder')}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={showCurrentPassword ? 'Masquer' : 'Afficher'}
                    onClick={() => setShowCurrentPassword((value) => !value)}
                  >
                    {showCurrentPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">{t('settings_new_password')}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t('settings_password_placeholder')}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={showNewPassword ? 'Masquer' : 'Afficher'}
                    onClick={() => setShowNewPassword((value) => !value)}
                  >
                    {showNewPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>{t('settings_min_8_chars')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">{t('settings_confirm_new_password')}</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t('settings_password_placeholder')}
              />
            </Field>
            {passwordError ? (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordChangeOpen(false)}>
              {t('settings_cancel')}
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={passwordSubmitting || !currentPassword || !newPassword || !confirmPassword}
            >
              {passwordSubmitting ? <Spinner /> : t('settings_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Parrainage ─────────────────────────────────────────────────────────── */

type ReferralSectionProps = {
  referralEnabled: boolean;
  referralLoading: boolean;
  referralSummary: ReferralSummary | null;
  onCopy: () => void;
};

function ReferralSection({ referralEnabled, referralLoading, referralSummary, onCopy }: ReferralSectionProps) {
  if (!referralEnabled) {
    return (
      <Alert>
        <Ticket />
        <AlertTitle>{t('settings_referral_disabled_title')}</AlertTitle>
        <AlertDescription>{t('settings_referral_disabled_description')}</AlertDescription>
      </Alert>
    );
  }

  if (referralLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!referralSummary) {
    return (
      <Alert>
        <Ticket />
        <AlertDescription>{t('settings_referral_unavailable')}</AlertDescription>
      </Alert>
    );
  }

  const stats = [
    { label: t('settings_validated_referrals'), value: referralSummary.successfulReferrals },
    { label: t('settings_pending'), value: referralSummary.pendingReferrals },
    { label: t('settings_rewards_earned'), value: referralSummary.totalRewardsEarned },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings_your_code')}</CardTitle>
          <CardDescription>
            <Badge variant="secondary">+{referralSummary.rewardAmount} chacun</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl font-semibold">{referralSummary.referralCode}</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy />
            {t('settings_copy')}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings_statistics')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            {stats.map((stat, index) => (
              <div key={stat.label}>
                {index > 0 ? <ItemSeparator /> : null}
                <Item>
                  <ItemContent>
                    <ItemTitle>{stat.label}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <span className="font-semibold tabular-nums">{stat.value}</span>
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Raccourcis ─────────────────────────────────────────────────────────── */

type ShortcutsSectionProps = {
  keyboardShortcuts: ReturnType<typeof useKeyboardShortcuts>;
  capturingShortcutId: KeyboardShortcutActionId | null;
  onCapture: (id: KeyboardShortcutActionId) => void;
  onKeyDown: (id: KeyboardShortcutActionId, event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onReset: (id: KeyboardShortcutActionId) => void;
  onResetAll: () => void;
};

function ShortcutsSection({
  keyboardShortcuts,
  capturingShortcutId,
  onCapture,
  onKeyDown,
  onReset,
  onResetAll,
}: ShortcutsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings_shortcuts_group')}</CardTitle>
        <CardDescription>
          <Button variant="ghost" size="sm" onClick={onResetAll}>
            <RotateCcw />
            {t('settings_reset_all')}
          </Button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {keyboardShortcuts.map((shortcut, index) => {
            const defaultShortcut = DEFAULT_KEYBOARD_SHORTCUTS.find((entry) => entry.id === shortcut.id);
            const isCapturing = capturingShortcutId === shortcut.id;
            const isCustomized =
              shortcut.combo !== defaultShortcut?.combo || shortcut.enabled !== defaultShortcut?.enabled;

            return (
              <div key={shortcut.id}>
                {index > 0 ? <ItemSeparator /> : null}
                <Item>
                  <ItemContent>
                    <ItemTitle>
                      {shortcut.label}
                      {isCustomized ? <Badge>{t('settings_modified')}</Badge> : null}
                      {!shortcut.enabled ? <Badge variant="outline">{t('settings_disabled')}</Badge> : null}
                    </ItemTitle>
                    <ItemDescription>{shortcut.description}</ItemDescription>
                    <div className="flex items-center gap-2 pt-1">
                      <Kbd>{formatShortcutCombo(shortcut.combo)}</Kbd>
                      {defaultShortcut && isCustomized ? (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {t('settings_default')} : <Kbd>{formatShortcutCombo(defaultShortcut.combo)}</Kbd>
                        </span>
                      ) : null}
                    </div>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      checked={shortcut.enabled}
                      aria-label={t('settings_active')}
                      onCheckedChange={(enabled) => updateKeyboardShortcut(shortcut.id, { enabled })}
                    />
                    <Button
                      type="button"
                      variant={isCapturing ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onCapture(shortcut.id)}
                      onKeyDown={(event) => {
                        if (isCapturing) onKeyDown(shortcut.id, event);
                      }}
                    >
                      {isCapturing ? t('settings_press_shortcut') : t('settings_modify')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onReset(shortcut.id)}>
                      {t('settings_default')}
                    </Button>
                  </ItemActions>
                </Item>
              </div>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function Settings() {
  const { user } = useAuth();
  const { maintenanceStatus } = useFeatures();
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralClaimOpen, setReferralClaimOpen] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const keyboardShortcuts = useKeyboardShortcuts();
  const [capturingShortcutId, setCapturingShortcutId] = useState<KeyboardShortcutActionId | null>(null);

  const [requestedUsername, setRequestedUsername] = useState('');
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [submittingNameChange, setSubmittingNameChange] = useState(false);
  const [nameChangeSuccess, setNameChangeSuccess] = useState(false);
  const [nameChangeError, setNameChangeError] = useState<string | null>(null);
  const referralEnabled = maintenanceStatus.referralEnabled;

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
      toast.success(t('settings_code_copied'), {
        description: `${referralSummary.referralCode} ${t('settings_code_ready_suffix')}`,
      });
    } catch {
      toast.error(t('settings_copy_failed_title'), { description: t('settings_copy_failed_description') });
    }
  };

  const handleShortcutKeyDown = (shortcutId: KeyboardShortcutActionId, event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.key === 'Escape') {
      setCapturingShortcutId(null);
      return;
    }
    const combo = getShortcutComboFromEvent(event);
    if (!combo) {
      toast.error(t('settings_shortcut_invalid'), { description: t('settings_shortcut_invalid_description') });
      return;
    }
    updateKeyboardShortcut(shortcutId, { combo, enabled: true });
    setCapturingShortcutId(null);
    toast.success(t('settings_shortcut_updated'), {
      description: `${t('settings_shortcut_updated_prefix')} ${formatShortcutCombo(combo)}.`,
    });
  };

  const handleShortcutReset = (shortcutId: KeyboardShortcutActionId) => {
    const defaultShortcut = DEFAULT_KEYBOARD_SHORTCUTS.find((entry) => entry.id === shortcutId);
    if (!defaultShortcut) return;
    updateKeyboardShortcut(shortcutId, { combo: defaultShortcut.combo, enabled: defaultShortcut.enabled });
  };

  return (
    <PageShell>
      <PageHeader title="Réglages" description="Apparence, sons, notifications, compte, parrainage et raccourcis." />

      <Tabs defaultValue="apparence" className="gap-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="apparence">{t('settings_appearance_group')}</TabsTrigger>
          <TabsTrigger value="sons">{t('settings_sound_group')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings_notifications_group')}</TabsTrigger>
          <TabsTrigger value="compte">{t('settings_account_group')}</TabsTrigger>
          <TabsTrigger value="parrainage">{t('settings_referral_group')}</TabsTrigger>
          <TabsTrigger value="raccourcis">{t('settings_shortcuts_group')}</TabsTrigger>
        </TabsList>

        <TabsContent value="apparence">
          <AppearanceSection />
        </TabsContent>
        <TabsContent value="sons">
          <SoundSection />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsSection />
        </TabsContent>
        <TabsContent value="compte">
          <AccountSection
            username={user?.username}
            requestedUsername={requestedUsername}
            setRequestedUsername={setRequestedUsername}
            nameChangeReason={nameChangeReason}
            setNameChangeReason={setNameChangeReason}
            submittingNameChange={submittingNameChange}
            nameChangeSuccess={nameChangeSuccess}
            nameChangeError={nameChangeError}
            handleNameChangeSubmit={handleNameChangeSubmit}
          />
        </TabsContent>
        <TabsContent value="parrainage">
          <ReferralSection
            referralEnabled={referralEnabled}
            referralLoading={referralLoading}
            referralSummary={referralSummary}
            onCopy={handleReferralCopy}
          />
        </TabsContent>
        <TabsContent value="raccourcis">
          <ShortcutsSection
            keyboardShortcuts={keyboardShortcuts}
            capturingShortcutId={capturingShortcutId}
            onCapture={setCapturingShortcutId}
            onKeyDown={handleShortcutKeyDown}
            onReset={handleShortcutReset}
            onResetAll={() => {
              resetKeyboardShortcuts();
              setCapturingShortcutId(null);
            }}
          />
        </TabsContent>
      </Tabs>

      {referralSummary ? (
        <ReferralClaimAnimation
          open={referralClaimOpen}
          code={referralSummary.referralCode}
          rewardAmount={referralSummary.rewardAmount}
          successfulReferrals={referralSummary.successfulReferrals}
          onClose={() => setReferralClaimOpen(false)}
        />
      ) : null}
    </PageShell>
  );
}
