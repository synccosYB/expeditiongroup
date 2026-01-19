import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { TimeLog, TimeEntry, Project, Client } from "@shared/schema";

interface InvoiceGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project & { client: Client };
  timeLogs: TimeLog[];
  timeEntries: TimeEntry[];
}

interface CustomLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface BilledItems {
  timeLogIds: number[];
  timeEntryIds: number[];
}

export function InvoiceGenerationDialog({
  isOpen,
  onClose,
  project,
  timeLogs,
  timeEntries,
}: InvoiceGenerationDialogProps) {
  const { toast } = useToast();
  const [hourlyRate, setHourlyRate] = useState(project.client.hourlyRate || "75");
  const [selectedTimeLogs, setSelectedTimeLogs] = useState<Set<number>>(new Set());
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<Set<number>>(new Set());
  const [customItems, setCustomItems] = useState<CustomLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
  );

  const { data: nextNumber, refetch: refetchNextNumber } = useQuery<{ invoiceNumber: string }>({
    queryKey: ["/api/invoices/next-number"],
    enabled: isOpen,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (isOpen) {
      refetchNextNumber();
    }
  }, [isOpen, refetchNextNumber]);

  const { data: billedItems } = useQuery<BilledItems>({
    queryKey: ["/api/projects", project.id, "billed-items"],
    enabled: isOpen,
  });

  const unbilledTimeLogs = useMemo(() => {
    if (!billedItems) return timeLogs;
    return timeLogs.filter((log) => !billedItems.timeLogIds.includes(log.id));
  }, [timeLogs, billedItems]);

  const unbilledTimeEntries = useMemo(() => {
    if (!billedItems) return timeEntries;
    return timeEntries.filter((entry) => !billedItems.timeEntryIds.includes(entry.id));
  }, [timeEntries, billedItems]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: () => {
      toast({ title: "Invoice created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", String(project.id)] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "billed-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", project.clientId, "invoices"] });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedTimeLogs(new Set());
    setSelectedTimeEntries(new Set());
    setCustomItems([]);
    setNotes("");
  };

  const selectAllTimeLogs = () => {
    setSelectedTimeLogs(new Set(unbilledTimeLogs.map((l) => l.id)));
  };

  const selectAllTimeEntries = () => {
    const billableEntries = unbilledTimeEntries.filter((e) => e.isBillable !== false);
    setSelectedTimeEntries(new Set(billableEntries.map((e) => e.id)));
  };

  const addCustomItem = () => {
    setCustomItems([
      ...customItems,
      { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" },
    ]);
  };

  const updateCustomItem = (id: string, field: keyof CustomLineItem, value: string) => {
    setCustomItems(
      customItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeCustomItem = (id: string) => {
    setCustomItems(customItems.filter((item) => item.id !== id));
  };

  const { timeBasedTotal, customTotal, grandTotal, lineItems } = useMemo(() => {
    const rate = parseFloat(hourlyRate) || 0;
    let timeTotal = 0;
    const items: any[] = [];

    timeLogs.forEach((log) => {
      if (selectedTimeLogs.has(log.id)) {
        const hours = parseFloat(log.totalHours) || 0;
        const amount = hours * rate;
        timeTotal += amount;
        items.push({
          description: `${formatLocalDate(log.date)} - ${log.taskDescription}`,
          quantity: log.totalHours,
          unitPrice: hourlyRate,
          amount: amount.toFixed(2),
          timeLogId: log.id,
          isCustom: false,
        });
      }
    });

    timeEntries.forEach((entry) => {
      if (selectedTimeEntries.has(entry.id)) {
        const hours = (entry.totalMinutes || 0) / 60;
        const amount = hours * rate;
        timeTotal += amount;
        items.push({
          description: `${formatLocalDate(entry.date)} - ${entry.notes || "Task work"}`,
          quantity: hours.toFixed(2),
          unitPrice: hourlyRate,
          amount: amount.toFixed(2),
          timeEntryId: entry.id,
          isCustom: false,
        });
      }
    });

    let customTotal = 0;
    customItems.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const amount = qty * price;
      customTotal += amount;
      if (item.description && (qty > 0 || price > 0)) {
        items.push({
          description: item.description,
          quantity: item.quantity || "1",
          unitPrice: item.unitPrice || "0",
          amount: amount.toFixed(2),
          isCustom: true,
        });
      }
    });

    return {
      timeBasedTotal: timeTotal,
      customTotal: customTotal,
      grandTotal: timeTotal + customTotal,
      lineItems: items,
    };
  }, [selectedTimeLogs, selectedTimeEntries, customItems, hourlyRate, timeLogs, timeEntries]);

  const handleSubmit = () => {
    if (lineItems.length === 0) {
      toast({ title: "Please select at least one time entry or add a custom line item", variant: "destructive" });
      return;
    }

    createInvoiceMutation.mutate({
      invoiceNumber: nextNumber?.invoiceNumber || `INV-${Date.now()}`,
      projectId: project.id,
      clientId: project.clientId,
      hourlyRate: hourlyRate,
      subtotal: grandTotal.toFixed(2),
      total: grandTotal.toFixed(2),
      notes: notes || null,
      dueDate: dueDate || null,
      items: lineItems,
    });
  };

  const hasUnbilledTimeLogs = unbilledTimeLogs.length > 0;
  const hasUnbilledTimeEntries = unbilledTimeEntries.length > 0;
  const hasBillableEntries = unbilledTimeEntries.some((e) => e.isBillable !== false);
  const billedTimeLogsCount = billedItems?.timeLogIds.length || 0;
  const billedTimeEntriesCount = billedItems?.timeEntryIds.length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <Input value={nextNumber?.invoiceNumber || "Loading..."} disabled data-testid="input-invoice-number" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-invoice-due-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Client</Label>
              <Input value={project.client.name} disabled />
            </div>
            <div>
              <Label>Hourly Rate ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="75.00"
                data-testid="input-hourly-rate"
              />
            </div>
          </div>

          {(hasUnbilledTimeLogs || hasUnbilledTimeEntries) ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Select Time Entries</Label>
                <div className="flex gap-2">
                  {hasUnbilledTimeLogs && (
                    <Button variant="outline" size="sm" onClick={selectAllTimeLogs} data-testid="button-select-all-logs">
                      Select All Logs
                    </Button>
                  )}
                  {hasBillableEntries && (
                    <Button variant="outline" size="sm" onClick={selectAllTimeEntries} data-testid="button-select-all-entries">
                      Select All Entries
                    </Button>
                  )}
                </div>
              </div>

              <div className="border rounded-md max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-10"></th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unbilledTimeEntries.filter((e) => e.isBillable !== false).map((entry) => (
                      <tr key={`entry-${entry.id}`} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedTimeEntries.has(entry.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedTimeEntries);
                              if (checked) newSet.add(entry.id);
                              else newSet.delete(entry.id);
                              setSelectedTimeEntries(newSet);
                            }}
                            data-testid={`checkbox-entry-${entry.id}`}
                          />
                        </td>
                        <td className="p-2">{formatLocalDate(entry.date)}</td>
                        <td className="p-2 truncate max-w-[200px]">{entry.notes || "Task work"}</td>
                        <td className="p-2 text-right">{((entry.totalMinutes || 0) / 60).toFixed(2)}</td>
                      </tr>
                    ))}
                    {unbilledTimeLogs.map((log) => (
                      <tr key={`log-${log.id}`} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedTimeLogs.has(log.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedTimeLogs);
                              if (checked) newSet.add(log.id);
                              else newSet.delete(log.id);
                              setSelectedTimeLogs(newSet);
                            }}
                            data-testid={`checkbox-log-${log.id}`}
                          />
                        </td>
                        <td className="p-2">{formatLocalDate(log.date)}</td>
                        <td className="p-2 truncate max-w-[200px]">{log.taskDescription}</td>
                        <td className="p-2 text-right">{log.totalHours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(billedTimeLogsCount > 0 || billedTimeEntriesCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {billedTimeLogsCount + billedTimeEntriesCount} item(s) already billed and not shown
                </p>
              )}
            </div>
          ) : (timeLogs.length > 0 || timeEntries.length > 0) ? (
            <div className="p-4 border rounded-md bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">
                All time entries have already been billed
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can still add custom line items below
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Custom Line Items</Label>
              <Button variant="outline" size="sm" onClick={addCustomItem} data-testid="button-add-custom-item">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {customItems.length > 0 && (
              <div className="space-y-2">
                {customItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-6"
                      placeholder="Description (e.g., Filing fee)"
                      value={item.description}
                      onChange={(e) => updateCustomItem(item.id, "description", e.target.value)}
                      data-testid={`input-custom-desc-${item.id}`}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateCustomItem(item.id, "quantity", e.target.value)}
                      data-testid={`input-custom-qty-${item.id}`}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => updateCustomItem(item.id, "unitPrice", e.target.value)}
                      data-testid={`input-custom-price-${item.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomItem(item.id)}
                      className="col-span-1"
                      data-testid={`button-remove-custom-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this invoice..."
              className="resize-none"
              data-testid="textarea-invoice-notes"
            />
          </div>

          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex justify-between text-sm">
              <span>Time-based subtotal:</span>
              <span>${timeBasedTotal.toFixed(2)}</span>
            </div>
            {customTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span>Custom items:</span>
                <span>${customTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total:</span>
              <span data-testid="text-invoice-total">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createInvoiceMutation.isPending || lineItems.length === 0}
            data-testid="button-create-invoice"
          >
            {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
