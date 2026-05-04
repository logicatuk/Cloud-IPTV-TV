import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useListServers, useTestServer, useDeleteServer, getListServersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Plus, Activity, Link as LinkIcon, Users, Settings2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Servers() {
  const { data, isLoading } = useListServers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: testConnection, isPending: testing } = useTestServer({
    mutation: {
      onSuccess: (res) => {
        if (res.online) {
          toast({ title: "Server Online", description: res.message || "Connection successful" });
        } else {
          toast({ title: "Server Offline", description: res.message || "Connection failed", variant: "destructive" });
        }
        queryClient.invalidateQueries({ queryKey: getListServersQueryKey() });
      },
      onError: () => toast({ title: "Test Failed", variant: "destructive" })
    }
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">IPTV Servers</h1>
            <p className="text-muted-foreground">Manage Xtream Codes and M3U playlist sources</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Server
          </Button>
        </div>
        
        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Server Name</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.servers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No servers configured.
                  </TableCell>
                </TableRow>
              ) : (
                data?.servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        {server.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" />
                      {server.host}
                    </TableCell>
                    <TableCell>
                      {server.is_online ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Online</Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1"/> Offline</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{server.max_connections || 'Unlimited'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {server.last_checked_at ? new Date(server.last_checked_at).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-8 text-xs" 
                          onClick={() => testConnection({ id: server.id })}
                          disabled={testing}
                        >
                          <Activity className="h-3 w-3 mr-1" /> Test
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>
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
