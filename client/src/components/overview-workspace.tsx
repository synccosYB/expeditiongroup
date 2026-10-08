import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Circle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { useWorkspacePage, WorkspacePagination } from "@/components/workspace-pagination";
import { formatLocalDate, parseLocalDateFromISO } from "@/lib/dateUtils";
import type { Client, Project, Task } from "@shared/schema";

export type OverviewProject = Project & { client?: Client | null };
export type OverviewTask = Task & { project?: Project | null };
const stages = [
  ["intake", "Intake", "bg-slate-400"],
  ["in_progress", "In progress", "bg-blue-500"],
  ["waiting_on_client", "Waiting on client", "bg-amber-500"],
  ["with_dob", "With DOB", "bg-violet-500"],
  ["on_hold", "On hold", "bg-gray-400"],
  ["completed", "Completed", "bg-green-500"],
  ["cancelled", "Cancelled", "bg-red-400"],
] as const;
const pending = (task: OverviewTask) => task.status !== "done" && task.status !== "cancelled";
const dueTime = (task: OverviewTask) => parseLocalDateFromISO(task.dueDate)?.getTime() ?? Infinity;
const dateLabel = (date: Task["dueDate"]) => {
  const parsed = parseLocalDateFromISO(date);
  return parsed ? formatLocalDate(parsed) : "—";
};

