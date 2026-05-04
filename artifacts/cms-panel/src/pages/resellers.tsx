import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useListResellers, useSuspendReseller, useActivateReseller, getListResellersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserX, UserCheck, CreditCard, HardDrive, Mail, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Resellers() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListResellers({ search, limit: 20 });
  const queryClient = useQueryClient();

  const { mutate: suspend } = useSuspendReseller({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListResellersQueryKey() })
    }
  });

  const { mutate: activate } = useActivateReseller({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListResellersQueryKey() })
    }
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resellers</h1>
            <p className="text-muted-foreground">Manage your reseller network and credit allocations</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Reseller
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
            <div className="col-span-full py-12 text-center text-muted-foreground border rounded-lg bg-card/50 border-dashed">
              No resellers found matching your criteria.
            </div>
          ) : (
            data?.resellers.map((reseller) => (
              <Card key={reseller.id} className="flex flex-col overflow-hidden bg-card/50 backdrop-blur border-border/50 transition-colors hover:border-primary/20">
                <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold">{reseller.name}</CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-1 h-3 w-3" /> {reseller.email}
                    </div>
                  </div>
                  {reseller.status === 'active' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-none"><ShieldCheck className="w-3 h-3 mr-1"/> Active</Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 shadow-none"><ShieldAlert className="w-3 h-3 mr-1"/> Suspended</Badge>
                  )}
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><CreditCard className="w-3 h-3 mr-1"/> Credits</p>
                      <p className="text-2xl font-bold tracking-tight text-primary">{reseller.credit_balance}</p>
                    </div>
                    <div className="space-y-1 rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center"><HardDrive className="w-3 h-3 mr-1"/> Devices</p>
                      <p className="text-2xl font-bold tracking-tight">{reseller.device_count} <span className="text-xs text-muted-foreground font-normal">/ {reseller.max_devices}</span></p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" /> Created {new Date(reseller.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
                <CardFooter className="grid grid-cols-3 gap-2 pt-0 pb-4">
                  <Link href={`/resellers/${reseller.id}`} className="col-span-1">
                    <Button variant="secondary" className="w-full text-xs" size="sm">Details</Button>
                  </Link>
                  <Button variant="outline" className="col-span-1 text-xs" size="sm">
                    + Credits
                  </Button>
                  {reseller.status === 'active' ? (
                    <Button variant="ghost" className="col-span-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" size="sm" onClick={() => suspend({ id: reseller.id })}>
                      Suspend
                    </Button>
                  ) : (
                    <Button variant="ghost" className="col-span-1 text-xs text-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10" size="sm" onClick={() => activate({ id: reseller.id })}>
                      Activate
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
