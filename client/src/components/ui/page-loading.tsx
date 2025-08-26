import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

interface PageLoadingProps {
  isVisible: boolean;
}

export function PageLoading({ isVisible }: PageLoadingProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo with fade-in animation */}
        <div className="animate-fade-in">
          <img 
            src={logoPath} 
            alt="The Local Guys" 
            className="h-24 w-auto opacity-90"
          />
        </div>
        
        {/* Loading text */}
        <div className="animate-fade-in-delay">
          <p className="text-xl font-bold text-gray-700">Loading...</p>
        </div>
      </div>
    </div>
  );
}