export function OverviewWorkspace({ projects, tasks, showClient = false, statusCounts }: {
  projects: OverviewProject[];
  tasks: OverviewTask[];
  showClient?: boolean;
  statusCounts?: { status: string; count: number }[];
}) {
  const [tab, setTab] = useState("priority");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const openTasks = useMemo(() => tasks.filter(pending).sort((a, b) => dueTime(a) - dueTime(b)), [tasks]);
  const nextTasks = useMemo(() => {
    const map = new Map<number, OverviewTask>();
    for (const task of openTasks) if (!map.has(task.projectId)) map.set(task.projectId, task);
    return map;
  }, [openTasks]);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const dueTasks = openTasks.filter(task => dueTime(task) <= endOfToday.getTime());
  const filteredProjects = projects.filter(project => {
    const matchesSearch = [project.name, project.client?.name, project.county, project.address].some(value => value?.toLowerCase().includes(search.toLowerCase()));
    const matchesStage = stage === "all" || project.status === stage;
    const matchesTab = tab !== "priority" || !["completed", "cancelled", "archived"].includes(project.status);
    return matchesSearch && matchesStage && matchesTab;
  });
  if (tab === "priority") filteredProjects.sort((a, b) => (nextTasks.get(a.id) ? dueTime(nextTasks.get(a.id)!) : Infinity) - (nextTasks.get(b.id) ? dueTime(nextTasks.get(b.id)!) : Infinity));
  const filteredTasks = dueTasks.filter(task => [task.title, task.project?.name].some(value => value?.toLowerCase().includes(search.toLowerCase())));
  const resetKey = `${tab}:${search}:${stage}`;
  const projectPage = useWorkspacePage(filteredProjects, 6, resetKey);
  const taskPage = useWorkspacePage(filteredTasks, 6, resetKey);
  const taskMode = tab === "tasks";
  const currentTask = taskMode ? taskPage.items.find(task => task.id === selectedTaskId) ?? taskPage.items[0] : undefined;
  const selected = taskMode
    ? projects.find(project => project.id === currentTask?.projectId)
    : projectPage.items.find(project => project.id === selectedId) ?? projectPage.items[0];
  const next = currentTask ?? (selected ? nextTasks.get(selected.id) : undefined);
  const checklist = selected ? tasks.filter(task => task.projectId === selected.id).slice(0, 3) : [];
  const counts = new Map(statusCounts?.map(item => [item.status, item.count]));
  if (!statusCounts) for (const project of projects) counts.set(project.status, (counts.get(project.status) ?? 0) + 1);

  return (
    <div className="workspace-split workspace-overview">
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="border-b px-4">
          <TabsList aria-label="Overview work views" className="border-0">
            <TabsTrigger value="priority">Priority work</TabsTrigger>
            <TabsTrigger value="projects">All projects</TabsTrigger>
            <TabsTrigger value="tasks">Due tasks · {dueTasks.length}</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label={taskMode ? "Search due tasks" : "Search projects"} placeholder={taskMode ? "Search due tasks…" : "Search projects…"} value={search} onChange={event => setSearch(event.target.value)} className="pl-9" />
          </div>
          {!taskMode && <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Project stage"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stages</SelectItem>{stages.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}<SelectItem value="archived">Archived</SelectItem></SelectContent>
          </Select>}
        </div>
        <TabsContent value={tab} className="mt-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{taskMode ? "Task" : "Project"}</TableHead>
              {taskMode ? <TableHead>Project</TableHead> : showClient && <TableHead>Client</TableHead>}
              <TableHead>Stage</TableHead><TableHead>{taskMode ? "Priority" : "Next action"}</TableHead><TableHead>Due</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {taskMode ? taskPage.items.map(task => <TableRow key={task.id} data-state={currentTask?.id === task.id ? "selected" : undefined}>
                <TableCell><button className="text-left font-medium text-primary hover:underline" onClick={() => setSelectedTaskId(task.id)} aria-label={`Preview ${task.title}`}>{task.title}</button></TableCell>
                <TableCell>{task.project?.name ?? "—"}</TableCell><TableCell><StatusBadge status={task.status} type="task" /></TableCell><TableCell className="capitalize">{task.priority}</TableCell><TableCell>{dateLabel(task.dueDate)}</TableCell>
              </TableRow>) : projectPage.items.map(project => <TableRow key={project.id} data-state={selected?.id === project.id ? "selected" : undefined}>
                <TableCell><button className="text-left font-medium text-primary hover:underline" onClick={() => setSelectedId(project.id)} aria-label={`Preview ${project.name}`}>{project.name}</button></TableCell>
                {showClient && <TableCell>{project.client?.name ?? "—"}</TableCell>}
                <TableCell><StatusBadge status={project.status} type="project" /></TableCell><TableCell>{nextTasks.get(project.id)?.title ?? "No pending task"}</TableCell><TableCell>{dateLabel(nextTasks.get(project.id)?.dueDate ?? null)}</TableCell>
              </TableRow>)}
              {!(taskMode ? taskPage.items.length : projectPage.items.length) && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">{search || stage !== "all" ? "No matching records. Try another search or stage." : taskMode ? "No tasks are due or overdue." : tab === "priority" && projects.length ? "No active projects. Select All projects to see completed work." : "No projects yet."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
      <aside className="workspace-detail flex flex-col gap-5" aria-label="Project preview">
        {selected ? <>
          <h2 className="text-lg font-semibold">{selected.name}</h2>
          <dl>{showClient && <><dt>Client</dt><dd>{selected.client?.name ?? "—"}</dd></>}<dt>Stage</dt><dd><StatusBadge status={selected.status} type="project" /></dd><dt>County</dt><dd>{selected.county ?? "—"}</dd></dl>
          <dl className="border-t pt-4"><dt>Next action</dt><dd>{next?.title ?? "No pending task"}</dd><dt>Due</dt><dd>{dateLabel(next?.dueDate ?? null)}</dd></dl>
          {checklist.length > 0 && <div className="border-t pt-4"><h3 className="mb-3 text-sm font-semibold">Project tasks</h3><ul className="space-y-2">{checklist.map(task => <li key={task.id}><Link href="/tasks" className="flex items-start gap-2 text-sm text-muted-foreground">{task.status === "done" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{task.title}</span></Link></li>)}</ul></div>}
          <Button asChild className="mt-auto"><Link href={`/projects/${selected.id}`}>Open project<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </> : <><h2 className="text-base font-semibold">Project preview</h2><p className="text-sm text-muted-foreground">Project details and next steps will appear here when a project is selected.</p><Button asChild variant="outline" className="mt-auto"><Link href="/projects">View projects</Link></Button></>}
      </aside>
      <div className="workspace-overview-footer">
        <WorkspacePagination {...(taskMode ? taskPage : projectPage)} />
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3" aria-label="Project pipeline">{stages.map(([key, label, color]) => <Link key={key} href={`/projects?status=${key}`} className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${color}`} />{label}<strong>{counts.get(key) ?? 0}</strong></Link>)}</div>
      </div>
    </div>
  );
}
