import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDate } from "@/lib/dateUtils";
import { apiErrorMessage, apiRequest, queryClient } from "@/lib/queryClient";
import { billingDate, centsToDollars, paymentMethods, type ClientBilling } from "@shared/client-retainers";

type Project = ClientBilling["projects"][number];
type Request = Project["requests"][number];
type Payment = ClientBilling["payments"][number];
type Invoice = ClientBilling["invoices"][number];
type Action =
  | { type: "settings" | "request"; key: string }
  | { type: "receipt" | "cancel"; key: string; request: Request }
  | { type: "apply"; key: string; invoiceId?: number }
  | { type: "void"; key: string; payment: Payment }
  | { type: "reverse"; key: string; application: Project["applications"][number] };

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const billingMoney = (cents: number) => formatter.format(cents / 100);
const requestLabel = (request: Request) => request.kind === "initial" ? "Initial retainer" : "Retainer replenishment";
const requestStatus = (request: Request) => {
  if (request.status === "paid") return "Funded";
  if (request.status === "cancelled") return "Cancelled";
  return request.receivedCents > 0 ? "Partially funded" : "Open";
};
const selectClass = "block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
const eventDate = (date: string) => formatLocalDate(billingDate(new Date(date)));

function invalidateBilling(clientId: number) {
  for (const queryKey of [
    ["/api/clients", clientId, "billing"],
    ["/api/clients", clientId, "invoices"],
    ["/api/invoices"],
    ["/api/client/invoices"],
    ["/api/invoice-balances"],
    ["/api/payments"],
    ["/api/payments/undeposited"],
    ["/api/payments/undeposited-total"],
  ]) queryClient.invalidateQueries({ queryKey });
}

function AmountField({ name, label, defaultCents, maxCents, allowZero = false }: {
  name: string; label: string; defaultCents?: number; maxCents?: number; allowZero?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" inputMode="decimal" step="0.01" min={allowZero ? "0" : "0.01"}
        max={centsToDollars(maxCents ?? 2_147_483_647)}
        defaultValue={defaultCents === undefined ? undefined : centsToDollars(defaultCents)} required />
    </div>
  );
}

