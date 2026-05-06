import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListSubResellers,
  useCreateSubReseller,
  useUpdateSubReseller,
  useDeleteSubReseller,
  useSuspendSubReseller,
  useUnsuspendSubReseller,
  useAddCreditsToSubReseller,
  useListAllSubResellers,
  useSuspendReseller,
  useActivateReseller,
  useDeleteReseller,
} from "@workspace/api-client-react";
import type { CreateSubResellerRequest, UpdateSubResellerRequest, AddCreditsRequest } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Mail, Clock, ShieldAlert, ShieldCheck, CreditCard, HardDrive, MoreHorizontal, Pencil, Trash2, PlusCircle, UsersRound, ExternalLink, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";
import { useLocation } from "wouter";

const createSchema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "At least 6 characters"),
  credit_balance: z.coerce.number().min(0).default(0),
  max_devices: z.coerce.number().min(1).default(100),
  notes: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  email: z.string().email("Invalid email"),
  max_devices: z.coerce.number().min(1),
  notes: z.string().optional(),
});

const creditsSchema = z.object({
  amount: z.coerce.number().min(1, "Minimum 1 credit"),
  notes: z.string().optional(),
});

export default function SubResellers() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getAuthUser();

  const isSuperAdmin = user?.role === "superadmin";
  const isTopLevelReseller = user?.role === "reseller" && !user?.parent_id;

  if (!isSuperAdmin && !isTopLevelReseller) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">This page is not accessible for your account type.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/dashboard")}>Go to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminSubResellers />;
  }

  return <ResellerSubResellers />;
}

// ── Super Admin view ──────────────────────────────────────────────────────────

