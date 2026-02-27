import type { ComponentProps } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { Sidebar as SidebarPrimitive } from '@/components/ui/sidebar';

export function AppSidebar(props: ComponentProps<typeof SidebarPrimitive>) {
  return <Sidebar {...props} />;
}

