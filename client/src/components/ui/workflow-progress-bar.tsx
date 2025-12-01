import { CheckCircle } from "lucide-react";

export type ServiceType = 'electrical' | 'emergency_exit_light' | 'fire_testing' | 'rcd_reporting' | 'microwave_leakage';

interface WorkflowStep {
  name: string;
  shortName: string;
}

const serviceSteps: Record<ServiceType, WorkflowStep[]> = {
  electrical: [
    { name: "Setup Job Details", shortName: "Setup" },
    { name: "Select Items", shortName: "Items" },
    { name: "Record Results", shortName: "Test" },
    { name: "Generate Report", shortName: "Report" },
  ],
  emergency_exit_light: [
    { name: "Setup Job Details", shortName: "Setup" },
    { name: "Add Assets", shortName: "Assets" },
    { name: "Record Tests", shortName: "Test" },
    { name: "Generate Report", shortName: "Report" },
  ],
  fire_testing: [
    { name: "Setup Job Details", shortName: "Setup" },
    { name: "Select Equipment", shortName: "Items" },
    { name: "Record Results", shortName: "Test" },
    { name: "Generate Report", shortName: "Report" },
  ],
  rcd_reporting: [
    { name: "Setup Job Details", shortName: "Setup" },
    { name: "Select RCD Type", shortName: "Type" },
    { name: "Record Trip Times", shortName: "Test" },
    { name: "Generate Report", shortName: "Report" },
  ],
  microwave_leakage: [
    { name: "Setup Job Details", shortName: "Setup" },
    { name: "Enter Details", shortName: "Details" },
    { name: "Record Readings", shortName: "Test" },
    { name: "Generate Report", shortName: "Report" },
  ],
};

interface WorkflowProgressBarProps {
  currentStep: number;
  serviceType?: ServiceType;
}

export function WorkflowProgressBar({ currentStep, serviceType }: WorkflowProgressBarProps) {
  const service = serviceType || (sessionStorage.getItem('selectedService') as ServiceType) || 'electrical';
  const steps = serviceSteps[service] || serviceSteps.electrical;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isPending = stepNumber > currentStep;

          return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                {isCompleted ? (
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    {stepNumber}
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm">
                    {stepNumber}
                  </div>
                )}
                <span className={`text-xs mt-1 text-center ${isCurrent ? 'text-primary font-medium' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                  {step.shortName}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2">
                  <div className={`h-1 rounded ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-primary/30' : 'bg-gray-200'}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getServiceTitle(serviceType?: ServiceType): string {
  const service = serviceType || (sessionStorage.getItem('selectedService') as ServiceType) || 'electrical';
  
  switch (service) {
    case 'emergency_exit_light':
      return 'Emergency Exit Light Testing';
    case 'fire_testing':
      return 'Fire Equipment Testing';
    case 'rcd_reporting':
      return 'RCD Reporting';
    case 'microwave_leakage':
      return 'Microwave Leakage Testing';
    default:
      return 'Electrical Test & Tag';
  }
}
