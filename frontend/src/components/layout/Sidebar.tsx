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
  BarChart3,
  Target,
  Info,
  MessagesSquare,
  Boxes,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  { to: '/leaderboards', label: t('sidebar_nav_leaderboard'), icon: Trophy },
  { to: '/clans', label: t('sidebar_nav_clans'), icon: Flag },
  { to: '/polymarket', label: t('sidebar_polymarket'), icon: BarChart3 },
  { to: '/market', label: t('sidebar_nav_shop'), icon: Store },
  { to: '/inventory', label: t('sidebar_nav_inventory'), icon: Backpack },
  { to: '/marketplace', label: t('sidebar_nav_marketplace'), icon: BadgeDollarSign },
  { to: '/party', label: t('sidebar_nav_party'), icon: Users },
  { to: '/quests', label: t('sidebar_nav_quests'), icon: Target },
  { to: '/forum', label: 'Forum', icon: MessagesSquare },
  { to: '/suggestions', label: t('sidebar_nav_suggestions'), icon: Lightbulb },
  { to: '/tutoriels', label: 'Tutoriel', icon: Info },
  { to: '/rules', label: t('sidebar_nav_info'), icon: BookOpen },
];

const youNavItems = [
  { tab: 'carte',  label: t('sidebar_you_map'),    icon: Map   },
  { tab: 'supply', label: t('sidebar_you_supply'), icon: Boxes },
];

export default function AppSidebar({ onMouseEnter, onMouseLeave, className, ...props }: ComponentProps<typeof Sidebar>) {
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

  const enabledOrderedItems = economyItems.filter((item) => !isDisabled(item.to));
  const footerItemPaths = new Set(['/suggestions', '/rules']);
  const footerOrderedItems = enabledOrderedItems.filter((item) => footerItemPaths.has(item.to));
  const mainOrderedItems = enabledOrderedItems.filter((item) => !footerItemPaths.has(item.to));

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
      data-tutorial-id="sidebar-logo"
      onClick={handleLogoClick}
      className={cn(
        'mb-4 flex h-8 w-full items-center gap-2 rounded-md px-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 active:scale-95 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:mx-auto',
        shouldNudgeYouLogo && 'shadow-[0_0_0_rgba(99,102,241,0)] hover:shadow-[0_0_10px_rgba(99,102,241,0.25)]'
      )}
      aria-label={isOnYou ? t('sidebar_logo_back_to_dashboard') : (canOpenYouFromLogo ? t('sidebar_logo_go_to_you') : t('sidebar_logo_go_to_dashboard'))}
    >
      <img
        src={theme === 'dark' ? '/aura-icon-white.svg' : '/aura-icon.svg'}
        alt="AuraTracker"
        className={cn(
          'h-4 w-4 shrink-0',
          isOnYou && 'drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]'
        )}
      />
      <span className="inline-block overflow-hidden whitespace-nowrap truncate text-sm font-semibold tracking-tight transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
        {isOnYou ? t('sidebar_logo_you') : t('sidebar_logo_aura_tracker')}
      </span>
    </button>
  );

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      detached
      className={cn('transition-[left,right] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]', className)}
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
      <SidebarContent data-tutorial-id="sidebar">
        <div className="px-3 py-4">
          {logoButton}
          <SidebarMenu className="gap-0.5">

            {/* You section nav */}
            {isOnYou && youNavItems.map(({ tab, label, icon: Icon }) => {
              const href = `/you?tab=${tab}`;
              const params = new URLSearchParams(location.search);
              const currentTab = params.get('tab') ?? 'carte';
              const isActive = currentTab === tab;
              return (
                <SidebarMenuItem key={label} data-tutorial-id={`you-tab-${tab}`}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={label}
                    className={cn(
                      'h-8 px-2 text-sm font-normal group-data-[collapsible=icon]:!h-8',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={href}>
                      <Icon className="h-4 w-4" />
                      <span className="inline-block overflow-hidden whitespace-nowrap transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">{label}</span>
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
                    'h-8 px-2 text-sm font-normal group-data-[collapsible=icon]:!h-8',
                    location.pathname === '/' || location.pathname === '/dashboard'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/dashboard" end>
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="inline-block overflow-hidden whitespace-nowrap transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">{t('sidebar_dashboard')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {!isOnYou && (<>

            {/* Games */}
            {!isDisabled('/games') && (
              <SidebarMenuItem data-tutorial-id="nav-games">
                <SidebarMenuButton
                  asChild
                  isActive={isGamesSectionActive}
                  tooltip={t('sidebar_games')}
                  className={cn(
                    'h-8 px-2 text-sm font-normal group-data-[collapsible=icon]:!h-8',
                    isGamesSectionActive
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/games">
                    <Gamepad2 className="h-4 w-4" />
                    <span className="inline-block overflow-hidden whitespace-nowrap transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">{t('sidebar_games')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {mainOrderedItems.map((item) => {
              const ItemIcon = item.icon;
              const isActive = isPathActive(item.to);
              const NAV_TUTORIAL_IDS: Record<string, string> = { '/marketplace': 'nav-marketplace', '/leaderboards': 'nav-leaderboards', '/clans': 'nav-clans', '/tutoriels': 'nav-tutoriels' };
              const tutorialId = NAV_TUTORIAL_IDS[item.to];
              return (
                <SidebarMenuItem key={item.to} data-tutorial-id={tutorialId}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      'h-8 px-2 text-sm font-normal group-data-[collapsible=icon]:!h-8',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <ItemIcon className="h-4 w-4" />
                      <span className="inline-block overflow-hidden whitespace-nowrap transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
            </>)}

          </SidebarMenu>
        </div>
      </SidebarContent>
      {!isOnYou && (
        <SidebarFooter className="px-3 pb-4 pt-0">
          <div className="mx-2 mb-2 h-px bg-sidebar-border/60" />
          <SidebarMenu className="gap-0.5">
            {footerOrderedItems.map((item) => {
              const ItemIcon = item.icon;
              const isActive = isPathActive(item.to);
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      'h-8 px-2 text-sm font-normal group-data-[collapsible=icon]:!h-8',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <ItemIcon className="h-4 w-4" />
                      <span className="inline-block overflow-hidden whitespace-nowrap transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
            <SidebarMenuItem data-tutorial-id="nav-bug-report">
              <SidebarMenuButton
                onClick={() => setIsBugReportOpen(true)}
                tooltip={t('sidebar_report_bug')}
                className="h-8 px-2 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent group-data-[collapsible=icon]:!h-8"
              >
                <Bug className="h-4 w-4" />
                <span className="inline-block overflow-hidden whitespace-nowrap transition-[opacity,transform,max-width] duration-150 ease-out group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">{t('sidebar_report_bug')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <BugReportPanel
        open={isBugReportOpen}
        onOpenChange={setIsBugReportOpen}
        trigger={<button type="button" className="sr-only" tabIndex={-1} />}
      />
    </Sidebar>
  );
}
