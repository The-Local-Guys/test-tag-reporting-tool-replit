import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Headset, Loader2, ShieldCheck, UserPlus, WandSparkles, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { UserRole } from "../utils";

const EMPTY_NEW_USER = {
  username: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  role: "technician" as UserRole,
};

const MIN_PASSWORD_LENGTH = 6;

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: LucideIcon }[] = [
  {
    value: "technician",
    label: "Technician",
    description: "Can view and edit their own reports only",
    icon: Wrench,
  },
  {
    value: "support_center",
    label: "Support Center Staff",
    description: "Can view/edit all reports and manage technician users",
    icon: Headset,
  },
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Highest level access - full system control (Jarrad151 only)",
    icon: ShieldCheck,
  },
];

const STRENGTH_LEVELS = [
  { label: "Too short", bar: "bg-red-500", text: "text-red-600" },
  { label: "Weak", bar: "bg-orange-500", text: "text-orange-600" },
  { label: "Fair", bar: "bg-yellow-500", text: "text-yellow-600" },
  { label: "Good", bar: "bg-lime-500", text: "text-lime-600" },
  { label: "Strong", bar: "bg-green-600", text: "text-green-700" },
];

/** Scores a password 0-4: 0 when below the minimum length, then one point per character class mix and length. */
function scorePassword(password: string): number {
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  let score = 1;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

/** Random 12-character password without look-alike characters (0/O, 1/l/I). */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  visible,
  onToggleVisible,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  invalid?: boolean;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        aria-invalid={invalid}
        className={cn("pr-10", invalid && "border-red-500 focus-visible:ring-red-500")}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

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
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const resetForm = () => {
    setNewUserData(EMPTY_NEW_USER);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitAttempted(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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
    onSuccess: (_data, userData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      handleClose();
      toast({
        title: "User created successfully",
        description: `${userData.fullName} can now sign in as "${userData.username}".`,
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

  const errors: Partial<Record<keyof typeof newUserData, string>> = {};
  if (!newUserData.fullName.trim()) errors.fullName = "Full name is required";
  if (!newUserData.username.trim()) errors.username = "Username is required";
  else if (/\s/.test(newUserData.username)) errors.username = "Username cannot contain spaces";
  if (!newUserData.password) errors.password = "Password is required";
  else if (newUserData.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (newUserData.confirmPassword && newUserData.confirmPassword !== newUserData.password)
    errors.confirmPassword = "Passwords do not match";
  else if (!newUserData.confirmPassword) errors.confirmPassword = "Please confirm the password";

  // Required-field errors only appear after the first submit; a mismatch shows as soon as it's typed.
  const visibleError = (field: keyof typeof newUserData) =>
    submitAttempted || (field === "confirmPassword" && newUserData.confirmPassword) ? errors[field] : undefined;

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (Object.keys(errors).length > 0) return;
    createUser.mutate({
      ...newUserData,
      fullName: newUserData.fullName.trim(),
      username: newUserData.username.trim(),
    });
  };

  const setField = (field: keyof typeof newUserData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNewUserData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleGeneratePassword = () => {
    const password = generatePassword();
    setNewUserData((prev) => ({ ...prev, password, confirmPassword: password }));
    setShowPassword(true);
  };

  const strength = newUserData.password ? scorePassword(newUserData.password) : null;
  const passwordsMatch =
    newUserData.confirmPassword.length > 0 && newUserData.confirmPassword === newUserData.password;
  const roleOptions = ROLE_OPTIONS.filter(
    (option) => option.value !== "super_admin" || currentUserRole === "super_admin",
  );
  const initials = getInitials(newUserData.fullName);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New User Account" className="max-w-lg">
      <form onSubmit={handleCreateUser} noValidate className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {initials || <UserPlus className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {newUserData.fullName.trim() || "New user"}
            </p>
            <p className="truncate text-xs text-gray-500">
              {newUserData.username.trim() ? `@${newUserData.username.trim()}` : "Fill in the details below"}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profile</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                value={newUserData.fullName}
                onChange={setField("fullName")}
                placeholder="e.g. Jane Smith"
                autoComplete="off"
                autoFocus
                aria-invalid={!!visibleError("fullName")}
                className={cn(visibleError("fullName") && "border-red-500 focus-visible:ring-red-500")}
              />
              <FieldError message={visibleError("fullName")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={newUserData.username}
                onChange={setField("username")}
                placeholder="e.g. jsmith"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!visibleError("username")}
                className={cn(visibleError("username") && "border-red-500 focus-visible:ring-red-500")}
              />
              <FieldError message={visibleError("username")} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Password</h4>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Generate
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password <span className="text-red-500">*</span>
            </Label>
            <PasswordInput
              id="password"
              value={newUserData.password}
              onChange={setField("password")}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              invalid={!!visibleError("password")}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((v) => !v)}
            />
            {strength !== null && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        step <= Math.max(strength, 1) ? STRENGTH_LEVELS[strength].bar : "bg-gray-200",
                      )}
                    />
                  ))}
                </div>
                <span className={cn("w-16 text-right text-xs font-medium", STRENGTH_LEVELS[strength].text)}>
                  {STRENGTH_LEVELS[strength].label}
                </span>
              </div>
            )}
            <FieldError message={visibleError("password")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">
              Confirm Password <span className="text-red-500">*</span>
            </Label>
            <PasswordInput
              id="confirmPassword"
              value={newUserData.confirmPassword}
              onChange={setField("confirmPassword")}
              placeholder="Re-enter the password"
              invalid={!!visibleError("confirmPassword")}
              visible={showConfirmPassword}
              onToggleVisible={() => setShowConfirmPassword((v) => !v)}
            />
            {passwordsMatch ? (
              <p className="flex items-center gap-1 text-xs font-medium text-green-700">
                <Check className="h-3.5 w-3.5" /> Passwords match
              </p>
            ) : (
              <FieldError message={visibleError("confirmPassword")} />
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Access Level</h4>
          <div role="radiogroup" aria-label="Access level" className="space-y-2">
            {roleOptions.map(({ value, label, description, icon: Icon }) => {
              const selected = newUserData.role === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setNewUserData((prev) => ({ ...prev, role: value }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    selected
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md",
                      selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", selected ? "text-blue-900" : "text-gray-900")}>{label}</p>
                    <p className="text-xs text-gray-600">{description}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={createUser.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createUser.isPending} className="bg-blue-600 hover:bg-blue-700">
            {createUser.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
