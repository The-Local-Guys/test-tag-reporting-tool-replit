import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { Zap, ShieldAlert, ArrowRight } from "lucide-react";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

export default function ServiceSelection() {
  const [, setLocation] = useLocation();

  const selectService = (serviceType: 'electrical' | 'emergency_exit_light') => {
    // Store the selected service type
    sessionStorage.setItem('selectedService', serviceType);
    // Navigate to setup page
    setLocation('/setup');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader 
        title="Service Selection" 
        subtitle="Choose the type of testing service you want to perform"
        showUserInfo={true}
      />

      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <img 
            src={logoPath} 
            alt="The Local Guys" 
            className="h-24 mx-auto mb-6"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Testing Service
          </h1>
          <p className="text-lg text-gray-600">
            Choose the type of testing you want to perform today
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Electrical Test and Tag */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Electrical Test and Tag</CardTitle>
              <CardDescription className="text-base">
                Portable appliance testing for electrical equipment compliance with AS/NZS 3760
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Visual inspection testing</li>
                <li>• Earth continuity testing</li>
                <li>• Insulation resistance testing</li>
                <li>• Polarity testing</li>
                <li>• Appliance leakage testing</li>
                <li>• Compliance tagging and reporting</li>
              </ul>
              <Button 
                onClick={() => selectService('electrical')}
                className="w-full"
                size="lg"
              >
                Select Electrical Testing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Emergency Exit Light Testing */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-red-500">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl">Emergency Exit Light Testing</CardTitle>
              <CardDescription className="text-base">
                Emergency lighting and exit sign testing compliant with AS 2293.2:2019
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• 90-minute discharge testing</li>
                <li>• Physical inspection</li>
                <li>• Battery condition assessment</li>
                <li>• Lux level measurements</li>
                <li>• Switching mechanism testing</li>
                <li>• Compliance certification</li>
              </ul>
              <Button 
                onClick={() => selectService('emergency_exit_light')}
                className="w-full bg-red-600 hover:bg-red-700"
                size="lg"
              >
                Select Emergency Testing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help choosing? Contact support for guidance on which service is right for your needs.
          </p>
        </div>
      </div>
    </div>
  );
}