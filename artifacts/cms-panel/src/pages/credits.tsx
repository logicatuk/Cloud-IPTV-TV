import { AppLayout } from "@/components/layout/app-layout";
import { useGetResellerCredits } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ArrowUpRight, ArrowDownRight, RefreshCcw, Gift } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Credits() {
  const { data, isLoading } = useGetResellerCredits();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
      case 'debit': return <ArrowDownRight className="h-4 w-4 text-destructive" />;
      case 'refund': return <RefreshCcw className="h-4 w-4 text-primary" />;
      case 'gift': return <Gift className="h-4 w-4 text-amber-500" />;
      default: return <CreditCard className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'debit': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'refund': return 'text-primary bg-primary/10 border-primary/20';
      case 'gift': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-muted-foreground bg-muted/50 border-border';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
          <p className="text-muted-foreground">Manage your credit balance and view transaction history</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 border-primary/50 bg-primary/5 shadow-lg shadow-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" /> Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-32" />
              ) : (
                <div className="text-5xl font-bold tracking-tight text-primary">
                  {data?.balance || 0}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                Credits are used to activate devices. Please contact your administrator to purchase more credits.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Activation Costs</CardTitle>
              <CardDescription>Credit cost per device license tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-2">1 Year</div>
                  <div className="text-2xl font-bold">1 <span className="text-sm font-normal text-muted-foreground">CR</span></div>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-2">2 Years</div>
                  <div className="text-2xl font-bold">2 <span className="text-sm font-normal text-muted-foreground">CR</span></div>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-card border-primary/20 bg-primary/5">
                  <div className="text-sm text-primary uppercase tracking-wider font-semibold mb-2">Lifetime</div>
                  <div className="text-2xl font-bold text-primary">3 <span className="text-sm font-normal text-primary/70">CR</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent credit transactions on your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No transaction history.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge className={`capitalize shadow-none ${getTransactionColor(tx.type)}`}>
                          <span className="mr-1">{getTransactionIcon(tx.type)}</span>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-mono font-medium ${tx.type === 'debit' ? 'text-destructive' : 'text-emerald-500'}`}>
                        {tx.type === 'debit' ? '-' : '+'}{tx.amount}
                      </TableCell>
                      <TableCell className="font-mono">{tx.balance_after}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{tx.reference || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
