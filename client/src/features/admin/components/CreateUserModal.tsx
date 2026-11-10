import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "../utils";

const EMPTY_NEW_USER = {
  username: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  role: "technician" as UserRole,
};

/** Create a user account. Only super admins can create other super admins. */
export function CreateUserModal({
  isOpen,
  onClose,
  currentUserRole,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: UserRole;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newUserData, setNewUserData] = useState(EMPTY_NEW_USER);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const createUser = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onClose();
      setNewUserData(EMPTY_NEW_USER);
      toast({
        title: "User created successfully",
        description: "The new user account has been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.message || "Failed to create user account",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUserData.username || !newUserData.password || !newUserData.fullName) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (newUserData.password !== newUserData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    createUser.mutate(newUserData);
  };

  const setField = (field: keyof typeof newUserData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNewUserData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New User Account">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            type="text"
            value={newUserData.fullName}
            onChange={setField("fullName")}
            placeholder="Enter full name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={newUserData.username}
            onChange={setField("username")}
            placeholder="Enter username"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={newUserData.password}
              onChange={setField("password")}
              placeholder="Enter password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={newUserData.confirmPassword}
              onChange={setField("confirmPassword")}
              placeholder="Confirm password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Access Level</Label>
          <Select
            value={newUserData.role}
            onValueChange={(value: UserRole) => setNewUserData((prev) => ({ ...prev, role: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select access level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="technician">Technician</SelectItem>
              <SelectItem value="support_center">Support Center Staff</SelectItem>
              {currentUserRole === "super_admin" && (
                <SelectItem value="super_admin">Super Admin</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-600">
            {newUserData.role === "super_admin"
              ? "Highest level access - full system control (Jarrad151 only)"
              : newUserData.role === "support_center"
                ? "Can view/edit all reports, manage technician users"
                : "Can view/edit own reports only"}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={createUser.isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreateUser} disabled={createUser.isPending}>
            {createUser.isPending ? "Creating..." : "Create User"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
