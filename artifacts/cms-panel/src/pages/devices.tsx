import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetMe, useListAllDevices, useListResellerDevices, useActivateDevice, useSuspendDevice, useUnsuspendDevice, useRenewDevice, useDeleteDevice, useGetDevicePlaylist, useAssignDevicePlaylist, useUpdateDevicePlaylist, useRemoveDevicePlaylist, getListAllDevicesQueryKey, getListResellerDevicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Plus, Search, MoreHorizontal, CheckCircle2, XCircle, AlertCircle, Trash2, Power, RefreshCw, ListVideo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Devices() {
  const { data: user } = useGetMe();
  const isSuperAdmin = user?.role === "superadmin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<any>(undefined);

  const queryParams = { search, page, limit: 10, status: statusFilter };
  
  const { data: allDevices, isLoading: loadingAll } = useListAllDevices(queryParams, { query: { enabled: isSuperAdmin } });
  const { data: resellerDevices, isLoading: loadingReseller } = useListResellerDevices(queryParams, { query: { enabled: !isSuperAdmin && !!user } });

  const loading = isSuperAdmin ? loadingAll : loadingReseller;
  const devices = isSuperAdmin ? allDevices?.devices : resellerDevices?.devices;

  const { mutate: suspend } = useSuspendDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: isSuperAdmin ? getListAllDevicesQueryKey() : getListResellerDevicesQueryKey() });
        toast({ title: "Device suspended" });
      }
    }
  });

  const { mutate: unsuspend } = useUnsuspendDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: isSuperAdmin ? getListAllDevicesQueryKey() : getListResellerDevicesQueryKey() });
        toast({ title: "Device unsuspended" });
      }
    }
  });

  const copyMac = (mac: string) => {
    navigator.clipboard.writeText(mac);
    toast({ title: "Copied MAC address" });
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</Badge>;
      case "suspended": return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1"/> Suspended</Badge>;
      case "expired": return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1"/> Expired</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
            <p className="text-muted-foreground">Manage activated devices and playlists</p>
          </div>
          {!isSuperAdmin && (
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Activate Device
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search MAC or name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    {isSuperAdmin && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : devices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center h-32 text-muted-foreground">
                    No devices found.
                  </TableCell>
                </TableRow>
              ) : (
                devices?.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{device.mac_address}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => copyMac(device.mac_address)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    {isSuperAdmin && <TableCell>{device.reseller_name || "-"}</TableCell>}
                    <TableCell className="font-medium">{device.name || <span className="text-muted-foreground italic">Unnamed</span>}</TableCell>
                    <TableCell>{renderStatus(device.status)}</TableCell>
                    <TableCell className="capitalize">{device.license_tier}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {device.expires_at ? new Date(device.expires_at).toLocaleDateString() : 'Never'}
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
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => copyMac(device.mac_address)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy MAC
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <ListVideo className="mr-2 h-4 w-4" /> Manage Playlist
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCw className="mr-2 h-4 w-4" /> Renew License
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {device.status === 'suspended' ? (
                            <DropdownMenuItem onClick={() => unsuspend({ id: device.id })}>
                              <Power className="mr-2 h-4 w-4 text-emerald-500" /> Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => suspend({ id: device.id })}>
                              <AlertCircle className="mr-2 h-4 w-4 text-amber-500" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
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
      </div>
    </AppLayout>
  );
}
