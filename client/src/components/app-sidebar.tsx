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
  FolderKanban,
  ClipboardList,
  Clock,
  UserCog,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import logoIcon from "@/assets/logo-checkbox-icon.svg";

const adminMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Time Logs", url: "/time-logs", icon: Clock },
  { title: "Associates", url: "/associates", icon: UserCog },
];

const clientMenuItems = [
  { title: "My Projects", url: "/", icon: FolderKanban },
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

      <SidebarContent>
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
            asChild
            data-testid="button-logout"
            aria-label="Log out"
          >
            <a href="/api/logout">
              <LogOut className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
