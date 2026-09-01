import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Menu,
  PenLine,
  Plug,
  Settings as SettingsIcon,
  LogOut,
  ChevronsUpDown,
  Plus,
} from 'lucide-react';
import type { Org } from '@shared/types';
import { useAuth } from '@/lib/useAuth';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { to: '/', end: true, label: 'Calendar', icon: CalendarDays },
  { to: '/posts', label: 'Posts', icon: ListChecks },
  { to: '/compose', label: 'Compose', icon: PenLine },
  { to: '/approvals', label: 'Approvals', icon: CheckCircle2 },
  { to: '/accounts', label: 'Accounts', icon: Plug },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function initials(email: string) {
  const name = email.split('@')[0] ?? email;
  return name.slice(0, 2).toUpperCase();
}

function SidebarBody({
  workspaces,
  current,
  onSelect,
  onNew,
  email,
  onNavigate,
}: {
  workspaces: Org[];
  current: Org;
  onSelect: (id: string) => void;
  onNew: () => void;
  email: string;
  onNavigate?: () => void;
}) {
  const { signOut } = useAuth();

  return (
    <div className="flex h-full flex-col gap-1 p-3.5">
      <div className="mb-2 border-b border-sidebar-border px-2 pb-3.5 pt-1.5">
        <div className="font-display text-[17px] font-black leading-none tracking-tight text-sidebar-primary">
          Triple Jeopardy
        </div>
        <div className="dateline mt-1 !text-[10px] !tracking-[0.14em] text-[color:var(--pf-sage)]">
          Positive Force
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="mb-2 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-2.5 py-2 text-left text-[13px] text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span className="size-1.5 shrink-0 rounded-full bg-action" />
          <span className="truncate font-medium text-sidebar-accent-foreground">{current.name}</span>
          <ChevronsUpDown className="ml-auto size-3.5 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => onSelect(w.id)}
              className={cn(w.id === current.id && 'font-semibold')}
            >
              {w.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onNew}>
            <Plus className="size-4" /> New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] transition-colors',
                isActive
                  ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--pf-olive)] font-mono text-[11px] font-semibold text-sidebar-primary">
            {initials(email)}
          </span>
          <span className="truncate text-[12.5px] text-sidebar-foreground">{email}</span>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => void signOut()}
            className="ml-auto rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  workspaces,
  current,
  onSelect,
  onNew,
  email,
  children,
}: {
  workspaces: Org[];
  current: Org;
  onSelect: (id: string) => void;
  onNew: () => void;
  email: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen bg-sidebar lg:block">
        <SidebarBody
          workspaces={workspaces}
          current={current}
          onSelect={onSelect}
          onNew={onNew}
          email={email}
        />
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-sidebar px-4 py-2.5 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[264px] bg-sidebar p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SidebarBody
              workspaces={workspaces}
              current={current}
              onSelect={(id) => {
                onSelect(id);
                setOpen(false);
              }}
              onNew={() => {
                onNew();
                setOpen(false);
              }}
              email={email}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <span className="font-display text-sm font-black tracking-tight text-sidebar-primary">
          Triple Jeopardy
        </span>
      </header>

      <main className="min-w-0 px-5 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
