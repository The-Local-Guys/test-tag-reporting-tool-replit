import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showUserInfo?: boolean;
  children?: React.ReactNode;
}

export function AppHeader({ title, subtitle, showUserInfo = true, children }: AppHeaderProps) {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 mb-6 relative z-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <div className="text-blue-100 text-sm mt-1">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3">
          {children}
          {showUserInfo && user && (
            <div className="flex items-center space-x-2 text-sm text-blue-100">
              <User className="w-4 h-4" />
              <span>{(user as any)?.fullName || 'User'}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </div>
  );
}