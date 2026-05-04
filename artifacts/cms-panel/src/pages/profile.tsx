import { AppLayout } from "@/components/layout/app-layout";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Mail, User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { data: user } = useGetMe();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Your current MaxPlayer profile information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'M'}
              </div>
              <div>
                <h3 className="text-lg font-medium">{user?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="uppercase text-xs font-mono">
                    <Shield className="h-3 w-3 mr-1" />
                    {user?.role}
                  </Badge>
                  <Badge variant={user?.status === 'active' ? 'default' : 'secondary'} className="capitalize text-xs">
                    {user?.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={user?.name || ''} readOnly className="pl-9 bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={user?.email || ''} readOnly className="pl-9 bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Member Since</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={user?.created_at ? new Date(user?.created_at).toLocaleDateString() : ''} readOnly className="pl-9 bg-muted/50" />
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t flex justify-end">
              <Button disabled>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
