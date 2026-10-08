import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, ClipboardList, Users, DollarSign, Settings } from "lucide-react";
export function WorkspaceRail() {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  const items = [["Overview", "/", LayoutDashboard], ["Projects", "/projects", FolderKanban], ["Tasks", "/tasks", ClipboardList], ["Clients", "/clients", Users], ["Invoices", "/invoices", DollarSign], ["Settings", "/settings", Settings]] as const;
  return <nav className="workspace-rail hidden md:flex flex-col items-center gap-3 py-4 print:hidden" aria-label="Quick navigation">
    <Link href="/" className="mb-3 text-xl font-bold" aria-label="Expedition Group overview">E+</Link>
    {items.filter(([label]) => label !== "Clients" || isAdmin).map(([label, href, Icon]) => <Link key={href} href={href} title={label} aria-label={label} aria-current={(href === "/" ? location === href : location.startsWith(href)) ? "page" : undefined}><Icon className="h-5 w-5" /></Link>)}
  </nav>;
}
