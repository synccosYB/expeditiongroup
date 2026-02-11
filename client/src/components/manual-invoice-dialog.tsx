import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { Client } from "@shared/schema";

interface ManualInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function ManualInvoiceDialog({ isOpen, onClose }: ManualInvoiceDialogProps) {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [customItems, setCustomItems] = useState<CustomLineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" },
  ]);
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

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      refetchNextNumber();
    }
  }, [isOpen, refetchNextNumber]);

  useEffect(() => {
    if (selectedClientId && clients) {
      const client = clients.find((c) => c.id.toString() === selectedClientId);
      if (client) {
        setRecipientName(client.name || "");
        setRecipientEmail(client.email || "");
        setRecipientAddress(client.address || "");
      }
    }
  }, [selectedClientId, clients]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: () => {
      toast({ title: "Invoice created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedClientId("");
    setRecipientName("");
    setRecipientEmail("");
    setRecipientAddress("");
    setCustomItems([{ id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "" }]);
    setNotes("");
    setDueDate(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
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

  const { grandTotal, lineItems } = useMemo(() => {
    let total = 0;
    const items: any[] = [];

    customItems.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const amount = qty * price;
      total += amount;
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
      grandTotal: total,
      lineItems: items,
    };
  }, [customItems]);

  const handleSubmit = () => {
    if (lineItems.length === 0) {
      toast({ title: "Please add at least one line item", variant: "destructive" });
      return;
    }

    if (!selectedClientId && !recipientName.trim()) {
      toast({ title: "Please select a client or enter a recipient name", variant: "destructive" });
      return;
    }

    if (!nextNumber?.invoiceNumber) {
      toast({ title: "Invoice number not ready yet, please wait", variant: "destructive" });
      return;
    }

    const data: any = {
      invoiceNumber: nextNumber.invoiceNumber,
      subtotal: grandTotal.toFixed(2),
      total: grandTotal.toFixed(2),
      notes: notes || null,
      dueDate: dueDate || null,
      items: lineItems,
    };

    if (selectedClientId) {
      data.clientId = parseInt(selectedClientId);
    }

    if (recipientName) data.recipientName = recipientName;
    if (recipientEmail) data.recipientEmail = recipientEmail;
    if (recipientAddress) data.recipientAddress = recipientAddress;

    createInvoiceMutation.mutate(data);
  };

  const handleClientChange = (value: string) => {
    if (value === "none") {
      setSelectedClientId("");
      setRecipientName("");
      setRecipientEmail("");
      setRecipientAddress("");
    } else {
      setSelectedClientId(value);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Manual Invoice
          </DialogTitle>
          <DialogDescription>
            Create a standalone invoice with custom line items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <Input value={nextNumber?.invoiceNumber || "Loading..."} disabled data-testid="input-manual-invoice-number" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-manual-due-date"
              />
            </div>
          </div>

          <div>
            <Label>Link to Client (optional)</Label>
            <Select value={selectedClientId || "none"} onValueChange={handleClientChange}>
              <SelectTrigger data-testid="select-manual-client">
                <SelectValue placeholder="Select a client (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Client</SelectItem>
                {clients?.filter(c => c.status !== "archived").map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Recipient Name</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient name"
                data-testid="input-recipient-name"
              />
            </div>
            <div>
              <Label>Recipient Email</Label>
              <Input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Recipient email"
                data-testid="input-recipient-email"
              />
            </div>
          </div>

          <div>
            <Label>Recipient Address</Label>
            <Textarea
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="Recipient address"
              className="resize-none"
              data-testid="textarea-recipient-address"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button variant="outline" size="sm" onClick={addCustomItem} data-testid="button-add-manual-item">
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
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateCustomItem(item.id, "description", e.target.value)}
                      data-testid={`input-manual-desc-${item.id}`}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateCustomItem(item.id, "quantity", e.target.value)}
                      data-testid={`input-manual-qty-${item.id}`}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => updateCustomItem(item.id, "unitPrice", e.target.value)}
                      data-testid={`input-manual-price-${item.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomItem(item.id)}
                      className="col-span-1"
                      disabled={customItems.length === 1}
                      data-testid={`button-remove-manual-${item.id}`}
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
              data-testid="textarea-manual-notes"
            />
          </div>

          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span data-testid="text-manual-total">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-manual-invoice">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createInvoiceMutation.isPending || lineItems.length === 0 || !nextNumber?.invoiceNumber}
            data-testid="button-create-manual-invoice"
          >
            {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
