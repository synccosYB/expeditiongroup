import { Link, useLocation } from "wouter";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import logoIcon from "@/assets/logo-checkbox-icon.svg";

const adminMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
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
];

const clientMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
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
  const [location] = useLocation();
  const { user, isAdmin } = useAuth();
  const menuItems = isAdmin ? adminMenuItems : clientMenuItems;

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
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <img src={logoIcon} alt="E+" className="h-9 w-9" />
          <div className="flex flex-col">
            <span className="text-base font-semibold text-sidebar-foreground">
              Expedition Group
            </span>
            <span className="text-xs text-muted-foreground">
              Permit Expediting
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wide font-medium text-muted-foreground px-4 py-2">
            {isAdmin ? "Administration" : "Portal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={isActive ? "bg-sidebar-accent" : ""}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wide font-medium text-muted-foreground px-4 py-2">
              Bookkeeping
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {bookkeepingMenuItems.map((item) => {
                  const isActive = location === item.url || 
                    (item.url !== "/" && location.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={isActive ? "bg-sidebar-accent" : ""}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
              window.location.href = "/";
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