function RetainerDialog({ action, clientId, project, invoices, close }: {
  action: Action; clientId: number; project: Project; invoices: Invoice[]; close: () => void;
}) {
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = useState(action.type === "apply" ? action.invoiceId ?? invoices[0]?.id : undefined);
  const selectedInvoice = invoices.find((invoice) => invoice.id === invoiceId);
  const applicationLimit = Math.min(project.heldCents, selectedInvoice?.balanceCents ?? 0);
  const base = `/api/clients/${clientId}/billing/projects/${project.id}`;
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const fields = Object.fromEntries(form);
      switch (action.type) {
        case "settings":
          return apiRequest("PUT", base, fields);
        case "request":
          return apiRequest("POST", `${base}/requests`, {
            ...fields, dueDate: fields.dueDate || null, operationId: action.key,
          });
        case "receipt":
          return apiRequest("POST", `${base}/requests/${action.request.id}/receipts`, { ...fields, operationId: action.key });
        case "apply":
          return apiRequest("POST", `${base}/applications`, { ...fields, invoiceId, operationId: action.key });
        case "cancel":
          return apiRequest("POST", `${base}/requests/${action.request.id}/cancel`);
        case "void":
          return apiRequest("POST", `${base}/receipts/${action.payment.id}/void`);
        case "reverse":
          return apiRequest("POST", `${base}/applications/${action.application.id}/reverse`);
      }
    },
    onSuccess: () => {
      invalidateBilling(clientId);
      toast({ title: "Client billing updated" });
      close();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  };
  const titles = {
    settings: "Retainer settings", request: "Create retainer request", receipt: "Record retainer receipt",
    apply: "Apply retainer", cancel: "Cancel retainer request", void: "Void retainer receipt", reverse: "Reverse retainer application",
  };
  const buttons = {
    settings: "Save settings", request: "Create request", receipt: "Record receipt",
    apply: "Apply retainer", cancel: "Cancel request", void: "Void receipt", reverse: "Reverse application",
  };
  const destructive = ["cancel", "void", "reverse"].includes(action.type);
  const errorMessage = mutation.error && apiErrorMessage(mutation.error);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) close(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[action.type]}</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {action.type === "settings" && (
            <>
              <AmountField name="target" label="Target balance ($)" defaultCents={project.targetCents ?? undefined} />
              <AmountField name="threshold" label="Low-balance threshold ($)" defaultCents={project.thresholdCents ?? 0} allowZero />
            </>
          )}
          {action.type === "request" && (
            <>
              <AmountField name="amount" label="Request amount ($)" defaultCents={project.suggestedCents || undefined} />
              <div className="space-y-1.5">
                <Label htmlFor="retainer-due-date">Due date</Label>
                <Input type="date" id="retainer-due-date" name="dueDate" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="retainer-request-note">Note for the request</Label>
                <Textarea id="retainer-request-note" name="note" maxLength={500} rows={3} />
              </div>
              <p className="text-sm text-muted-foreground">Once saved, you can copy the request details to share with the client.</p>
            </>
          )}
          {action.type === "receipt" && (
            <>
              <AmountField name="amount" label="Amount received ($)"
                defaultCents={action.request.amountCents - action.request.receivedCents}
                maxCents={action.request.amountCents - action.request.receivedCents} />
              <div className="space-y-1.5">
                <Label htmlFor="retainer-payment-date">Date received</Label>
                <Input id="retainer-payment-date" name="paymentDate" type="date"
                  defaultValue={billingDate()} max={billingDate()} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="retainer-method">Payment method</Label>
                <select id="retainer-method" name="paymentMethod" className={selectClass} defaultValue="check">
                  {paymentMethods.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="retainer-reference">Reference</Label>
                <Input id="retainer-reference" name="reference" maxLength={100} />
              </div>
              <p className="text-sm text-muted-foreground">Record money received from the client. The receipt will appear in Undeposited Funds.</p>
            </>
          )}
          {action.type === "apply" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="retainer-invoice">Invoice</Label>
                <select id="retainer-invoice" value={invoiceId ?? ""} onChange={(event) => setInvoiceId(Number(event.target.value))}
                  className={selectClass} required>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {billingMoney(invoice.balanceCents)} due</option>
                  ))}
                </select>
              </div>
              {applicationLimit > 0 && <AmountField key={invoiceId} name="amount" label="Amount to apply ($)"
                defaultCents={applicationLimit} maxCents={applicationLimit} />}
              <p className="text-sm text-muted-foreground">{billingMoney(project.heldCents)} held for this project.</p>
            </>
          )}
          {action.type === "cancel" && <p className="text-sm">Cancel the remaining {billingMoney(action.request.amountCents - action.request.receivedCents)} request. Funds already received stay in the retainer.</p>}
          {action.type === "void" && <p className="text-sm">Void receipt {action.payment.paymentNumber} for {billingMoney(action.payment.amountCents)} and remove those funds from the retainer balance.</p>}
          {action.type === "reverse" && <p className="text-sm">Return {billingMoney(action.application.amountCents)} to the retainer and increase the amount due on {action.application.invoiceNumber}.</p>}
          {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Close</Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"}
              disabled={mutation.isPending || (action.type === "apply" && !applicationLimit)}>
              {mutation.isPending ? "Saving…" : buttons[action.type]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectRetainer({ project, billing, clientId, initialInvoiceId }: {
  project: Project; billing: ClientBilling; clientId: number; initialInvoiceId?: number;
}) {
  const { toast } = useToast();
  const invoices = billing.invoices.filter((invoice) =>
    invoice.projectId === project.id && invoice.status === "sent" && invoice.balanceCents > 0);
  const [action, setAction] = useState<Action | null>(() =>
    project.heldCents > 0 && invoices.some((invoice) => invoice.id === initialInvoiceId)
      ? { type: "apply", invoiceId: initialInvoiceId, key: crypto.randomUUID() }
      : null);
  const open = (next: Omit<Extract<Action, { type: "settings" | "request" }>, "key"> | { type: "apply" }) =>
    setAction({ ...next, key: crypto.randomUUID() });
  const current = project.requests.find((request) => request.status === "open");
  const hasFunding = project.requests.some((request) => request.receivedCents > 0);

  const copyRequest = async (request: Request) => {
    const details = [
      `${requestLabel(request)} for ${project.name} (request #${request.id})`,
      `Amount requested ${billingMoney(request.amountCents - request.receivedCents)}`,
      request.dueDate ? `Due ${formatLocalDate(request.dueDate)}` : "",
      request.note,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(details);
      toast({ title: "Request details copied" });
    } catch {
      toast({ title: "Unable to copy request details", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong>{billingMoney(project.heldCents)} held</strong>
        {project.targetCents !== null && <span className="text-muted-foreground">
          · Target {billingMoney(project.targetCents)} · Low at {billingMoney(project.thresholdCents ?? 0)}
        </span>}
        {project.lowBalance && <Badge variant="outline">{hasFunding ? "Low balance" : "Initial retainer needed"}</Badge>}
      </div>
      {project.targetCents === null ? (
        <Button onClick={() => open({ type: "settings" })}>Set up retainer</Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => open({ type: "settings" })}>Edit settings</Button>
          {!current && <Button onClick={() => open({ type: "request" })}>{hasFunding ? "Request replenishment" : "Request initial retainer"}</Button>}
          {project.heldCents > 0 && invoices.length > 0 && <Button variant="outline" onClick={() => open({ type: "apply" })}>Apply retainer</Button>}
        </div>
      )}
      {project.lowBalance && !current && project.suggestedCents > 0 && (
        <p className="text-sm text-muted-foreground">Suggested request {billingMoney(project.suggestedCents)} to bring this project back to its target.</p>
      )}
      {current && (
        <div className="space-y-3 rounded-md border p-3" data-testid="open-retainer-request">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{requestLabel(current)} #{current.id}</strong>
            <Badge variant="secondary">{requestStatus(current)}</Badge>
          </div>
          <p className="text-sm">Requested {billingMoney(current.amountCents)} · Received {billingMoney(current.receivedCents)} · Remaining {billingMoney(current.amountCents - current.receivedCents)}</p>
          {current.dueDate && <p className="text-sm text-muted-foreground">Due {formatLocalDate(current.dueDate)}</p>}
          {current.note && <p className="whitespace-pre-wrap break-words text-sm">{current.note}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAction({ type: "receipt", request: current, key: crypto.randomUUID() })}>Record receipt</Button>
            <Button size="sm" variant="outline" onClick={() => copyRequest(current)}>Copy request</Button>
            <Button size="sm" variant="ghost" onClick={() => setAction({ type: "cancel", request: current, key: crypto.randomUUID() })}>Cancel request</Button>
          </div>
        </div>
      )}
      {(project.requests.length > 0 || project.applications.length > 0) && (
        <details className="space-y-3 rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">Retainer history</summary>
          {project.requests.map((request) => (
            <div key={request.id} className="space-y-2 border-t pt-2">
              <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                <span>{requestLabel(request)} #{request.id} · {requestStatus(request)} · {eventDate(request.createdAt)}</span>
                <span className="tabular-nums">{billingMoney(request.receivedCents)} of {billingMoney(request.amountCents)} received</span>
              </div>
              {billing.payments.filter((payment) => payment.retainerRequestId === request.id).map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 pl-3 text-sm text-muted-foreground">
                  <span>{payment.paymentNumber} · {formatLocalDate(payment.paymentDate)} · {billingMoney(payment.amountCents)}
                    {payment.retainerVoidedAt ? " · Voided" : payment.isDeposited ? " · Deposited" : " · Undeposited"}
                  </span>
                  {!payment.isDeposited && !payment.retainerVoidedAt && (
                    <Button size="sm" variant="ghost" onClick={() => setAction({ type: "void", payment, key: crypto.randomUUID() })}>Void receipt</Button>
                  )}
                </div>
              ))}
            </div>
          ))}
          {project.applications.map((application) => (
            <div key={application.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
              <span>
                <Link href={`/invoices/${application.invoiceId}`} className="text-primary underline-offset-4 hover:underline">{application.invoiceNumber}</Link>
                {" · "}{billingMoney(application.amountCents)} applied · {eventDate(application.appliedAt)}
                {application.reversedAt && ` · Reversed ${eventDate(application.reversedAt)}`}
              </span>
              {!application.reversedAt && (
                <Button size="sm" variant="ghost" onClick={() => setAction({ type: "reverse", application, key: crypto.randomUUID() })}>Reverse application</Button>
              )}
            </div>
          ))}
        </details>
      )}
      {action && <RetainerDialog key={action.key} action={action} project={project} clientId={clientId} invoices={invoices} close={() => setAction(null)} />}
    </div>
  );
}

export function ClientRetainers({ billing, clientId, initialProjectId, initialInvoiceId }: {
  billing: ClientBilling; clientId: number; initialProjectId?: number; initialInvoiceId?: number;
}) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const project = billing.projects.find((job) => job.id === projectId)
    ?? billing.projects.find((job) => job.lowBalance)
    ?? billing.projects.find((job) => job.targetCents !== null)
    ?? billing.projects[0];

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3" aria-label="Client billing balances">
        {[
          { label: "Invoices due", amount: billing.invoicesDueCents },
          { label: "Retainer requested", amount: billing.requestedCents },
          { label: "Retainer held", amount: billing.heldCents },
        ].map(({ label, amount }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="text-xl font-semibold tabular-nums">{billingMoney(amount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Project retainers</CardTitle>
          <CardDescription>Requests, receipts and applications for this client’s jobs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {project ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="billing-project">Project</Label>
                <select id="billing-project" className={selectClass} value={project.id} onChange={(event) => setProjectId(Number(event.target.value))}>
                  {billing.projects.map((job) => (
                    <option key={job.id} value={job.id}>{job.name}{job.lowBalance ? " · Funding needed" : ""}</option>
                  ))}
                </select>
              </div>
              <ProjectRetainer key={project.id} project={project} billing={billing} clientId={clientId}
                initialInvoiceId={initialProjectId === project.id ? initialInvoiceId : undefined} />
            </>
          ) : <p className="text-sm text-muted-foreground">Create a project for this client to set up a retainer.</p>}
        </CardContent>
      </Card>
    </>
  );
}

export function ClientCashPayments({ billing }: { billing: ClientBilling }) {
  return (
    <details className="space-y-3 rounded-lg border p-4">
      <summary className="cursor-pointer font-medium">Cash payments ({billing.payments.length})</summary>
      {billing.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded.</p>}
      {billing.payments.map((payment) => (
        <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
          <div>
            {payment.paymentNumber}
            {payment.retainerRequestId && <Badge variant="outline" className="ml-2">Retainer receipt</Badge>}
            {payment.retainerVoidedAt && <Badge variant="secondary" className="ml-2">Voided</Badge>}
            <div className="text-muted-foreground">
              {formatLocalDate(payment.paymentDate)}{payment.paymentMethod && ` · ${payment.paymentMethod.replaceAll("_", " ")}`}
              {payment.reference && ` · Ref ${payment.reference}`}
              {payment.invoiceId && (
                <Link href={`/invoices/${payment.invoiceId}`} className="ml-2 text-primary underline-offset-4 hover:underline">
                  {billing.invoices.find((invoice) => invoice.id === payment.invoiceId)?.invoiceNumber ?? "Invoice"}
                </Link>
              )}
            </div>
          </div>
          <span className="tabular-nums">{billingMoney(payment.amountCents)}</span>
        </div>
      ))}
    </details>
  );
}
