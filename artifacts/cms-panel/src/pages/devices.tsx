import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetMe,
  useListAllDevices,
  useListResellerDevices,
  useSuspendDevice,
  useUnsuspendDevice,
  useRenewDevice,
  useDeleteDevice,
  useGetDevicePlaylist,
  useAssignDevicePlaylist,
  useUpdateDevicePlaylist,
  useRemoveDevicePlaylist,
  useActivateDevice,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Plus, Search, MoreHorizontal, CheckCircle2, XCircle, AlertCircle, Trash2, Power, RefreshCw, ListVideo, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const activateSchema = z.object({
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, "Format: aa:bb:cc:dd:ee:ff"),
  name: z.string().optional(),
  license_tier: z.enum(["1year", "2year", "lifetime"]),
  notes: z.string().optional(),
});
const renewSchema = z.object({ license_tier: z.enum(["1year", "2year", "lifetime"]) });
const m3uSchema = z.object({ m3u_url: z.string().url("Must be a valid URL") });
const xtreamSchema = z.object({
  xtream_host: z.string().url("Must be a valid URL"),
  xtream_username: z.string().min(1, "Required"),
  xtream_password: z.string().min(1, "Required"),
});

const CREDIT_COST = { "1year": 1, "2year": 2, "lifetime": 3 } as const;

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    case "suspended": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1" />Suspended</Badge>;
    case "expired": return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function Devices() {
  const { data: user } = useGetMe();
  const isSuperAdmin = user?.role === "superadmin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activateOpen, setActivateOpen] = useState(false);
  const [renewDevice, setRenewDevice] = useState<any>(null);
  const [playlistDevice, setPlaylistDevice] = useState<any>(null);
  const [deleteDevice, setDeleteDevice] = useState<any>(null);

  const qp = { search, page, limit: 20, status: statusFilter === "all" ? undefined : statusFilter };
  const { data: allDevices, isLoading: loadingAll, refetch: refetchAll } = useListAllDevices(qp as any, { query: { enabled: isSuperAdmin } });
  const { data: resellerDevices, isLoading: loadingReseller, refetch: refetchReseller } = useListResellerDevices(qp as any, { query: { enabled: !isSuperAdmin && !!user } });

  const loading = isSuperAdmin ? loadingAll : loadingReseller;
  const devices = (isSuperAdmin ? allDevices?.devices : resellerDevices?.devices) ?? [];
  const total = (isSuperAdmin ? allDevices?.total : resellerDevices?.total) ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const invalidate = () => isSuperAdmin ? refetchAll() : refetchReseller();

  const { mutate: suspend, isPending: suspending } = useSuspendDevice({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Device suspended" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: unsuspend, isPending: unsuspending } = useUnsuspendDevice({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Device unsuspended" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });
  const { mutate: deleteDeviceMut, isPending: deleting } = useDeleteDevice({ mutation: { onSuccess: () => { invalidate(); setDeleteDevice(null); toast({ title: "Device deleted" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) } });

  const copyMac = (mac: string) => { navigator.clipboard.writeText(mac); toast({ title: "Copied!" }); };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
            <p className="text-muted-foreground">Manage activated devices and playlists</p>
          </div>
          {!isSuperAdmin && (
            <Button onClick={() => setActivateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Activate Device
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search MAC or name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC Address</TableHead>
                {isSuperAdmin && <TableHead>Reseller</TableHead>}
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Playlist</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: isSuperAdmin ? 8 : 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center h-32 text-muted-foreground">No devices found.</TableCell>
                </TableRow>
              ) : (
                devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{device.mac_address}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => copyMac(device.mac_address)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    {isSuperAdmin && <TableCell className="text-sm text-muted-foreground">{(device as any).reseller_name || device.reseller_id?.slice(0, 8) || "—"}</TableCell>}
                    <TableCell className="font-medium">{device.name || <span className="text-muted-foreground italic text-sm">Unnamed</span>}</TableCell>
                    <TableCell><StatusBadge status={device.status} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize font-mono text-xs">{device.license_tier}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {device.expires_at ? new Date(device.expires_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      {device.has_playlist ? (
                        <Badge variant="outline" className="uppercase font-mono text-xs">{device.playlist_type}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => copyMac(device.mac_address)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy MAC
                          </DropdownMenuItem>
                          {!isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setPlaylistDevice(device)}>
                                <ListVideo className="mr-2 h-4 w-4" /> Manage Playlist
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRenewDevice(device)}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Renew License
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          {device.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => unsuspend({ id: device.id })} disabled={unsuspending}>
                              <Power className="mr-2 h-4 w-4 text-emerald-500" /> Unsuspend
                            </DropdownMenuItem>
                          ) : device.status === "active" ? (
                            <DropdownMenuItem onClick={() => suspend({ id: device.id })} disabled={suspending}>
                              <AlertCircle className="mr-2 h-4 w-4 text-amber-500" /> Suspend
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDevice(device)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ActivateDeviceModal open={activateOpen} onClose={() => setActivateOpen(false)} onSuccess={invalidate} />
      <RenewDeviceModal device={renewDevice} onClose={() => setRenewDevice(null)} onSuccess={invalidate} />
      <PlaylistModal device={playlistDevice} onClose={() => setPlaylistDevice(null)} onSuccess={invalidate} />

      <AlertDialog open={!!deleteDevice} onOpenChange={(o) => !o && setDeleteDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-mono font-medium">{deleteDevice?.mac_address}</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDevice && deleteDeviceMut({ id: deleteDevice.id })}
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

function ActivateDeviceModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: activate, isPending } = useActivateDevice({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Device activated!", description: `Credits remaining: ${data.credits_remaining}` });
        onClose();
        onSuccess();
        form.reset();
      },
      onError: (err: any) => toast({ title: "Activation failed", description: err?.data?.error || "Unknown error", variant: "destructive" }),
    },
  });

  const form = useForm<z.infer<typeof activateSchema>>({
    resolver: zodResolver(activateSchema),
    defaultValues: { mac_address: "", name: "", license_tier: "1year", notes: "" },
  });

  const tier = form.watch("license_tier");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate Device</DialogTitle>
          <DialogDescription>Enter the device MAC address and select a license tier.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => activate({ data: v as any }))} className="space-y-4">
          <div className="space-y-2">
            <Label>MAC Address *</Label>
            <Input {...form.register("mac_address")} placeholder="aa:bb:cc:dd:ee:ff" className="font-mono" />
            {form.formState.errors.mac_address && <p className="text-xs text-destructive">{form.formState.errors.mac_address.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Device Name</Label>
            <Input {...form.register("name")} placeholder="Living Room TV" />
          </div>
          <div className="space-y-2">
            <Label>License Tier *</Label>
            <Select value={tier} onValueChange={(v) => form.setValue("license_tier", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1year">1 Year — 1 credit</SelectItem>
                <SelectItem value="2year">2 Years — 2 credits</SelectItem>
                <SelectItem value="lifetime">Lifetime — 3 credits</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Cost: <strong>{CREDIT_COST[tier as keyof typeof CREDIT_COST]} credit(s)</strong></p>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} placeholder="Optional notes..." rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Activating..." : "Activate Device"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenewDeviceModal({ device, onClose, onSuccess }: { device: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const { mutate: renew, isPending } = useRenewDevice({
    mutation: {
      onSuccess: () => { toast({ title: "Device renewed!" }); onClose(); onSuccess(); },
      onError: (err: any) => toast({ title: "Renewal failed", description: err?.data?.error || "Unknown error", variant: "destructive" }),
    },
  });
  const form = useForm<z.infer<typeof renewSchema>>({ resolver: zodResolver(renewSchema), defaultValues: { license_tier: "1year" } });
  const tier = form.watch("license_tier");

  return (
    <Dialog open={!!device} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Renew License</DialogTitle>
          <DialogDescription>Renew for <span className="font-mono font-medium">{device?.mac_address}</span></DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => renew({ id: device.id, data: v }))} className="space-y-4">
          <div className="space-y-2">
            <Label>License Tier</Label>
            <Select value={tier} onValueChange={(v) => form.setValue("license_tier", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1year">1 Year — 1 credit</SelectItem>
                <SelectItem value="2year">2 Years — 2 credits</SelectItem>
                <SelectItem value="lifetime">Lifetime — 3 credits</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Extends from current expiry. Cost: <strong>{CREDIT_COST[tier as keyof typeof CREDIT_COST]} credit(s)</strong></p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Renewing..." : "Renew"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlaylistModal({ device, onClose, onSuccess }: { device: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [plType, setPlType] = useState<"m3u" | "xtream">("m3u");

  const { data: existing, isLoading: loadingPl, refetch } = useGetDevicePlaylist(device?.id ?? "", {
    query: { enabled: !!device, retry: false },
  });

  const { mutate: assign, isPending: assigning } = useAssignDevicePlaylist({
    mutation: { onSuccess: () => { toast({ title: "Playlist assigned!" }); onSuccess(); refetch(); }, onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }) },
  });
  const { mutate: update, isPending: updating } = useUpdateDevicePlaylist({
    mutation: { onSuccess: () => { toast({ title: "Playlist updated!" }); onSuccess(); refetch(); }, onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }) },
  });
  const { mutate: remove, isPending: removing } = useRemoveDevicePlaylist({
    mutation: { onSuccess: () => { toast({ title: "Playlist removed!" }); onSuccess(); refetch(); }, onError: () => toast({ title: "Failed", variant: "destructive" }) },
  });

  const m3uForm = useForm<z.infer<typeof m3uSchema>>({ resolver: zodResolver(m3uSchema), defaultValues: { m3u_url: "" } });
  const xtreamForm = useForm<z.infer<typeof xtreamSchema>>({
    resolver: zodResolver(xtreamSchema),
    defaultValues: { xtream_host: "", xtream_username: "", xtream_password: "" },
  });

  const isNew = !existing;
  const pending = assigning || updating;

  const handleSubmit = (data: any) => {
    const payload = plType === "m3u" ? { type: "m3u" as const, ...data } : { type: "xtream" as const, ...data };
    if (isNew) assign({ id: device.id, data: payload });
    else update({ id: device.id, data: payload });
  };

  return (
    <Dialog open={!!device} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Playlist</DialogTitle>
          <DialogDescription>Device: <span className="font-mono font-medium">{device?.mac_address}</span></DialogDescription>
        </DialogHeader>

        {loadingPl ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (
          <div className="space-y-4">
            {existing && (
              <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm">
                <span className="font-medium text-emerald-600">Current:</span>{" "}
                <Badge variant="outline" className="uppercase font-mono text-xs mr-2">{existing.type}</Badge>
                {existing.type === "m3u" ? existing.m3u_url : existing.xtream_host}
              </div>
            )}

            <Tabs value={plType} onValueChange={(v) => setPlType(v as "m3u" | "xtream")}>
              <TabsList className="w-full">
                <TabsTrigger value="m3u" className="flex-1">M3U URL</TabsTrigger>
                <TabsTrigger value="xtream" className="flex-1">Xtream Codes</TabsTrigger>
              </TabsList>

              <TabsContent value="m3u" className="space-y-3 mt-4">
                <form onSubmit={m3uForm.handleSubmit(handleSubmit)} className="space-y-3">
                  <div className="space-y-1">
                    <Label>M3U URL *</Label>
                    <Input {...m3uForm.register("m3u_url")} placeholder="http://server.com/get.php?username=..." />
                    {m3uForm.formState.errors.m3u_url && <p className="text-xs text-destructive">{m3uForm.formState.errors.m3u_url.message}</p>}
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    {existing && (
                      <Button type="button" variant="destructive" size="sm" onClick={() => remove({ id: device.id })} disabled={removing} className="sm:mr-auto">
                        {removing ? "Removing..." : "Remove Playlist"}
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={pending}>{pending ? "Saving..." : isNew ? "Assign" : "Update"}</Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              <TabsContent value="xtream" className="space-y-3 mt-4">
                <form onSubmit={xtreamForm.handleSubmit(handleSubmit)} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Server Host *</Label>
                    <Input {...xtreamForm.register("xtream_host")} placeholder="http://xtreamserver.com:8080" />
                    {xtreamForm.formState.errors.xtream_host && <p className="text-xs text-destructive">{xtreamForm.formState.errors.xtream_host.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Username *</Label>
                      <Input {...xtreamForm.register("xtream_username")} />
                      {xtreamForm.formState.errors.xtream_username && <p className="text-xs text-destructive">{xtreamForm.formState.errors.xtream_username.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label>Password *</Label>
                      <Input {...xtreamForm.register("xtream_password")} type="password" />
                      {xtreamForm.formState.errors.xtream_password && <p className="text-xs text-destructive">{xtreamForm.formState.errors.xtream_password.message}</p>}
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    {existing && (
                      <Button type="button" variant="destructive" size="sm" onClick={() => remove({ id: device.id })} disabled={removing} className="sm:mr-auto">
                        {removing ? "Removing..." : "Remove Playlist"}
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={pending}>{pending ? "Saving..." : isNew ? "Assign" : "Update"}</Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