function SuperAdminSubResellers() {
  const { toast } = useToast();
  const [deleteSub, setDeleteSub] = useState<any>(null);

  const { data, isLoading, refetch } = useListAllSubResellers();
  const invalidate = () => refetch();

  const { mutate: suspend } = useSuspendReseller({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Sub-reseller suspended" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: unsuspend } = useActivateReseller({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Sub-reseller activated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: deleteSR, isPending: deleting } = useDeleteReseller({ mutation: { onSuccess: () => { invalidate(); setDeleteSub(null); toast({ title: "Sub-reseller deleted" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });

  const subs = data?.sub_resellers ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sub-Resellers</h1>
          <p className="text-muted-foreground">All sub-resellers across your entire network</p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2"><Skeleton className="h-6 w-1/2" /></CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="py-16 text-center border rounded-lg bg-card/50 border-dashed">
            <UsersRound className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No sub-resellers yet</p>
            <p className="text-sm text-muted-foreground mt-1">Sub-resellers are created by top-level resellers</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {subs.map((sub) => (
              <Card key={sub.id} className="flex flex-col overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/20 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold truncate">{sub.name}</CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">{sub.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {sub.status === "active" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-none"><ShieldCheck className="w-3 h-3 mr-1" />Active</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 shadow-none"><ShieldAlert className="w-3 h-3 mr-1" />Suspended</Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {sub.status === "active" ? (
                          <DropdownMenuItem onClick={() => suspend({ id: sub.id })}>
                            <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" /> Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => unsuspend({ id: sub.id })}>
                            <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" /> Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteSub(sub)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><CreditCard className="w-3 h-3 mr-1" /> Credits</p>
                      <p className="text-2xl font-bold tracking-tight text-primary">{sub.credit_balance}</p>
                    </div>
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><HardDrive className="w-3 h-3 mr-1" /> Devices</p>
                      <p className="text-2xl font-bold tracking-tight">{sub.device_count} <span className="text-xs text-muted-foreground font-normal">/ {sub.max_devices}</span></p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center"><User className="w-3 h-3 mr-1 shrink-0" /> Parent: <span className="ml-1 font-medium text-foreground truncate">{sub.parent_reseller_name}</span></div>
                    <div className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Joined {new Date(sub.created_at).toLocaleDateString()}</div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 pb-4">
                  <Link href={`/resellers/${sub.parent_id}`} className="w-full">
                    <Button variant="outline" className="w-full text-xs" size="sm">
                      <ExternalLink className="mr-1 h-3 w-3" /> View Parent Reseller
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteSub} onOpenChange={(o) => !o && setDeleteSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-Reseller</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteSub?.name}</strong> ({deleteSub?.email})? All their devices and data will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSub && deleteSR({ id: deleteSub.id })}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ── Reseller view ─────────────────────────────────────────────────────────────

function ResellerSubResellers() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSub, setEditSub] = useState<any>(null);
  const [creditsSub, setCreditsSub] = useState<any>(null);
  const [deleteSub, setDeleteSub] = useState<any>(null);

  const { data, isLoading, refetch } = useListSubResellers();
  const invalidate = () => refetch();

  const { mutate: suspend } = useSuspendSubReseller({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Sub-reseller suspended" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: unsuspend } = useUnsuspendSubReseller({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Sub-reseller activated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: deleteSR, isPending: deleting } = useDeleteSubReseller({ mutation: { onSuccess: () => { invalidate(); setDeleteSub(null); toast({ title: "Sub-reseller deleted" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });

  const subs = data?.sub_resellers ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sub-Resellers</h1>
            <p className="text-muted-foreground">Manage your distribution network and allocate credits</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Sub-Reseller
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2"><Skeleton className="h-6 w-1/2" /></CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                </CardContent>
                <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
              </Card>
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="py-16 text-center border rounded-lg bg-card/50 border-dashed">
            <UsersRound className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No sub-resellers yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first sub-reseller to start building your distribution network</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Sub-Reseller
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {subs.map((sub) => (
              <Card key={sub.id} className="flex flex-col overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/20 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold truncate">{sub.name}</CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">{sub.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {sub.status === "active" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-none"><ShieldCheck className="w-3 h-3 mr-1" />Active</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 shadow-none"><ShieldAlert className="w-3 h-3 mr-1" />Suspended</Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setEditSub(sub)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCreditsSub(sub)}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Credits
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {sub.status === "active" ? (
                          <DropdownMenuItem onClick={() => suspend({ id: sub.id })}>
                            <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" /> Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => unsuspend({ id: sub.id })}>
                            <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" /> Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteSub(sub)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><CreditCard className="w-3 h-3 mr-1" /> Credits</p>
                      <p className="text-2xl font-bold tracking-tight text-primary">{sub.credit_balance}</p>
                    </div>
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><HardDrive className="w-3 h-3 mr-1" /> Devices</p>
                      <p className="text-2xl font-bold tracking-tight">{sub.device_count} <span className="text-xs text-muted-foreground font-normal">/ {sub.max_devices}</span></p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" /> Joined {new Date(sub.created_at).toLocaleDateString()}
                  </div>
                </CardContent>

                <CardFooter className="pt-0 pb-4">
                  <Button variant="outline" className="w-full text-xs" size="sm" onClick={() => setCreditsSub(sub)}>
                    <PlusCircle className="mr-1 h-3 w-3" /> Add Credits
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateSubResellerModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => refetch()} />
      <EditSubResellerModal sub={editSub} onClose={() => setEditSub(null)} onSuccess={() => refetch()} />
      <AddCreditsModal sub={creditsSub} onClose={() => setCreditsSub(null)} onSuccess={() => refetch()} />

      <AlertDialog open={!!deleteSub} onOpenChange={(o) => !o && setDeleteSub(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-Reseller</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteSub?.name}</strong> ({deleteSub?.email})? All their devices and data will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSub && deleteSR({ id: deleteSub.id })}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function CreateSubResellerModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: create, isPending } = useCreateSubReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Sub-reseller created!" }); onClose(); onSuccess(); form.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error || "Unknown error", variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", credit_balance: 0, max_devices: 100, notes: "" },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sub-Reseller</DialogTitle>
          <DialogDescription>Credits will be deducted from your balance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => create({ data: v satisfies CreateSubResellerRequest }))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Full Name *</Label>
              <Input {...form.register("name")} placeholder="Jane Smith" />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Email *</Label>
              <Input {...form.register("email")} type="email" placeholder="jane@example.com" />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Password *</Label>
              <Input {...form.register("password")} type="password" placeholder="Min 6 characters" />
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Starting Credits</Label>
              <Input {...form.register("credit_balance")} type="number" min={0} />
              <p className="text-xs text-muted-foreground">Deducted from your balance</p>
            </div>
            <div className="space-y-1">
              <Label>Max Devices</Label>
              <Input {...form.register("max_devices")} type="number" min={1} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} placeholder="Optional internal notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Sub-Reseller"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSubResellerModal({ sub, onClose, onSuccess }: { sub: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: update, isPending } = useUpdateSubReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Updated!" }); onClose(); onSuccess(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: sub ? { name: sub.name, email: sub.email, max_devices: sub.max_devices, notes: sub.notes || "" } : undefined,
  });
  return (
    <Dialog open={!!sub} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Sub-Reseller</DialogTitle>
          <DialogDescription>Update account details for {sub?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => update({ id: sub.id, data: v satisfies UpdateSubResellerRequest }))} className="space-y-4">
          <div className="space-y-1">
            <Label>Full Name *</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
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
      </DialogContent>
    </Dialog>
  );
}

function AddCreditsModal({ sub, onClose, onSuccess }: { sub: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: addCredits, isPending } = useAddCreditsToSubReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Credits added!" }); onClose(); onSuccess(); form.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof creditsSchema>>({
    resolver: zodResolver(creditsSchema),
    defaultValues: { amount: 10, notes: "" },
  });
  return (
    <Dialog open={!!sub} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Credits</DialogTitle>
          <DialogDescription>Add credits to <strong>{sub?.name}</strong> (their balance: <strong>{sub?.credit_balance}</strong>). Credits are deducted from your own balance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => addCredits({ id: sub.id, data: v satisfies AddCreditsRequest }))} className="space-y-4">
          <div className="space-y-1">
            <Label>Amount *</Label>
            <Input {...form.register("amount")} type="number" min={1} />
            {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input {...form.register("notes")} placeholder="Optional reason..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add Credits"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
