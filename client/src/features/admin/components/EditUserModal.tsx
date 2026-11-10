import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "../utils";

/** Edit a user's details and optionally set a new password. Render it only while a user is being edited. */
export function EditUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editUserData, setEditUserData] = useState({
    username: user.username,
    fullName: user.fullName,
    role: user.role as UserRole,
    newPassword: "",
    confirmPassword: "",
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: any }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const handleUpdateUser = () => {
    // Validate required fields
    if (!editUserData.username || !editUserData.fullName) {
      toast({
        title: "Error",
        description: "Username and Full Name are required",
        variant: "destructive",
      });
      return;
    }

    // Validate password if provided
    if (editUserData.newPassword || editUserData.confirmPassword) {
      if (editUserData.newPassword !== editUserData.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }
      if (editUserData.newPassword.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }
    }

    const updateData: any = {
      username: editUserData.username,
      fullName: editUserData.fullName,
      role: editUserData.role,
    };

    // Include password only if provided
    if (editUserData.newPassword) {
      updateData.password = editUserData.newPassword;
    }

    editUserMutation.mutate({
      userId: user.id,
      data: updateData,
    });
  };

  const setField = (field: keyof typeof editUserData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditUserData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal isOpen onClose={onClose} title="Edit User" className="max-w-md">
      {editUserMutation.isPending ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editUsername">Username *</Label>
            <Input
              id="editUsername"
              type="text"
              value={editUserData.username}
              onChange={setField("username")}
              placeholder="Enter username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editFullName">Full Name *</Label>
            <Input
              id="editFullName"
              type="text"
              value={editUserData.fullName}
              onChange={setField("fullName")}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editRole">Role *</Label>
            <Select
              value={editUserData.role}
              onValueChange={(value: UserRole) => setEditUserData((prev) => ({ ...prev, role: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="support_center">Support Center</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editNewPassword">New Password (optional)</Label>
            <Input
              id="editNewPassword"
              type="password"
              value={editUserData.newPassword}
              onChange={setField("newPassword")}
              placeholder="Leave blank to keep current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editConfirmPassword">Confirm New Password</Label>
            <Input
              id="editConfirmPassword"
              type="password"
              value={editUserData.confirmPassword}
              onChange={setField("confirmPassword")}
              placeholder="Confirm new password"
              disabled={!editUserData.newPassword}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={editUserMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={editUserMutation.isPending || !editUserData.username || !editUserData.fullName}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editUserMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
