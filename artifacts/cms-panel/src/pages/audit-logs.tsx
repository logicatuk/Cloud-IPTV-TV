import { AppLayout } from "@/components/layout/app-layout";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ShieldAlert, Monitor, Users, Server, CreditCard } from "lucide-react";

export default function AuditLogs() {
  const { data, isLoading } = useListAuditLogs({ limit: 50 });

  const getEntityIcon = (entityType: string) => {
    switch (entityType?.toLowerCase()) {
      case 'device': return <Monitor className="h-3 w-3 mr-1" />;
      case 'reseller': return <Users className="h-3 w-3 mr-1" />;
      case 'server': return <Server className="h-3 w-3 mr-1" />;
      case 'credit': return <CreditCard className="h-3 w-3 mr-1" />;
      default: return <Activity className="h-3 w-3 mr-1" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('activate') || action.includes('add')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (action.includes('delete') || action.includes('remove') || action.includes('suspend')) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    return 'bg-secondary/50 text-foreground border-border';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">System-wide activity and security log</p>
        </div>

        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : data?.logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No activity logs found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{log.actor_id || 'System'}</span>
                        <span className="text-xs text-muted-foreground capitalize">{log.actor_role}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`shadow-none font-mono text-xs uppercase ${getActionColor(log.action)}`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="shadow-none font-medium capitalize">
                        {getEntityIcon(log.entity_type || '')}
                        {log.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.entity_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ip_address || '-'}
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
