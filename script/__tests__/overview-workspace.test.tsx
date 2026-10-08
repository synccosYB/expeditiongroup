import React from "react";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OverviewWorkspace } from "@/components/overview-workspace";
import ClientDashboard from "@/pages/client/dashboard";
import ClientProjects from "@/pages/client/projects";
import ClientInvoices from "@/pages/client/invoices";

const projects = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, name: `Permit project ${index + 1}`, clientId: 1,
  status: "in_progress", county: "Rockland", address: "125 Kent Avenue",
  tasks: [], createdAt: new Date("2026-10-01"), startDate: null,
}));
const tasks = [{ id: 1, title: "Submit permit documents", projectId: 1,
  project: projects[0], status: "todo", priority: "high", dueDate: new Date("2020-01-01"), type: "filing" }];
const invoices = projects.map(project => ({ id: project.id, invoiceNumber: `INV-${project.id}`,
  project, total: "100", status: "sent", createdAt: new Date("2026-10-01"), dueDate: null }));
function render(node: React.ReactNode) {
  return renderToString(<Router ssrPath="/"><QueryClientProvider client={queryClient}><TooltipProvider>{node}</TooltipProvider></QueryClientProvider></Router>);
}
const workspace = render(<OverviewWorkspace projects={projects as any} tasks={tasks as any} />);
assert.ok(workspace.includes("Priority work"));
assert.ok(workspace.includes("All projects"));
assert.ok(workspace.includes("1–6 of 12"));
assert.ok(workspace.includes("Submit permit documents"), "real next action must be shown");
assert.ok(workspace.includes('href="/projects/1"'), "selected project link retained");
assert.ok(!workspace.includes("Preview Permit project 7"), "records beyond page one must be paginated");
assert.ok(workspace.includes("workspace-overview-footer"));
assert.ok(render(<OverviewWorkspace projects={[]} tasks={[]} />).includes("No projects yet."));
queryClient.setQueryData(["/api/auth/user"], { id: "client", firstName: "Yoel", role: "client" });
queryClient.setQueryData(["/api/client/dashboard/stats"], { activeProjects: 12, pendingTasks: 1, totalInvoices: 12 });
queryClient.setQueryData(["/api/client/projects"], projects);
queryClient.setQueryData(["/api/client/tasks"], tasks);
queryClient.setQueryData(["/api/client/invoices"], invoices);
queryClient.setQueryData(["/api/client/projects/by-status"], [{ status: "in_progress", count: 12 }]);
const dashboard = render(<ClientDashboard />);
assert.ok(dashboard.includes("Workspace overview"));
assert.ok(dashboard.includes("workspace-overview"));
assert.ok(!dashboard.includes("Job Pipeline"), "old oversized pipeline card removed");
assert.ok(!dashboard.includes("New project"), "client permissions must remain unchanged");
assert.ok(render(<ClientProjects />).includes("Record preview"));
const invoiceHtml = render(<ClientInvoices />);
assert.ok(invoiceHtml.includes("Record preview"));
assert.ok(invoiceHtml.includes("Invoice Statement"), "full printable statement retained");
assert.ok(invoiceHtml.includes("INV-12"), "printing must include records beyond page one");
for (const key of ["/api/client/projects", "/api/client/tasks", "/api/client/invoices", "/api/client/projects/by-status"]) queryClient.setQueryData([key], []);
for (const Component of [ClientDashboard, ClientProjects, ClientInvoices]) assert.ok(render(<Component />).length > 100);
queryClient.clear();
console.log("Overview and client-page regression checks passed");
