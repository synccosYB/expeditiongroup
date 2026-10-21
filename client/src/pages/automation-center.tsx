import { useEffect, useState } from "react";

type Rule = { id: string; version: number; name: string; enabled: boolean; triggerType: string; requiresApproval: boolean };
type Execution = { id: string; status: string; ruleId: string; eventId: string; createdAt: string; lastError?: string | null };
const triggers = ["client.created", "intake.converted", "project.created", "project.status_changed", "task.created", "task.completed", "document.uploaded", "document.reviewed", "document_request.completed", "milestone.completed", "proposal.accepted", "invoice.status_changed", "bill.status_changed", "payment.recorded"];
export default function AutomationCenter() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("project.created");
  const [action, setAction] = useState("create_task");
  const [title, setTitle] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [r, e] = await Promise.all([fetch("/api/automation/rules"), fetch("/api/automation/executions")]);
    if (!r.ok || !e.ok) throw new Error("Unable to load automation records");
    setRules(await r.json()); setExecutions(await e.json());
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  const create = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/automation/rules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(), version: 1, name, enabled: false,
          trigger, conditions: [], requiresApproval,
          actions: [{ type: action, ...(action === "notify_internal" ? { message: title } : { title }) }],
        }),
      });
      if (!response.ok) throw new Error((await response.json()).message ?? "Unable to create rule");
      setName(""); setTitle(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create rule"); }
    finally { setBusy(false); }
  };
  const approve = async (id: string) => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/automation/executions/${encodeURIComponent(id)}/approve`, { method: "POST" });
      if (!r.ok) throw new Error("Approval failed");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Approval failed"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold">Automation Center</h1><p className="text-sm text-muted-foreground">Create draft rules, review execution history, and approve pending work. Rules start disabled.</p></div>
    {error && <div role="alert" className="rounded border border-destructive p-3 text-sm text-destructive">{error}</div>}
    <section className="rounded-lg border p-4 space-y-3">
      <h2 className="font-semibold">New draft rule</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Rule name<input className="w-full rounded border p-2 bg-background" value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="text-sm">Trigger<select className="w-full rounded border p-2 bg-background" value={trigger} onChange={e=>setTrigger(e.target.value)}>{triggers.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="text-sm">Action<select className="w-full rounded border p-2 bg-background" value={action} onChange={e=>setAction(e.target.value)}><option value="create_task">Create task</option><option value="create_document_request">Request document</option><option value="notify_internal">Internal notification (not configured)</option></select></label>
        <label className="text-sm">Action text<input className="w-full rounded border p-2 bg-background" value={title} onChange={e=>setTitle(e.target.value)} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresApproval} onChange={e=>setRequiresApproval(e.target.checked)}/>Require approval</label>
      <button disabled={busy || !name.trim() || !title.trim()} onClick={create} className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50">Save disabled draft</button>
    </section>
    <section className="rounded-lg border p-4"><h2 className="font-semibold mb-2">Rules ({rules.length})</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Rule</th><th>Trigger</th><th>Version</th><th>Status</th></tr></thead><tbody>{rules.map(r=><tr className="border-b" key={r.id+":"+r.version}><td className="p-2">{r.name}</td><td>{r.triggerType}</td><td>{r.version}</td><td>{r.enabled ? "Enabled" : "Disabled"}</td></tr>)}</tbody></table></div>
    </section>
    <section className="rounded-lg border p-4"><h2 className="font-semibold mb-2">Recent executions ({executions.length})</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Rule</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{executions.map(e=><tr className="border-b" key={e.id}><td className="p-2">{e.ruleId}</td><td>{e.status}{e.lastError ? `: ${e.lastError}` : ""}</td><td>{new Date(e.createdAt).toLocaleString()}</td><td>{e.status==="awaiting_approval" && <button disabled={busy} onClick={()=>approve(e.id)} className="rounded border px-2 py-1">Approve</button>}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
