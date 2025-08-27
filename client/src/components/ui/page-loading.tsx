import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import { useEffect, useState } from "react";

interface PageLoadingProps {
  isVisible: boolean;
}

export function PageLoading({ isVisible }: PageLoadingProps) {
  const [shouldShow, setShouldShow] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldShow(true);
      setIsAnimating(true);
    } else {
      // Fade out animation
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldShow(false);
      }, 200); // Match the transition duration
      
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldShow) return null;

  return (
    <div 
      className={`absolute inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-200 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center space-y-6">
        {/* Logo */}
        <div>
          <img 
            src={logoPath} 
            alt="The Local Guys" 
            className="h-24 w-auto opacity-90"
          />
        </div>
        
        {/* Loading text */}
        <div>
          <p className="text-xl font-bold text-gray-700">Loading...</p>
        </div>
      </div>
    </div>
  );
}