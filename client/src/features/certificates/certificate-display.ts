/** Shared display helpers for certificate service types, used by the admin Certificates
 * tab and the report page's attach-certificate picker so both render services consistently. */

export function getServiceDisplayName(serviceType: string): string {
  switch (serviceType) {
    case 'electrical':
      return 'Electrical';
    case 'emergency_exit_light':
      return 'Emergency Exit';
    case 'fire_testing':
      return 'Fire Equipment';
    case 'rcd_reporting':
      return 'RCD';
    case 'microwave_leakage':
      return 'Microwave';
    default:
      return serviceType.replace('_', ' ');
  }
}

// Badge colours match the service cards on the service selection page
export function getServiceBadgeClass(serviceType: string): string {
  switch (serviceType) {
    case 'electrical':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    case 'emergency_exit_light':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
    case 'fire_testing':
      return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800';
    case 'rcd_reporting':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
    case 'microwave_leakage':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
}
