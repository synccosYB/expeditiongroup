import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Item = { id: number; name: string; description: string | null; unit: string; defaultRate: string; isActive: boolean; sortOrder: number };
type Draft = { name: string; description: string; unit: "hour" | "each" | "flat"; defaultRate: string };
const empty: Draft = { name: "", description: "", unit: "hour", defaultRate: "0" };
export function BillingItemsManager() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/billing-items"], enabled: open });
  const save = useMutation({
    mutationFn: async (body: Draft) => apiRequest("POST", "/api/billing-items", body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/billing-items"] }); setDraft(empty); toast({ title: "Item saved" }); },
    onError: (error: Error) => toast({ title: "Item not saved", description: error.message, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: Partial<Item> }) => apiRequest("PATCH", `/api/billing-items/${id}`, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/billing-items"] }),
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" data-testid="button-manage-billing-items">Items & rates</Button></DialogTrigger>
    <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Billable items & hourly rates</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">Preset services start disabled until you configure their prices. Enabling an item makes it available on new invoices; older invoices never change.</p>
      <div className="space-y-2">
        {items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center border-b pb-2">
          <span className={item.isActive ? "text-sm" : "text-sm text-muted-foreground line-through"}>{item.name} ({item.unit})</span>
          <Input aria-label={item.name + " price"} defaultValue={item.defaultRate} key={item.id + ":" + item.defaultRate} type="number" min="0" step="0.01" onBlur={(e) => {
            if (e.target.value !== item.defaultRate && Number(e.target.value) >= 0) update.mutate({ id: item.id, values: { defaultRate: e.target.value } });
          }} />
          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: item.id, values: { isActive: !item.isActive } })}>{item.isActive ? "Disable" : "Enable"}</Button>
        </div>)}
      </div>
      <div className="space-y-3 border-t pt-3">
        <Label>New item</Label>
        <Input placeholder="Name (e.g. Site Visit)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input placeholder="Optional description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={draft.unit} onValueChange={(value: Draft["unit"]) => setDraft({ ...draft, unit: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="hour">Per hour</SelectItem><SelectItem value="each">Each</SelectItem><SelectItem value="flat">Flat fee</SelectItem></SelectContent>
          </Select>
          <Input type="number" min="0" step="0.01" placeholder="Default price" value={draft.defaultRate} onChange={(e) => setDraft({ ...draft, defaultRate: e.target.value })} />
        </div>
        <Button disabled={!draft.name.trim() || !Number.isFinite(Number(draft.defaultRate)) || Number(draft.defaultRate) < 0 || save.isPending} onClick={() => save.mutate(draft)}>Add item</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
