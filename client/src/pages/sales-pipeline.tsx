import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatLocalDate } from "@/lib/dateUtils";
import { Plus, MoreHorizontal, Eye, Trash2, FileText, DollarSign, Users, Clock, ArrowRight, ChevronRight, Building2, Mail, Phone, GripVertical } from "lucide-react";
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SalesContact, Proposal, Client, ProposalItem } from "@shared/schema";

type ProposalWithDetails = Proposal & { client?: Client; items: ProposalItem[] };

const stageColors: Record<string, string> = {
  lead: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  qualified: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  meeting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  proposal: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const stageLabels: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  meeting: "Meeting",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const proposalStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const proposalStatusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

const pipelineStages = ["lead", "qualified", "meeting", "proposal", "won", "lost"];

function DraggableContactCard({ 
  contact, 
  onDelete, 
  onMoveToNext, 
  onMarkWon, 
  onMarkLost,
  onNavigate 
}: { 
  contact: SalesContact; 
  onDelete: () => void;
  onMoveToNext: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onNavigate: (path: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `contact-${contact.id}`,
    data: { contact },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-grab active:cursor-grabbing"
      data-testid={`card-contact-${contact.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1">
            <div {...attributes} {...listeners} className="cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="font-medium text-sm truncate">{contact.name}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-contact-menu-${contact.id}`}>
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNavigate("/sales-contacts")}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {!["won", "lost"].includes(contact.stage) && (
                <DropdownMenuItem onClick={onMoveToNext}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to Next Stage
                </DropdownMenuItem>
              )}
              {contact.stage === "proposal" && !contact.proposalId && (
                <DropdownMenuItem onClick={() => onNavigate(`/proposals/new?contactId=${contact.id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Proposal
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onMarkWon} className="text-green-600">
                Mark as Won
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMarkLost} className="text-red-600">
                Mark as Lost
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {contact.company && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{contact.company}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact.estimatedValue && parseFloat(contact.estimatedValue) > 0 && (
          <div className="text-xs font-medium text-green-600">
            ${parseFloat(contact.estimatedValue).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DroppableStageColumn({ 
  stage, 
  contacts, 
  children 
}: { 
  stage: string; 
  contacts: SalesContact[];
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `stage-${stage}`,
    data: { stage },
  });

  return (
    <div className="space-y-2" data-testid={`column-${stage}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Badge className={stageColors[stage]}>{stageLabels[stage]}</Badge>
          <span className="text-muted-foreground">({contacts.length})</span>
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver ? "bg-primary/10 border-2 border-dashed border-primary" : "bg-muted/30"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function SalesPipeline() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteContactId, setDeleteContactId] = useState<number | null>(null);
  const [deleteProposalId, setDeleteProposalId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("pipeline");
  const [activeContact, setActiveContact] = useState<SalesContact | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: contacts, isLoading: contactsLoading } = useQuery<SalesContact[]>({
    queryKey: ["/api/sales-contacts"],
  });

  const { data: proposals, isLoading: proposalsLoading } = useQuery<ProposalWithDetails[]>({
    queryKey: ["/api/proposals"],
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
      return await apiRequest("PATCH", `/api/sales-contacts/${id}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-contacts"] });
      toast({ title: "Contact stage updated" });
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sales-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-contacts"] });
      toast({ title: "Contact deleted successfully" });
      setDeleteContactId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete contact", variant: "destructive" });
    },
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/proposals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal deleted successfully" });
      setDeleteProposalId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete proposal", variant: "destructive" });
    },
  });

  const moveToNextStage = (contact: SalesContact) => {
    const currentIndex = pipelineStages.indexOf(contact.stage);
    if (currentIndex < pipelineStages.length - 2) {
      const nextStage = pipelineStages[currentIndex + 1];
      updateContactMutation.mutate({ id: contact.id, stage: nextStage });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const contact = event.active.data.current?.contact as SalesContact;
    setActiveContact(contact);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);

    if (!over) return;

    const overId = over.id.toString();
    if (!overId.startsWith("stage-")) return;

    const newStage = overId.replace("stage-", "");
    const contact = active.data.current?.contact as SalesContact;

    if (contact && contact.stage !== newStage) {
      updateContactMutation.mutate({ id: contact.id, stage: newStage });
    }
  };

  const getContactsByStage = (stage: string) => {
    return contacts?.filter((c) => c.stage === stage) || [];
  };

  const stats = {
    totalContacts: contacts?.length || 0,
    activeContacts: contacts?.filter((c) => !["won", "lost"].includes(c.stage)).length || 0,
    wonContacts: contacts?.filter((c) => c.stage === "won").length || 0,
    pipelineValue: contacts
      ?.filter((c) => !["won", "lost"].includes(c.stage))
      .reduce((sum, c) => sum + parseFloat(c.estimatedValue || "0"), 0) || 0,
    totalProposals: proposals?.filter(Boolean).length || 0,
    wonDeals: proposals?.filter(Boolean).filter((p) => p.status === "accepted").length || 0,
    proposalValue: proposals?.filter(Boolean).reduce((sum, p) => sum + parseFloat(p?.total || "0"), 0) || 0,
  };

  const isLoading = contactsLoading || proposalsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Sales Pipeline</h1>
          <p className="text-muted-foreground">Drag contacts between stages to update their progress</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/sales-contacts")} data-testid="button-manage-contacts">
            <Users className="h-4 w-4 mr-2" />
            Manage Contacts
          </Button>
          <Button onClick={() => navigate("/proposals/new")} data-testid="button-new-proposal">
            <Plus className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-contacts">{stats.activeContacts}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pipeline-value">
              ${stats.pipelineValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Estimated value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proposals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-proposals">{stats.totalProposals}</div>
            <p className="text-xs text-muted-foreground">{stats.wonDeals} accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proposal Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-proposal-value">
              ${stats.proposalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total value</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList data-testid="tabs-pipeline-view">
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline Board</TabsTrigger>
          <TabsTrigger value="proposals" data-testid="tab-proposals">Proposals</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {pipelineStages.map((stage) => (
                <DroppableStageColumn
                  key={stage}
                  stage={stage}
                  contacts={getContactsByStage(stage)}
                >
                  {getContactsByStage(stage).map((contact) => (
                    <DraggableContactCard
                      key={contact.id}
                      contact={contact}
                      onDelete={() => setDeleteContactId(contact.id)}
                      onMoveToNext={() => moveToNextStage(contact)}
                      onMarkWon={() => updateContactMutation.mutate({ id: contact.id, stage: "won" })}
                      onMarkLost={() => updateContactMutation.mutate({ id: contact.id, stage: "lost" })}
                      onNavigate={navigate}
                    />
                  ))}
                  {getContactsByStage(stage).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      Drop contacts here
                    </div>
                  )}
                </DroppableStageColumn>
              ))}
            </div>
            <DragOverlay>
              {activeContact ? (
                <Card className="opacity-80 shadow-lg">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="font-medium text-sm truncate">{activeContact.name}</div>
                      </div>
                    </div>
                    {activeContact.company && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{activeContact.company}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="proposals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              {!proposals || proposals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No proposals yet</p>
                  <p className="text-sm">Create your first proposal to get started</p>
                  <Button className="mt-4" onClick={() => navigate("/proposals/new")} data-testid="button-create-first-proposal">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Proposal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <Card
                      key={proposal.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => navigate(`/proposals/${proposal.id}`)}
                      data-testid={`row-proposal-${proposal.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{proposal.proposalNumber}</span>
                              <Badge className={proposalStatusColors[proposal.status]}>
                                {proposalStatusLabels[proposal.status]}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">{proposal.title}</div>
                            <div className="text-sm mt-1">
                              <span className="font-medium">{proposal.clientName}</span>
                              {proposal.clientCompany && (
                                <span className="text-muted-foreground"> - {proposal.clientCompany}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              ${parseFloat(proposal?.total || "0").toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {proposal.items.length} items
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" data-testid={`button-proposal-actions-${proposal.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/proposals/${proposal.id}`); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeleteProposalId(proposal.id); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteContactId !== null} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContactId && deleteContactMutation.mutate(deleteContactId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteProposalId !== null} onOpenChange={() => setDeleteProposalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this proposal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProposalId && deleteProposalMutation.mutate(deleteProposalId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
