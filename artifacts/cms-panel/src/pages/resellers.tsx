import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListResellers,
  useCreateReseller,
  useUpdateReseller,
  useDeleteReseller,
  useSuspendReseller,
  useActivateReseller,
  useAddCreditsToReseller,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Search, Plus, Mail, Clock, ShieldAlert, ShieldCheck, CreditCard, HardDrive, MoreHorizontal, Pencil, Trash2, PlusCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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

export default function Resellers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editReseller, setEditReseller] = useState<any>(null);
  const [creditsReseller, setCreditsReseller] = useState<any>(null);
  const [deleteReseller, setDeleteReseller] = useState<any>(null);

  const { data, isLoading, refetch } = useListResellers({ search, limit: 20 });
  const invalidate = () => refetch();

  const { mutate: suspend } = useSuspendReseller({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Reseller suspended" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: activate } = useActivateReseller({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Reseller activated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: deleteRes, isPending: deleting } = useDeleteReseller({ mutation: { onSuccess: () => { invalidate(); setDeleteReseller(null); toast({ title: "Reseller deleted" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resellers</h1>
            <p className="text-muted-foreground">Manage your reseller network and credit allocations</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Reseller
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2"><Skeleton className="h-6 w-1/2" /></CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid grid-cols-2 gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                </CardContent>
                <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
              </Card>
            ))
          ) : data?.resellers?.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground border rounded-lg bg-card/50 border-dashed">
              No resellers found.
            </div>
          ) : (
            data?.resellers.map((reseller) => (
              <Card key={reseller.id} className="flex flex-col overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/20 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold truncate">{reseller.name}</CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">{reseller.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {reseller.status === "active" ? (
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
                        <DropdownMenuItem onClick={() => setEditReseller(reseller)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCreditsReseller(reseller)}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Credits
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {reseller.status === "active" ? (
                          <DropdownMenuItem onClick={() => suspend({ id: reseller.id })}>
                            <ShieldAlert className="mr-2 h-4 w-4 text-amber-500" /> Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => activate({ id: reseller.id })}>
                            <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" /> Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteReseller(reseller)}>
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
                      <p className="text-2xl font-bold tracking-tight text-primary">{reseller.credit_balance}</p>
                    </div>
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><HardDrive className="w-3 h-3 mr-1" /> Devices</p>
                      <p className="text-2xl font-bold tracking-tight">{reseller.device_count} <span className="text-xs text-muted-foreground font-normal">/ {reseller.max_devices}</span></p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" /> Joined {new Date(reseller.created_at).toLocaleDateString()}
                  </div>
                </CardContent>

                <CardFooter className="grid grid-cols-2 gap-2 pt-0 pb-4">
                  <Link href={`/resellers/${reseller.id}`} className="col-span-1">
                    <Button variant="secondary" className="w-full text-xs" size="sm">View Details</Button>
                  </Link>
                  <Button variant="outline" className="col-span-1 text-xs" size="sm" onClick={() => setCreditsReseller(reseller)}>
                    <PlusCircle className="mr-1 h-3 w-3" /> Credits
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>

      <CreateResellerModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={invalidate} />
      <EditResellerModal reseller={editReseller} onClose={() => setEditReseller(null)} onSuccess={invalidate} />
      <AddCreditsModal reseller={creditsReseller} onClose={() => setCreditsReseller(null)} onSuccess={invalidate} />

      <AlertDialog open={!!deleteReseller} onOpenChange={(o) => !o && setDeleteReseller(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reseller</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteReseller?.name}</strong> ({deleteReseller?.email})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteReseller && deleteRes({ id: deleteReseller.id })}
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

function CreateResellerModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: create, isPending } = useCreateReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Reseller created!" }); onClose(); onSuccess(); form.reset(); },
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
          <DialogTitle>Create Reseller</DialogTitle>
          <DialogDescription>Add a new reseller account to the platform.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => create({ data: v as any }))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Full Name *</Label>
              <Input {...form.register("name")} placeholder="John Smith" />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Email *</Label>
              <Input {...form.register("email")} type="email" placeholder="john@example.com" />
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
            <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Reseller"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditResellerModal({ reseller, onClose, onSuccess }: { reseller: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: update, isPending } = useUpdateReseller({
    mutation: {
      onSuccess: () => { toast({ title: "Reseller updated!" }); onClose(); onSuccess(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: reseller ? { name: reseller.name, email: reseller.email, max_devices: reseller.max_devices, notes: reseller.notes || "" } : undefined,
  });
  return (
    <Dialog open={!!reseller} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Reseller</DialogTitle>
          <DialogDescription>Update account details for {reseller?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => update({ id: reseller.id, data: v as any }))} className="space-y-4">
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

function AddCreditsModal({ reseller, onClose, onSuccess }: { reseller: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: addCredits, isPending } = useAddCreditsToReseller({
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
    <Dialog open={!!reseller} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Credits</DialogTitle>
          <DialogDescription>Add credits to <strong>{reseller?.name}</strong> (current balance: <strong>{reseller?.credit_balance}</strong>)</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => addCredits({ id: reseller.id, data: v as any }))} className="space-y-4">
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
