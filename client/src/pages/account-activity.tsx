import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";
import type { AccountAuditLog, User } from "@shared/schema";

function formatChange(entry: AccountAuditLog, userMap: Map<string, User>) {
  const target = entry.targetEmail || (entry.targetUserId ? userMap.get(entry.targetUserId)?.email : null) || "(unknown user)";
  const actor = entry.actorEmail || (entry.actorUserId ? userMap.get(entry.actorUserId)?.email : null) || "system";
  switch (entry.action) {
    case "role_change":
      return `${actor} changed ${target}'s role from ${entry.beforeRole ?? "?"} to ${entry.afterRole ?? "?"}`;
    case "client_link_change":
      return `${actor} changed ${target}'s client link from ${entry.beforeClientId ?? "none"} to ${entry.afterClientId ?? "none"}`;
    case "account_deleted":
      return `${actor} deleted account ${target} (was ${entry.beforeRole ?? "?"})`;
    case "account_restored":
      return `${actor} restored ${target} from ${entry.beforeRole ?? "?"} back to ${entry.afterRole ?? "?"}`;
    default:
      return `${actor} updated ${target}`;
  }
}

export default function AccountActivityPage() {
  const [targetFilter, setTargetFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const params = new URLSearchParams();
  if (targetFilter) params.set("targetUserId", targetFilter);
  if (startDate) params.set("startDate", new Date(startDate).toISOString());
  if (endDate) params.set("endDate", new Date(endDate).toISOString());
  const qs = params.toString();

  const { data: entries = [], isLoading } = useQuery<AccountAuditLog[]>({
    queryKey: ["/api/account-audit-logs", qs],
    queryFn: async () => {
      const res = await fetch(`/api/account-audit-logs${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  return (
    <div className="space-y-6" data-testid="page-account-activity">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Account Activity</h1>
          <p className="text-sm text-muted-foreground">
            Every role change, client-link change, and account deletion is recorded here.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="filter-target">Target user</Label>
            <select
              id="filter-target"
              data-testid="select-target-user"
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filter-start">From</Label>
            <Input
              id="filter-start"
              data-testid="input-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="filter-end">To</Label>
            <Input
              id="filter-end"
              data-testid="input-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-muted-foreground" data-testid="text-empty">
              No account changes match your filters.
            </div>
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="py-3 flex items-start justify-between gap-4"
                  data-testid={`row-audit-${entry.id}`}
                >
                  <div className="flex-1">
                    <p className="text-sm">{formatChange(entry, userMap)}</p>
                    {entry.reason && (
                      <p className="text-xs text-muted-foreground mt-1">Reason: {entry.reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline">{entry.action.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {entry.createdAt
                        ? format(new Date(entry.createdAt), "MM-dd-yyyy h:mm a")
                        : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
