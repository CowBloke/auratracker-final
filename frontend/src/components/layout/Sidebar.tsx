import { useState, type ComponentProps, type ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BadgeDollarSign,
  BarChart3,
  Backpack,
  BookOpen,
  Bug,
  Flag,
  Gamepad2,
  Grid3X3,
  Hammer,
  Info,
  Lightbulb,
  LayoutDashboard,
  Map,
  MessagesSquare,
  ShoppingBasket,
  Store,
  Target,
  Trophy,
  Users,
  Workflow,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { UserAccountMenu } from '@/components/UserAccountMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BLOCKABLE_PAGES } from '@/config/blockedPages';
import { t } from '@/lib/i18n';
import BugReportPanel from './BugReportPanel';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType;
  tutorialId?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Plateforme',
    items: [
      { to: '/dashboard', label: t('sidebar_dashboard'), icon: LayoutDashboard, tutorialId: 'nav-dashboard' },
      { to: '/games', label: t('sidebar_games'), icon: Gamepad2, tutorialId: 'nav-games' },
      { to: '/leaderboards', label: t('sidebar_nav_leaderboard'), icon: Trophy, tutorialId: 'nav-leaderboards' },
      { to: '/quests', label: t('sidebar_nav_quests'), icon: Target, tutorialId: 'nav-quests' },
      { to: '/party', label: t('sidebar_nav_party'), icon: Users, tutorialId: 'nav-party' },
      { to: '/clans', label: t('sidebar_nav_clans'), icon: Flag, tutorialId: 'nav-clans' },
    ],
  },
  {
    label: 'Économie',
    items: [
      { to: '/market', label: t('sidebar_nav_shop'), icon: Store, tutorialId: 'nav-market' },
      { to: '/marketplace', label: t('sidebar_nav_marketplace'), icon: BadgeDollarSign, tutorialId: 'nav-marketplace' },
      { to: '/inventory', label: t('sidebar_nav_inventory'), icon: Backpack, tutorialId: 'nav-inventory' },
      { to: '/polymarket', label: t('sidebar_polymarket'), icon: BarChart3, tutorialId: 'nav-polymarket' },
    ],
  },
  {
    label: 'Communauté',
    items: [
      { to: '/forum', label: 'Forum', icon: MessagesSquare, tutorialId: 'nav-forum' },
      { to: '/pixel-board', label: 'Pixel Board', icon: Grid3X3 },
      { to: '/suggestions', label: t('sidebar_nav_suggestions'), icon: Lightbulb, tutorialId: 'nav-suggestions' },
    ],
  },
  {
    label: 'Aide',
    items: [
      { to: '/tutoriels', label: 'Tutoriel', icon: Info, tutorialId: 'nav-tutoriels' },
      { to: '/rules', label: t('sidebar_nav_info'), icon: BookOpen },
    ],
  },
];

const YOU_NAV_ITEMS = [
  { tab: 'carte', label: t('sidebar_you_map'), icon: Map },
  { tab: 'construction', label: 'Construction', icon: Hammer },
  { tab: 'actions', label: 'Actions', icon: Workflow },
  { tab: 'social', label: 'Social', icon: Users },
  { tab: 'salle-de-marche', label: 'Marché ressources', icon: ShoppingBasket },
];

export default function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { maintenanceStatus } = useFeatures();
  const location = useLocation();
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);

  const isOnYou = location.pathname.startsWith('/you');
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);
  const canOpenYouFromLogo = !maintenanceStatus.youLogoAdminOnly || canBypassMaintenance;
  const logoTarget = isOnYou ? '/dashboard' : canOpenYouFromLogo ? '/you' : '/dashboard';
  const logoLabel = isOnYou
    ? t('sidebar_logo_you')
    : t('sidebar_logo_aura_tracker');

  const isDisabled = (path: string) => {
    if (canBypassMaintenance) return false;
    const page = BLOCKABLE_PAGES.find((p) => p.path === path);
    return page ? maintenanceStatus.disabledPages.includes(page.key) : false;
  };

  const isPathActive = (path: string) =>
    location.pathname === path ||
    (path === '/dashboard' && location.pathname === '/') ||
    location.pathname.startsWith(`${path}/`);

  const currentYouTab = new URLSearchParams(location.search).get('tab') ?? 'carte';

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild data-tutorial-id="sidebar-logo">
              <Link to={logoTarget}>
                <img
                  src={theme === 'dark' ? '/aura-icon-white.svg' : '/aura-icon.svg'}
                  alt="AuraTracker"
                  className="size-8 shrink-0 p-1.5"
                />
                <span className="truncate font-semibold">{logoLabel}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent data-tutorial-id="sidebar">
        {isOnYou ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t('sidebar_logo_you')}</SidebarGroupLabel>
            <SidebarMenu>
              {YOU_NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
                <SidebarMenuItem key={tab} data-tutorial-id={`you-tab-${tab}`}>
                  <SidebarMenuButton asChild isActive={currentYouTab === tab} tooltip={label}>
                    <Link to={`/you?tab=${tab}`}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !isDisabled(item.to));
            if (items.length === 0) return null;
            return (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.to} data-tutorial-id={item.tutorialId}>
                      <SidebarMenuButton asChild isActive={isPathActive(item.to)} tooltip={item.label}>
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem data-tutorial-id="nav-bug-report">
            <SidebarMenuButton tooltip={t('sidebar_report_bug')} onClick={() => setIsBugReportOpen(true)}>
              <Bug />
              <span>{t('sidebar_report_bug')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserAccountMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <BugReportPanel
        open={isBugReportOpen}
        onOpenChange={setIsBugReportOpen}
        trigger={<button type="button" className="sr-only" tabIndex={-1} />}
      />
    </Sidebar>
  );
}
