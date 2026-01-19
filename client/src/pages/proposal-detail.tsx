import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatLocalDate } from "@/lib/dateUtils";
import { ArrowLeft, Save, Plus, Trash2, Calculator, Send, CheckCircle, XCircle } from "lucide-react";
import type { Proposal, Client, ProposalItem, Service } from "@shared/schema";

type ProposalWithDetails = Proposal & { client?: Client; items: ProposalItem[] };

const categoryLabels: Record<string, string> = {
  accounting: "Accounting",
  write_up: "Write Up",
  bookkeeping: "Bookkeeping",
  cfo: "CFO Services",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

interface ProposalItemForm {
  id?: number;
  serviceId?: number;
  name: string;
  description?: string;
  category?: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export default function ProposalDetail() {
  const [, params] = useRoute("/proposals/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = params?.id === "new";
  const proposalId = isNew ? null : parseInt(params?.id || "0");

  const [formData, setFormData] = useState({
    proposalNumber: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientCompany: "",
    title: "",
    description: "",
    status: "draft",
    notes: "",
    validUntil: "",
  });

  const [items, setItems] = useState<ProposalItemForm[]>([]);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);

  const { data: proposal, isLoading: proposalLoading } = useQuery<ProposalWithDetails>({
    queryKey: ["/api/proposals", proposalId],
    enabled: !isNew && !!proposalId,
  });

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: nextNumber } = useQuery<{ proposalNumber: string }>({
    queryKey: ["/api/proposals/next-number"],
    enabled: isNew,
  });

  useEffect(() => {
    if (isNew && nextNumber) {
      setFormData(prev => ({ ...prev, proposalNumber: nextNumber.proposalNumber }));
    }
  }, [isNew, nextNumber]);

  useEffect(() => {
    if (proposal) {
      setFormData({
        proposalNumber: proposal.proposalNumber,
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail || "",
        clientPhone: proposal.clientPhone || "",
        clientCompany: proposal.clientCompany || "",
        title: proposal.title,
        description: proposal.description || "",
        status: proposal.status,
        notes: proposal.notes || "",
        validUntil: proposal.validUntil ? new Date(proposal.validUntil).toISOString().split('T')[0] : "",
      });
      setItems(proposal.items.map(item => ({
        id: item.id,
        serviceId: item.serviceId || undefined,
        name: item.name,
        description: item.description || "",
        category: item.category || "",
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice,
        amount: item.amount,
      })));
    }
  }, [proposal]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/proposals", data);
      return response.json();
    },
    onSuccess: (newProposal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal created successfully" });
      navigate(`/proposals/${newProposal.id}`);
    },
    onError: () => {
      toast({ title: "Failed to create proposal", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/proposals/${proposalId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update proposal", variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: any) => {
      const response = await apiRequest("POST", `/api/proposals/${proposalId}/items`, item);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/proposal-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId] });
    },
  });

  const seedServicesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/services/seed", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Services loaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to load services", variant: "destructive" });
    },
  });

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
    return {
      subtotal: subtotal.toFixed(2),
      tax: "0.00",
      total: subtotal.toFixed(2),
    };
  };

  const updateItemAmount = (index: number, quantity: string, unitPrice: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const amount = (qty * price).toFixed(2);
    
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity, unitPrice, amount };
      return updated;
    });
  };

  const addSelectedServices = () => {
    if (!services) return;
    
    const newItems = selectedServices.map(serviceId => {
      const service = services.find(s => s.id === serviceId);
      if (!service) return null;
      return {
        serviceId: service.id,
        name: service.name,
        description: service.description || "",
        category: service.category,
        quantity: "1",
        unitPrice: service.defaultPrice || "0",
        amount: service.defaultPrice || "0",
      };
    }).filter(Boolean) as ProposalItemForm[];

    setItems(prev => [...prev, ...newItems]);
    setSelectedServices([]);
    setAddServiceOpen(false);
  };

  const removeItem = (index: number) => {
    const item = items[index];
    if (item.id && proposalId) {
      deleteItemMutation.mutate(item.id);
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const totals = calculateTotals();
    const data = {
      ...formData,
      validUntil: formData.validUntil || null,
      ...totals,
      items: items.map(item => ({
        name: item.name,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        serviceId: item.serviceId,
      })),
    };

    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setFormData(prev => ({ ...prev, status: newStatus }));
    if (!isNew) {
      updateMutation.mutate({ status: newStatus });
    }
  };

  const groupedServices = services?.reduce((acc, service) => {
    const category = service.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>) || {};

  if (proposalLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sales-pipeline")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              {isNew ? "New Proposal" : `Proposal ${formData.proposalNumber}`}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? "Create a new proposal" : "Edit proposal details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Badge className={statusColors[formData.status]}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
            </Badge>
          )}
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
            <Save className="h-4 w-4 mr-2" />
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="Enter client name"
                    data-testid="input-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientCompany">Company</Label>
                  <Input
                    id="clientCompany"
                    value={formData.clientCompany}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientCompany: e.target.value }))}
                    placeholder="Enter company name"
                    data-testid="input-client-company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                    placeholder="Enter email"
                    data-testid="input-client-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Phone</Label>
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                    placeholder="Enter phone"
                    data-testid="input-client-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Annual Accounting Package"
                    data-testid="input-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                    data-testid="input-valid-until"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the proposal"
                  rows={3}
                  data-testid="input-description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Services</CardTitle>
                <CardDescription>Add services from your catalog or create custom items</CardDescription>
              </div>
              <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-service">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Services
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Services to Proposal</DialogTitle>
                    <DialogDescription>
                      Select services to add to this proposal
                    </DialogDescription>
                  </DialogHeader>
                  
                  {(!services || services.length === 0) ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No services available. Load default services to get started.</p>
                      <Button 
                        onClick={() => seedServicesMutation.mutate()}
                        disabled={seedServicesMutation.isPending}
                        data-testid="button-seed-services"
                      >
                        Load Default Services
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Accordion type="multiple" className="w-full" defaultValue={Object.keys(groupedServices)}>
                        {Object.entries(groupedServices).map(([category, categoryServices]) => (
                          <AccordionItem key={category} value={category}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{categoryLabels[category] || category}</span>
                                <Badge variant="secondary">{categoryServices.length}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {categoryServices.map(service => (
                                  <div key={service.id} className="flex items-start gap-3 py-2">
                                    <Checkbox
                                      id={`service-${service.id}`}
                                      checked={selectedServices.includes(service.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedServices(prev => [...prev, service.id]);
                                        } else {
                                          setSelectedServices(prev => prev.filter(id => id !== service.id));
                                        }
                                      }}
                                      data-testid={`checkbox-service-${service.id}`}
                                    />
                                    <div className="flex-1">
                                      <label htmlFor={`service-${service.id}`} className="font-medium cursor-pointer">
                                        {service.name}
                                      </label>
                                      {service.description && (
                                        <p className="text-sm text-muted-foreground">{service.description}</p>
                                      )}
                                    </div>
                                    {service.defaultPrice && (
                                      <span className="text-sm font-medium">${service.defaultPrice}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="outline" onClick={() => setAddServiceOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={addSelectedServices}
                          disabled={selectedServices.length === 0}
                          data-testid="button-confirm-add-services"
                        >
                          Add {selectedServices.length} Service{selectedServices.length !== 1 ? 's' : ''}
                        </Button>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No services added yet</p>
                  <p className="text-sm">Click "Add Services" to select from your catalog</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 border rounded-md">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={item.name}
                            onChange={(e) => setItems(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], name: e.target.value };
                              return updated;
                            })}
                            placeholder="Service name"
                            className="font-medium"
                            data-testid={`input-item-name-${index}`}
                          />
                          {item.category && (
                            <Badge variant="outline">{categoryLabels[item.category] || item.category}</Badge>
                          )}
                        </div>
                        <Input
                          value={item.description || ""}
                          onChange={(e) => setItems(prev => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], description: e.target.value };
                            return updated;
                          })}
                          placeholder="Description (optional)"
                          className="text-sm"
                          data-testid={`input-item-description-${index}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemAmount(index, e.target.value, item.unitPrice)}
                          className="w-20 text-right"
                          min="1"
                          data-testid={`input-item-quantity-${index}`}
                        />
                        <span className="text-muted-foreground">x</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItemAmount(index, item.quantity, e.target.value)}
                            className="w-28 pl-7 text-right"
                            step="0.01"
                            data-testid={`input-item-price-${index}`}
                          />
                        </div>
                        <span className="text-muted-foreground">=</span>
                        <span className="font-medium w-24 text-right">${item.amount}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          data-testid={`button-remove-item-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${calculateTotals().subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">${calculateTotals().tax}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold" data-testid="text-proposal-total">${calculateTotals().total}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {formData.status === "draft" && (
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => handleStatusChange("sent")}
                    data-testid="button-mark-sent"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Mark as Sent
                  </Button>
                )}
                {formData.status === "sent" && (
                  <>
                    <Button 
                      className="w-full" 
                      variant="default"
                      onClick={() => handleStatusChange("accepted")}
                      data-testid="button-mark-accepted"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Accepted
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleStatusChange("rejected")}
                      data-testid="button-mark-rejected"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark as Rejected
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal notes about this proposal"
                rows={4}
                data-testid="input-notes"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
