import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bug,
  LayoutDashboard,
  Gamepad2,
  Map,
  Trophy,
  Users,
  Flag,
  Backpack,
  Lightbulb,
  BookOpen,
  Store,
  BadgeDollarSign,
  Ticket,
  BarChart3,
  Target,
  Briefcase,
  Landmark,
  Coins,
  Info,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useFeatures } from '@/contexts/FeaturesContext';
import { BLOCKABLE_PAGES } from '@/config/blockedPages';
import { useTheme } from '@/contexts/ThemeContext';
import BugReportPanel from './BugReportPanel';
import { t } from '@/lib/i18n';

type SidebarRouteItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const economyItems: SidebarRouteItem[] = [
  { to: '/market', label: t('sidebar_nav_shop'), icon: Store },
  { to: '/inventory', label: t('sidebar_nav_inventory'), icon: Backpack },
  { to: '/marketplace', label: t('sidebar_nav_marketplace'), icon: BadgeDollarSign },
  { to: '/polymarket', label: t('sidebar_polymarket'), icon: BarChart3 },
  { to: '/pass', label: t('sidebar_nav_pass'), icon: Ticket },
  { to: '/quests', label: t('sidebar_nav_quests'), icon: Target },
];

const communityItems: SidebarRouteItem[] = [
  { to: '/leaderboards', label: t('sidebar_nav_leaderboard'), icon: Trophy },
  { to: '/party', label: t('sidebar_nav_party'), icon: Users },
  { to: '/clans', label: t('sidebar_nav_clans'), icon: Flag },
  { to: '/loto', label: 'Loto', icon: Ticket },
  { to: '/suggestions', label: t('sidebar_nav_suggestions'), icon: Lightbulb },
];

const infoItems: SidebarRouteItem[] = [
  { to: '/rules', label: t('sidebar_nav_info'), icon: BookOpen },
  { to: '/tutoriels', label: 'Tutoriels', icon: Info },
];

const youNavItems = [
  { tab: 'carte',    label: t('sidebar_you_map'),      icon: Map            },
  { tab: 'overview', label: t('sidebar_you_overview'), icon: LayoutDashboard },
  { tab: 'travail',  label: t('sidebar_you_work'),     icon: Briefcase      },
  { tab: 'social',   label: t('sidebar_you_social'),   icon: Users          },
  { tab: 'explore',  label: t('sidebar_you_explore'),  icon: BarChart3      },
  { tab: 'finance',  label: t('sidebar_you_finance'),  icon: Landmark       },
  { tab: 'marche-actions', label: t('sidebar_you_share_market'), icon: Coins },
];

export default function AppSidebar({ onMouseEnter, onMouseLeave, ...props }: ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const { isMobile, setOpen } = useSidebar();
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { maintenanceStatus } = useFeatures();
  const { theme } = useTheme();
  const disabledPages = maintenanceStatus.disabledPages;
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  const isDisabled = (path: string) => {
    if (canBypassMaintenance) return false;
    const page = BLOCKABLE_PAGES.find((p) => p.path === path);
    return page ? disabledPages.includes(page.key) : false;
  };

  const isOnGames = location.pathname.startsWith('/games');
  const isOnYou = location.pathname.startsWith('/you');

  const isPathActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));

  const enabledEconomyItems = economyItems.filter((item) => !isDisabled(item.to));
  const enabledCommunityItems = communityItems.filter((item) => !isDisabled(item.to));
  const enabledInfoItems = infoItems.filter((item) => !isDisabled(item.to));

  const isGamesSectionActive = isOnGames;
  const canOpenYouFromLogo = !maintenanceStatus.youLogoAdminOnly || canBypassMaintenance;
  const shouldNudgeYouLogo = !isOnYou && canOpenYouFromLogo;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openSidebar = () => {
    if (isMobile) return;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  };

  const closeSidebar = () => {
    if (isMobile) return;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 70);
  };

  const handleLogoClick = () => {
    if (isOnYou) {
      navigate('/dashboard');
      return;
    }
    navigate(canOpenYouFromLogo ? '/you' : '/dashboard');
  };

  const logoButton = (
    <button
      type="button"
      onClick={handleLogoClick}
      className={cn(
        'mb-4 flex h-9 w-full items-center gap-2 rounded-md px-3 text-sidebar-foreground transition-all hover:bg-sidebar-accent/50 active:scale-95 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2',
        shouldNudgeYouLogo && 'shadow-[0_0_0_rgba(99,102,241,0)] hover:shadow-[0_0_10px_rgba(99,102,241,0.25)]'
      )}
      aria-label={isOnYou ? t('sidebar_logo_back_to_dashboard') : (canOpenYouFromLogo ? t('sidebar_logo_go_to_you') : t('sidebar_logo_go_to_dashboard'))}
    >
      <img
        src={theme === 'dark' ? '/aura-icon-white.svg' : '/aura-icon.svg'}
        alt="AuraTracker"
        className={cn(
          'h-5 w-5 shrink-0 transition-transform group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4',
          isOnYou && 'scale-110 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]',
          shouldNudgeYouLogo && 'motion-safe:animate-[bounce_2.8s_ease-in-out_infinite]'
        )}
      />
      <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
        {isOnYou ? t('sidebar_logo_you') : t('sidebar_logo_aura_tracker')}
      </span>
    </button>
  );

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        openSidebar();
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        closeSidebar();
      }}
      {...props}
    >
      <SidebarContent>
        <div className="px-3 py-4">
          {logoButton}
          <SidebarMenu className="space-y-1">

            {/* You section nav */}
            {isOnYou && youNavItems.map(({ tab, label, icon: Icon }) => {
              const href = `/you?tab=${tab}`;
              const params = new URLSearchParams(location.search);
              const currentTab = params.get('tab') ?? 'carte';
              const isActive = currentTab === tab;
              return (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={label}
                    className={cn(
                      'h-9 px-3 text-sm font-normal group-data-[collapsible=icon]:!h-9',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={href}>
                      <Icon className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            {/* Dashboard */}
            {!isOnYou && !isDisabled('/') && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                  tooltip={t('sidebar_dashboard')}
                  className={cn(
                    'h-9 px-3 text-sm font-normal group-data-[collapsible=icon]:!h-9',
                    location.pathname === '/' || location.pathname === '/dashboard'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/dashboard" end>
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{t('sidebar_dashboard')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {!isOnYou && (<>

            {/* Games */}
            {!isDisabled('/games') && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isGamesSectionActive}
                  tooltip={t('sidebar_games')}
                  className={cn(
                    'h-9 px-3 text-sm font-normal group-data-[collapsible=icon]:!h-9',
                    isGamesSectionActive
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/games">
                    <Gamepad2 className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{t('sidebar_games')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {[...enabledEconomyItems, ...enabledCommunityItems, ...enabledInfoItems].map((item) => {
              const ItemIcon = item.icon;
              const isActive = isPathActive(item.to);
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      'h-9 px-3 text-sm font-normal group-data-[collapsible=icon]:!h-9',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <ItemIcon className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setIsBugReportOpen(true)}
                tooltip={t('sidebar_report_bug')}
                className="h-9 px-3 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent group-data-[collapsible=icon]:!h-9"
              >
                <Bug className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">{t('sidebar_report_bug')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            </>)}

          </SidebarMenu>
        </div>
      </SidebarContent>
      <BugReportPanel
        open={isBugReportOpen}
        onOpenChange={setIsBugReportOpen}
        trigger={<button type="button" className="sr-only" tabIndex={-1} />}
      />
    </Sidebar>
  );
}
