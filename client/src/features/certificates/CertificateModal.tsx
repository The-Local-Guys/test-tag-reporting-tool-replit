import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function CertificateModal({ isOpen, onClose, onSubmit }: CertificateModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    clientName: "",
    address: "",
    certificationDate: new Date().toISOString().split('T')[0],
    technicianName: (user as any)?.fullName || "",
    technicianLicense: "",
  });

  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({
    electrical: false,
    emergency_exit_light: false,
    fire_testing: false,
    rcd_reporting: false,
    microwave_leakage: false,
  });

  // Fetch all test sessions to get unique clients
  const { data: sessions } = useQuery({
    queryKey: ["/api/admin/sessions"],
  });

  // Extract unique clients from sessions (filter out empty names)
  const uniqueClients = Array.from(
    new Map(
      (sessions as any[] || [])
        .filter((s: any) => s.clientName && s.clientName.trim())
        .map((s: any) => [
          s.clientName,
          { name: s.clientName, address: s.address }
        ])
    ).values()
  );

  const handleClientSelect = (clientName: string) => {
    const client = uniqueClients.find((c: any) => c.name === clientName);
    if (client) {
      setFormData({
        ...formData,
        clientName: client.name,
        address: client.address,
      });
    }
  };

  const handleServiceToggle = (service: string) => {
    setSelectedServices({
      ...selectedServices,
      [service]: !selectedServices[service],
    });
  };

  const calculateValidityDate = (serviceType: string, baseDate: string): string => {
    const date = new Date(baseDate);
    // All services have 12 months (1 year) validity period from certification date
    const validityMonths: Record<string, number> = {
      electrical: 12,
      emergency_exit_light: 12,
      fire_testing: 12,
      rcd_reporting: 12,
      microwave_leakage: 12,
    };

    date.setMonth(date.getMonth() + (validityMonths[serviceType] || 12));
    return date.toISOString().split('T')[0];
  };

  const handleSubmit = () => {
    // Build services array and validity dates object
    const services = Object.keys(selectedServices).filter(
      (key) => selectedServices[key]
    );

    const validityDates: Record<string, string> = {};
    services.forEach((service) => {
      validityDates[service] = calculateValidityDate(service, formData.certificationDate);
    });

    const certificateData = {
      ...formData,
      services,
      validityDates,
    };

    onSubmit(certificateData);
    // Don't close modal here - parent component will close it after mutation succeeds
  };

  const isValid = 
    formData.clientName &&
    formData.address &&
    Object.values(selectedServices).some(v => v);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Certificate of Compliance"
    >
      <div className="space-y-4">
        {/* Client Selection */}
        <div>
          <Label htmlFor="client-select">Select Client</Label>
          <Select onValueChange={handleClientSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose from existing clients..." />
            </SelectTrigger>
            <SelectContent>
              {uniqueClients.map((client: any) => (
                <SelectItem key={client.name} value={client.name}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manual Client Entry */}
        <div>
          <Label htmlFor="clientName">Client Name</Label>
          <Input
            id="clientName"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            placeholder="Enter client name"
          />
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter address"
          />
        </div>

        {/* Services Selection */}
        <div>
          <Label>Services Completed</Label>
          <div className="space-y-2 mt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="electrical"
                checked={selectedServices.electrical}
                onCheckedChange={() => handleServiceToggle('electrical')}
              />
              <label htmlFor="electrical" className="text-sm">
                Electrical Appliance Test & Tag
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emergency"
                checked={selectedServices.emergency_exit_light}
                onCheckedChange={() => handleServiceToggle('emergency_exit_light')}
              />
              <label htmlFor="emergency" className="text-sm">
                Emergency Exit Light Testing
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fire"
                checked={selectedServices.fire_testing}
                onCheckedChange={() => handleServiceToggle('fire_testing')}
              />
              <label htmlFor="fire" className="text-sm">
                Fire Equipment Maintenance
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rcd"
                checked={selectedServices.rcd_reporting}
                onCheckedChange={() => handleServiceToggle('rcd_reporting')}
              />
              <label htmlFor="rcd" className="text-sm">
                RCD Testing
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="microwave"
                checked={selectedServices.microwave_leakage}
                onCheckedChange={() => handleServiceToggle('microwave_leakage')}
              />
              <label htmlFor="microwave" className="text-sm">
                Microwave Leakage Testing
              </label>
            </div>
          </div>
        </div>

        {/* Certification Date */}
        <div>
          <Label htmlFor="certificationDate">Certification Date</Label>
          <Input
            id="certificationDate"
            type="date"
            value={formData.certificationDate}
            onChange={(e) => setFormData({ ...formData, certificationDate: e.target.value })}
          />
        </div>

        {/* Technician Info */}
        <div>
          <Label htmlFor="technicianName">Technician Name</Label>
          <Input
            id="technicianName"
            value={formData.technicianName}
            onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
            placeholder="Technician name"
          />
        </div>

        <div>
          <Label htmlFor="technicianLicense">Technician License (Optional)</Label>
          <Input
            id="technicianLicense"
            value={formData.technicianLicense}
            onChange={(e) => setFormData({ ...formData, technicianLicense: e.target.value })}
            placeholder="License number"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Create Certificate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
