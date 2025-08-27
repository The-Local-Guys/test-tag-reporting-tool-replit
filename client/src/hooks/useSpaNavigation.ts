import { useLocation } from "wouter";
import { useLoading } from "@/contexts/LoadingContext";

export function useSpaNavigation() {
  const [, setLocation] = useLocation();
  const { startPageLoad } = useLoading();

  const navigate = (path: string, shouldShowLoading: boolean = true) => {
    if (shouldShowLoading) {
      startPageLoad();
      // Use a small delay to ensure loading screen shows
      setTimeout(() => {
        setLocation(path);
      }, 50);
    } else {
      setLocation(path);
    }
  };

  const navigateWithReplace = (path: string) => {
    startPageLoad();
    setTimeout(() => {
      setLocation(path, { replace: true });
    }, 50);
  };

  return { navigate, navigateWithReplace };
}