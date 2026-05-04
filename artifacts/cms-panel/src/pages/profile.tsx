import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Mail, User, Clock, Lock, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";

const profileSchema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  email: z.string().email("Invalid email"),
});

export default function Profile() {
  const { data: user, refetch } = useGetMe();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (user && !profileForm.formState.isDirty) {
      profileForm.reset({ name: user.name || "", email: user.email || "" });
    }
  }, [user]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const saveProfile = async (values: z.infer<typeof profileSchema>) => {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const res = await fetch("/api/v1/admin/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
      await refetch();
      setProfileMsg("Profile updated!");
      toast.success("Profile updated!");
    } catch (e: any) {
      setProfileMsg("");
      toast.error(e.message || "Update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMsg("");

    if (!currentPassword) { setPasswordError("Current password is required"); return; }
    if (newPassword.length < 6) { setPasswordError("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match"); return; }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/v1/admin/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password changed successfully!");
      toast.success("Password changed successfully!");
    } catch (e: any) {
      setPasswordError(e.message || "Update failed");
      toast.error(e.message || "Update failed");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information and security</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold shrink-0">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || "M"}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="uppercase text-xs font-mono">
                    <Shield className="h-3 w-3 mr-1" />{user?.role}
                  </Badge>
                  <Badge variant={user?.status === "active" ? "default" : "secondary"} className="capitalize text-xs">
                    {user?.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Update your name and email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input {...profileForm.register("name")} className="pl-9" />
                  </div>
                  {profileForm.formState.errors.name && <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input {...profileForm.register("email")} type="email" className="pl-9" />
                  </div>
                  {profileForm.formState.errors.email && <p className="text-xs text-destructive">{profileForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Member Since</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""} readOnly className="pl-9 bg-muted/50" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                {profileMsg && <span className="text-sm text-green-600 font-medium" role="status">{profileMsg}</span>}
                <Button type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="current_password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type={showCurrent ? "text" : "password"}
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new_password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type={showNew ? "text" : "password"}
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm_password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showConfirm ? "text" : "password"}
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {passwordError && <p className="text-sm text-destructive" role="alert">{passwordError}</p>}
              <div className="flex items-center justify-end gap-3 pt-2">
                {passwordMsg && <span className="text-sm text-green-600 font-medium" role="status">{passwordMsg}</span>}
                <Button type="submit" variant="outline" disabled={savingPassword}>{savingPassword ? "Changing..." : "Change Password"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
