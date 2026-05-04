import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetReseller,
  useAddCreditsToReseller,
  useUpdateReseller,
  useSuspendReseller,
  useActivateReseller,
  getListResellersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Mail, Calendar, CreditCard, HardDrive, ShieldCheck, ShieldAlert,
  CheckCircle2, AlertCircle, XCircle, ArrowUpRight, ArrowDownRight, RefreshCcw, Gift, Pencil, PlusCircle
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const creditsSchema = z.object({
  amount: z.coerce.number().min(1, "Minimum 1"),
  notes: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  max_devices: z.coerce.number().min(1),
  notes: z.string().optional(),
});

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    case "suspended": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1" />Suspended</Badge>;
    case "expired": return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ResellerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, refetch } = useGetReseller(id!, { query: { enabled: !!id } });
  const reseller = data?.reseller;

  const invalidateAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: getListResellersQueryKey() });
  };

  const { mutate: suspend, isPending: suspending } = useSuspendReseller({ mutation: { onSuccess: () => { invalidateAll(); toast({ title: "Suspended" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: activate, isPending: activating } = useActivateReseller({ mutation: { onSuccess: () => { invalidateAll(); toast({ title: "Activated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!reseller) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Reseller not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/resellers")}>Back to Resellers</Button>
        </div>
      </AppLayout>
    );
  }

  const txTypeColor = (type: string) => {
    switch (type) {
      case "purchase": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "debit": return "bg-destructive/10 text-destructive border-destructive/20";
      case "refund": return "bg-primary/10 text-primary border-primary/20";
      case "gift": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-secondary/50 text-foreground border-border";
    }
  };

  const txIcon = (type: string) => {
    switch (type) {
      case "purchase": return <ArrowUpRight className="h-3 w-3" />;
      case "debit": return <ArrowDownRight className="h-3 w-3" />;
      case "refund": return <RefreshCcw className="h-3 w-3" />;
      case "gift": return <Gift className="h-3 w-3" />;
      default: return <CreditCard className="h-3 w-3" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/resellers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{reseller.name}</h1>
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <Mail className="h-3 w-3" /> {reseller.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reseller.status === "active" ? (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><ShieldCheck className="w-3 h-3 mr-1" />Active</Badge>
            ) : (
              <Badge className="bg-destructive/10 text-destructive border-destructive/20"><ShieldAlert className="w-3 h-3 mr-1" />Suspended</Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreditsOpen(true)}>
              <PlusCircle className="mr-1 h-3 w-3" /> Add Credits
            </Button>
            {reseller.status === "active" ? (
              <Button variant="outline" size="sm" className="text-amber-500 hover:text-amber-500 border-amber-500/30 hover:border-amber-500/50" onClick={() => suspend({ id: reseller.id })} disabled={suspending}>
                Suspend
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-emerald-500 hover:text-emerald-500 border-emerald-500/30 hover:border-emerald-500/50" onClick={() => activate({ id: reseller.id })} disabled={activating}>
                Activate
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-primary/30">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CreditCard className="h-4 w-4" />Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{reseller.credit_balance}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><HardDrive className="h-4 w-4" />Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data?.devices?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground">Max: {reseller.max_devices}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-500">{data?.devices?.filter(d => d.status === "active").length ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-4 w-4" />Joined</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">{new Date(reseller.created_at).toLocaleDateString()}</div>
              {reseller.last_login_at && <p className="text-xs text-muted-foreground">Last login: {new Date(reseller.last_login_at).toLocaleDateString()}</p>}
            </CardContent>
          </Card>
        </div>

        {reseller.notes && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground"><strong>Notes:</strong> {reseller.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Devices ({data?.devices?.length ?? 0})</CardTitle>
            <CardDescription>All devices activated under this reseller</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.devices?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No devices activated.</TableCell>
                  </TableRow>
                ) : (
                  data.devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.mac_address}</TableCell>
                      <TableCell>{d.name || <span className="text-muted-foreground italic text-sm">Unnamed</span>}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell><Badge variant="outline" className="capitalize font-mono text-xs">{d.license_tier}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.activated_at ? new Date(d.activated_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.expires_at ? new Date(d.expires_at).toLocaleDateString() : "Never"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credit Transactions</CardTitle>
            <CardDescription>Full credit history for this reseller</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.credit_transactions?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No transactions.</TableCell>
                  </TableRow>
                ) : (
                  data.credit_transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge className={`capitalize shadow-none text-xs ${txTypeColor(tx.type)}`}>
                          {txIcon(tx.type)}
                          <span className="ml-1">{tx.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-mono font-medium ${tx.type === "debit" ? "text-destructive" : "text-emerald-500"}`}>
                        {tx.type === "debit" ? "" : "+"}{tx.amount}
                      </TableCell>
                      <TableCell className="font-mono">{tx.balance_after}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tx.reference || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{tx.notes || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={creditsOpen} onOpenChange={(o) => !o && setCreditsOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
            <DialogDescription>Current balance: <strong>{reseller.credit_balance}</strong></DialogDescription>
          </DialogHeader>
          <AddCreditsForm resellerId={reseller.id} onSuccess={() => { setCreditsOpen(false); invalidateAll(); }} onClose={() => setCreditsOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reseller</DialogTitle>
          </DialogHeader>
          <EditResellerForm reseller={reseller} onSuccess={() => { setEditOpen(false); invalidateAll(); }} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function AddCreditsForm({ resellerId, onSuccess, onClose }: { resellerId: string; onSuccess: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const { mutate: addCredits, isPending } = useAddCreditsToReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Credits added!" }); onSuccess(); form.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof creditsSchema>>({ resolver: zodResolver(creditsSchema), defaultValues: { amount: 10, notes: "" } });
  return (
    <form onSubmit={form.handleSubmit((v) => addCredits({ id: resellerId, data: v as any }))} className="space-y-4">
      <div className="space-y-1">
        <Label>Amount *</Label>
        <Input {...form.register("amount")} type="number" min={1} />
        {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Input {...form.register("notes")} placeholder="Reason..." />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add Credits"}</Button>
      </DialogFooter>
    </form>
  );
}

function EditResellerForm({ reseller, onSuccess, onClose }: { reseller: any; onSuccess: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const { mutate: update, isPending } = useUpdateReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Updated!" }); onSuccess(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: reseller.name, email: reseller.email, max_devices: reseller.max_devices, notes: reseller.notes || "" },
  });
  return (
    <form onSubmit={form.handleSubmit((v) => update({ id: reseller.id, data: v as any }))} className="space-y-4">
      <div className="space-y-1">
        <Label>Full Name</Label>
        <Input {...form.register("name")} />
        {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input {...form.register("email")} type="email" />
        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Max Devices</Label>
        <Input {...form.register("max_devices")} type="number" min={1} />
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea {...form.register("notes")} rows={2} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Changes"}</Button>
      </DialogFooter>
    </form>
  );
}
