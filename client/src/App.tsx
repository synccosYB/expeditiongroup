import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { ReminderBell } from "@/components/reminder-bell";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import CookiePolicy from "@/pages/cookie-policy";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import AboutUs from "@/pages/about-us";
import OurStory from "@/pages/our-story";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tasks from "@/pages/tasks";
import TimeLogs from "@/pages/time-logs";
import Invoices from "@/pages/invoices";
import Associates from "@/pages/associates";
import AssociateDetail from "@/pages/associate-detail";
import ClientPortal, { ClientProjectDetail } from "@/pages/client-portal";
import ForGeneralContractors from "@/pages/for-general-contractors";
import ForPropertyDevelopers from "@/pages/for-property-developers";
import ForArchitectsEngineers from "@/pages/for-architects-engineers";
import ForConstructionManagers from "@/pages/for-construction-managers";
import SettingsPage from "@/pages/settings";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="space-y-4 text-center">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/auth" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/time-logs" component={TimeLogs} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/associates" component={Associates} />
      <Route path="/associates/:id" component={AssociateDetail} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClientRouter() {
  return (
    <Switch>
      <Route path="/" component={ClientPortal} />
      <Route path="/dashboard" component={ClientPortal} />
      <Route path="/auth" component={ClientPortal} />
      <Route path="/project/:id" component={ClientProjectDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { isAdmin } = useAuth();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            {isAdmin && <GlobalSearch />}
            <div className="flex items-center gap-2">
              {isAdmin && <ReminderBell />}
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              {isAdmin ? <AdminRouter /> : <ClientRouter />}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/dashboard" component={AuthPage} />
        <Route path="/cookie-policy" component={CookiePolicy} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/about-us" component={AboutUs} />
        <Route path="/our-story" component={OurStory} />
        <Route path="/for-general-contractors" component={ForGeneralContractors} />
        <Route path="/for-property-developers" component={ForPropertyDevelopers} />
        <Route path="/for-architects-engineers" component={ForArchitectsEngineers} />
        <Route path="/for-construction-managers" component={ForConstructionManagers} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
