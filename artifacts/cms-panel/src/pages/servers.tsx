import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListServers,
  useCreateServer,
  useUpdateServer,
  useDeleteServer,
  useTestServer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Server, Plus, Activity, Link as LinkIcon, Users, Pencil, Trash2, CheckCircle2, XCircle, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const serverSchema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  host: z.string().url("Must be a valid URL (include http://)"),
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
  max_connections: z.coerce.number().min(1).optional(),
  notes: z.string().optional(),
});

const editServerSchema = serverSchema.extend({
  password: z.string().optional(),
});

export default function Servers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editServer, setEditServer] = useState<any>(null);
  const [deleteServer, setDeleteServer] = useState<any>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useListServers();
  const invalidate = () => refetch();

  const { mutate: testConnection } = useTestServer({
    mutation: {
      onMutate: (vars) => setTestingId(vars.id),
      onSettled: () => setTestingId(null),
      onSuccess: (res, vars) => {
        invalidate();
        toast({
          title: res.online ? "Server Online" : "Server Offline",
          description: res.message || "",
          variant: res.online ? "default" : "destructive",
        });
      },
      onError: () => toast({ title: "Test Failed", variant: "destructive" }),
    },
  });

  const { mutate: deleteServerMut, isPending: deleting } = useDeleteServer({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteServer(null); toast({ title: "Server deleted" }); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">IPTV Servers</h1>
            <p className="text-muted-foreground">Manage Xtream Codes and M3U playlist sources</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Server
          </Button>
        </div>

        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Server Name</TableHead>
                <TableHead>Host URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : data?.servers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No servers configured. Add your first IPTV server.
                  </TableCell>
                </TableRow>
              ) : (
                data?.servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{server.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground max-w-[200px]">
                      <div className="flex items-center gap-1 truncate">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{server.host}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {server.is_online ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Online
                        </Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                          <XCircle className="w-3 h-3 mr-1" /> Offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{server.max_connections || "Unlimited"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {server.last_checked_at ? new Date(server.last_checked_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => testConnection({ id: server.id })}
                          disabled={testingId === server.id}
                        >
                          <Activity className="h-3 w-3 mr-1" />
                          {testingId === server.id ? "Testing..." : "Test"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setEditServer(server)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteServer(server)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ServerFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={invalidate}
      />
      <ServerFormModal
        server={editServer}
        open={!!editServer}
        onClose={() => setEditServer(null)}
        onSuccess={invalidate}
      />

      <AlertDialog open={!!deleteServer} onOpenChange={(o) => !o && setDeleteServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteServer?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteServer && deleteServerMut({ id: deleteServer.id })}
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

function ServerFormModal({ open, server, onClose, onSuccess }: { open: boolean; server?: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const isEdit = !!server;

  const { mutate: create, isPending: creating } = useCreateServer({
    mutation: {
      onSuccess: () => { toast({ title: "Server added!" }); onClose(); onSuccess(); form.reset(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error || "Unknown error", variant: "destructive" }),
    },
  });

  const { mutate: update, isPending: updating } = useUpdateServer({
    mutation: {
      onSuccess: () => { toast({ title: "Server updated!" }); onClose(); onSuccess(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });

  const form = useForm<z.infer<typeof serverSchema>>({
    resolver: zodResolver(isEdit ? editServerSchema : serverSchema),
    values: server ? { name: server.name, host: server.host, username: server.username, password: "", max_connections: server.max_connections, notes: server.notes || "" } : undefined,
    defaultValues: { name: "", host: "", username: "", password: "", max_connections: 1000, notes: "" },
  });

  const isPending = creating || updating;

  const handleSubmit = (v: z.infer<typeof serverSchema>) => {
    if (isEdit) {
      const data: any = { ...v };
      if (!data.password) delete data.password;
      update({ id: server.id, data });
    } else {
      create({ data: v as any });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Server" : "Add IPTV Server"}</DialogTitle>
          <DialogDescription>{isEdit ? `Update details for ${server?.name}` : "Configure a new Xtream Codes IPTV server."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Server Name *</Label>
            <Input {...form.register("name")} placeholder="My IPTV Server" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Host URL *</Label>
            <Input {...form.register("host")} placeholder="http://server.com:8080" />
            {form.formState.errors.host && <p className="text-xs text-destructive">{form.formState.errors.host.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input {...form.register("username")} />
              {form.formState.errors.username && <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password {isEdit && "(leave blank to keep)"}</Label>
              <Input {...form.register("password")} type="password" />
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Max Connections</Label>
            <Input {...form.register("max_connections")} type="number" min={1} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} placeholder="Optional notes..." rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Server"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
