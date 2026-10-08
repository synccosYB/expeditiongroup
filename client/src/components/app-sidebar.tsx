import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FolderKanban,
  ClipboardList,
  Clock,
  UserCog,
  LogOut,
  Settings,
  FileText,
  FilePlus2,
  CalendarDays,
  TrendingUp,
  DollarSign,
  Landmark,
  Receipt,
  Building2,
  Scale,
  BookOpen,
  RefreshCw,
  Wallet,
  ArrowDownToLine,
  BookText,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import logoIcon from "@/assets/logo-checkbox-icon.svg";

const adminMenuItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Intake", url: "/intake", icon: FilePlus2 },
  { title: "Sales Contacts", url: "/sales-contacts", icon: UserPlus },
  { title: "Sales Pipeline", url: "/sales-pipeline", icon: TrendingUp },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Calendar", url: "/reminders", icon: CalendarDays },
  { title: "Time Logs", url: "/time-logs", icon: Clock },
  { title: "Invoices", url: "/invoices", icon: DollarSign },
  { title: "Activity Logs", url: "/activity-logs", icon: FileText },
  { title: "Account Activity", url: "/account-activity", icon: ShieldCheck },
  { title: "Associates", url: "/associates", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings },
];

const bookkeepingMenuItems = [
  { title: "Chart of Accounts", url: "/chart-of-accounts", icon: BookOpen },
  { title: "Bank Accounts", url: "/bank-accounts", icon: Landmark },
  { title: "Reconciliation", url: "/reconciliation", icon: Scale },
  { title: "Undeposited Funds", url: "/undeposited-funds", icon: Wallet },
  { title: "Deposits", url: "/deposits", icon: ArrowDownToLine },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Vendors", url: "/vendors", icon: Building2 },
  { title: "Bills", url: "/bills", icon: FileText },
  { title: "Rebill Center", url: "/rebill-center", icon: RefreshCw },
  { title: "Journal Entries", url: "/journal-entries", icon: BookText },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const clientMenuItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Calendar", url: "/reminders", icon: CalendarDays },
  { title: "Time Logs", url: "/time-logs", icon: Clock },
  { title: "Invoices", url: "/invoices", icon: DollarSign },
  { title: "Activity Logs", url: "/activity-logs", icon: FileText },
  { title: "Associates", url: "/associates", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, isAdmin } = useAuth();
  const menuItems = isAdmin ? adminMenuItems : clientMenuItems;
  const groups = isAdmin ? [
    { title: "Workspace", items: menuItems.filter(i => ["Overview", "Projects", "Tasks", "Clients", "Calendar"].includes(i.title)) },
    { title: "Sales", items: menuItems.filter(i => ["Intake", "Sales Contacts", "Sales Pipeline"].includes(i.title)) },
    { title: "Time & billing", items: menuItems.filter(i => ["Time Logs", "Invoices"].includes(i.title)) },
    { title: "Administration", items: menuItems.filter(i => ["Activity Logs", "Account Activity", "Associates", "Settings"].includes(i.title)) },
    { title: "Bookkeeping", items: bookkeepingMenuItems },
  ] : [
    { title: "Workspace", items: menuItems.filter(item => ["Overview", "Projects", "Tasks", "Calendar"].includes(item.title)) },
    { title: "Time & billing", items: menuItems.filter(item => ["Time Logs", "Invoices"].includes(item.title)) },
    { title: "Account", items: menuItems.filter(item => ["Activity Logs", "Associates", "Settings"].includes(item.title)) },
  ];

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="h-[65px] justify-center px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold text-sidebar-foreground">Expedition Group</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-auto">
        {groups.map(group => <details key={group.title} open={group.title === "Workspace" || group.title === "Portal" || group.items.some(item => item.url !== "/" && location.startsWith(item.url))} className="px-2">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground tracking-wide">{group.title}</summary>
          <SidebarMenu>{group.items.map(item => {
            const active = location === item.url || (item.url !== "/" && location.startsWith(item.url));
            return <SidebarMenuItem key={item.title}><SidebarMenuButton asChild isActive={active} className={active ? "bg-sidebar-accent text-primary font-medium" : ""} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}><Link href={item.url} aria-current={active ? "page" : undefined}><item.icon className="h-4 w-4" /><span>{item.title}</span></Link></SidebarMenuButton></SidebarMenuItem>;
          })}</SidebarMenu>
        </details>)}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={user?.profileImageUrl || undefined} 
              alt={user?.firstName || "User"} 
              className="object-cover"
            />
            <AvatarFallback className="text-xs bg-muted">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email || "User"}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {user?.role || "user"}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-logout"
            aria-label="Log out"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              queryClient.setQueryData(["/api/auth/user"], null);
              await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              setLocation("/");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
