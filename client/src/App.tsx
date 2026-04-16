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
import InvoiceDetail from "@/pages/invoice-detail";
import Associates from "@/pages/associates";
import AssociateDetail from "@/pages/associate-detail";
import ClientPortal from "@/pages/client-portal";
import ClientDashboard from "@/pages/client/dashboard";
import ClientProjects from "@/pages/client/projects";
import ClientProjectDetailPage from "@/pages/client/project-detail";
import ClientTasks from "@/pages/client/tasks";
import ClientReminders from "@/pages/client/reminders";
import ClientTimeLogs from "@/pages/client/time-logs";
import ClientInvoices from "@/pages/client/invoices";
import ClientInvoiceDetailPage from "@/pages/client/invoice-detail";
import ClientActivityLogs from "@/pages/client/activity-logs";
import ClientAssociates from "@/pages/client/associates";
import ClientSettings from "@/pages/client/settings";
import ForGeneralContractors from "@/pages/for-general-contractors";
import ForPropertyDevelopers from "@/pages/for-property-developers";
import ForArchitectsEngineers from "@/pages/for-architects-engineers";
import ForConstructionManagers from "@/pages/for-construction-managers";
import SettingsPage from "@/pages/settings";
import ActivityLogs from "@/pages/activity-logs";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Intake from "@/pages/intake";
import IntakeForm from "@/pages/intake-form";
import IntakeView from "@/pages/intake-view";
import Reminders from "@/pages/reminders";
import SalesContacts from "@/pages/sales-contacts";
import SalesPipeline from "@/pages/sales-pipeline";
import ProposalDetail from "@/pages/proposal-detail";
import Invoices from "@/pages/invoices";
import ChartOfAccounts from "@/pages/chart-of-accounts";
import Vendors from "@/pages/vendors";
import BankAccounts from "@/pages/bank-accounts";
import BankRegister from "@/pages/bank-register";
import Expenses from "@/pages/expenses";
import Bills from "@/pages/bills";
import BillDetail from "@/pages/bill-detail";
import BankAccountDetail from "@/pages/bank-account-detail";
import RebillCenter from "@/pages/rebill-center";
import BankReconciliation from "@/pages/bank-reconciliation";
import ReconciliationDetail from "@/pages/reconciliation-detail";
import Reconciliation from "@/pages/reconciliation";
import UndepositedFunds from "@/pages/undeposited-funds";
import Deposits from "@/pages/deposits";
import JournalEntries from "@/pages/journal-entries";
import ReportsLanding from "@/pages/reports";
import ProfitLossReport from "@/pages/reports/profit-loss";
import BalanceSheetReport from "@/pages/reports/balance-sheet";
import TrialBalanceReport from "@/pages/reports/trial-balance";
import GeneralLedgerReport from "@/pages/reports/general-ledger";
import CashFlowReport from "@/pages/reports/cash-flow";
import ArAgingReport from "@/pages/reports/ar-aging";
import ApAgingReport from "@/pages/reports/ap-aging";
import { SynkdexWidget } from "@/components/synkdex-widget";
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
      <Route path="/intake" component={Intake} />
      <Route path="/intake/new" component={IntakeForm} />
      <Route path="/intake/:id" component={IntakeView} />
      <Route path="/intake/:id/edit" component={IntakeForm} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/time-logs" component={TimeLogs} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/:id" component={InvoiceDetail} />
      <Route path="/associates" component={Associates} />
      <Route path="/associates/:id" component={AssociateDetail} />
      <Route path="/activity-logs" component={ActivityLogs} />
      <Route path="/reminders" component={Reminders} />
      <Route path="/sales-contacts" component={SalesContacts} />
      <Route path="/sales-pipeline" component={SalesPipeline} />
      <Route path="/proposals/new" component={ProposalDetail} />
      <Route path="/proposals/:id" component={ProposalDetail} />
      <Route path="/chart-of-accounts" component={ChartOfAccounts} />
      <Route path="/vendors" component={Vendors} />
      <Route path="/bank-accounts" component={BankAccounts} />
      <Route path="/bank-accounts/:id" component={BankAccountDetail} />
      <Route path="/bank-register/:id" component={BankRegister} />
      <Route path="/reconciliation" component={Reconciliation} />
      <Route path="/bank-reconciliation/:id" component={BankReconciliation} />
      <Route path="/reconciliation-detail/:id" component={ReconciliationDetail} />
      <Route path="/undeposited-funds" component={UndepositedFunds} />
      <Route path="/deposits" component={Deposits} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/bills" component={Bills} />
      <Route path="/bills/:id" component={BillDetail} />
      <Route path="/rebill-center" component={RebillCenter} />
      <Route path="/journal-entries" component={JournalEntries} />
      <Route path="/reports" component={ReportsLanding} />
      <Route path="/reports/profit-loss" component={ProfitLossReport} />
      <Route path="/reports/balance-sheet" component={BalanceSheetReport} />
      <Route path="/reports/trial-balance" component={TrialBalanceReport} />
      <Route path="/reports/general-ledger" component={GeneralLedgerReport} />
      <Route path="/reports/cash-flow" component={CashFlowReport} />
      <Route path="/reports/ar-aging" component={ArAgingReport} />
      <Route path="/reports/ap-aging" component={ApAgingReport} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClientRouter() {
  return (
    <Switch>
      <Route path="/" component={ClientDashboard} />
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/auth" component={ClientDashboard} />
      <Route path="/projects" component={ClientProjects} />
      <Route path="/projects/:id" component={ClientProjectDetailPage} />
      <Route path="/tasks" component={ClientTasks} />
      <Route path="/reminders" component={ClientReminders} />
      <Route path="/time-logs" component={ClientTimeLogs} />
      <Route path="/invoices" component={ClientInvoices} />
      <Route path="/invoices/:id" component={ClientInvoiceDetailPage} />
      <Route path="/activity-logs" component={ClientActivityLogs} />
      <Route path="/associates" component={ClientAssociates} />
      <Route path="/settings" component={ClientSettings} />
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
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background shrink-0 print:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            {isAdmin && <GlobalSearch />}
            <div className="flex items-center gap-2">
              {isAdmin && <ReminderBell />}
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 md:p-6">
            <div className="max-w-7xl mx-auto">
              {isAdmin ? <AdminRouter /> : <ClientRouter />}
            </div>
          </main>
        </div>
      </div>
      <SynkdexWidget />
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
