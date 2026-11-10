import type { LucideIcon } from "lucide-react";
import { Flame, Radio, ShieldAlert, Zap } from "lucide-react";

export type ServiceType =
  | "electrical"
  | "emergency_exit_light"
  | "fire_testing"
  | "rcd_reporting"
  | "microwave_leakage";

export interface TestingService {
  id: ServiceType;
  title: string;
  /** Short name used on draft reports. */
  shortLabel: string;
  description: string;
  /** Compliance standard shown as a tag. */
  standard: string;
  features: string[];
  /** Label of the select button on the original service selection page. */
  selectLabel: string;
  icon: LucideIcon;
}

/** The testing services a technician can start, in display order. */
export const TESTING_SERVICES: TestingService[] = [
  {
    id: "electrical",
    title: "Electrical Test and Tag",
    shortLabel: "Electrical Test & Tag",
    description: "Portable appliance testing for electrical equipment compliance with AS/NZS 3760",
    standard: "AS/NZS 3760",
    features: [
      "Visual inspection testing",
      "Earth continuity testing",
      "Insulation resistance testing",
      "Polarity testing",
      "Appliance leakage testing",
      "Compliance tagging and reporting",
    ],
    selectLabel: "Select Electrical Testing",
    icon: Zap,
  },
  {
    id: "emergency_exit_light",
    title: "Emergency Exit Light Testing",
    shortLabel: "Emergency Exit Light",
    description: "Emergency lighting and exit sign testing compliant with AS 2293.2:2019",
    standard: "AS 2293.2:2019",
    features: [
      "90-minute discharge testing",
      "Physical inspection",
      "Battery condition assessment",
      "Switching mechanism testing",
      "Compliance certification",
    ],
    selectLabel: "Select Emergency Testing",
    icon: ShieldAlert,
  },
  {
    id: "fire_testing",
    title: "Fire Equipment Testing",
    shortLabel: "Fire Equipment",
    description: "Fire safety equipment testing compliant with AS 1851 (AU) / NZS 4503:2005 (NZ)",
    standard: "AS 1851 / NZS 4503",
    features: [
      "Fire extinguisher testing",
      "Fire blanket inspection",
      "Fire hose reel testing",
      "Fire hydrant testing",
      "6-monthly and 12-monthly tests",
      "Compliance documentation",
    ],
    selectLabel: "Select Fire Testing",
    icon: Flame,
  },
  {
    id: "rcd_reporting",
    title: "RCD Reporting",
    shortLabel: "RCD Reporting",
    description: "Residual Current Device testing for electrical safety compliance with AS/NZS 3760",
    standard: "AS/NZS 3760",
    features: [
      "Fixed RCD testing",
      "Portable RCD testing",
      "Push button test (6 monthly)",
      "Injection/Timed test (12 monthly)",
      "Distribution board tracking",
      "Compliance certification",
    ],
    selectLabel: "Select RCD Reporting",
    icon: Zap,
  },
  {
    id: "microwave_leakage",
    title: "Microwave Leakage Testing",
    shortLabel: "Microwave Leakage",
    description: "Microwave oven radiation leakage testing for workplace safety compliance",
    standard: "AS/NZS 60335.2.25",
    features: [
      "Radiation leakage measurement",
      "Door seal inspection",
      "Safety interlock testing",
      "Visual condition assessment",
      "AS/NZS 60335.2.25 compliance",
      "Compliance certification",
    ],
    selectLabel: "Select Microwave Testing",
    icon: Radio,
  },
];

/** Short display name for a stored service type. */
export function getServiceShortLabel(serviceType: string): string {
  return TESTING_SERVICES.find((service) => service.id === serviceType)?.shortLabel || serviceType;
}

/** "3 days ago", "1 hour ago", "Just now". */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}
