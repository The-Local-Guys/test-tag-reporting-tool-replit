import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MAX_SESSION_ADDRESS_LENGTH } from "@shared/schema";

/** Edit a test session's job details. Render it only while a session is being edited. */
export function EditSessionModal({ session, onClose }: { session: any; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editSessionData, setEditSessionData] = useState({
    clientName: session.clientName || '',
    technicianName: session.technicianName || '',
    testDate: session.testDate?.split("T")[0] || session.testDate || '', // Convert to YYYY-MM-DD format
    address: session.address || '',
    siteContact: session.siteContact || '',
    country: (session.country || 'australia') as "australia" | "newzealand" | "national_client",
  });

  // Custom form types offered alongside the built-in countries
  const { data: customFormTypes } = useQuery<any[]>({
    queryKey: ['/api/custom-forms'],
  });

  const editSessionMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: number; data: any }) => {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update session");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      toast({
        title: "Success",
        description: "Session details updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update session",
        variant: "destructive",
      });
    },
  });

  const handleUpdateSession = () => {
    if (
      !editSessionData.clientName ||
      !editSessionData.technicianName ||
      !editSessionData.testDate ||
      !editSessionData.address ||
      !editSessionData.siteContact
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    editSessionMutation.mutate({
      sessionId: session.id,
      data: editSessionData,
    });
  };

  const setField = (field: keyof typeof editSessionData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditSessionData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal isOpen onClose={onClose} title="Edit Test Session">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="editClientName">Client Name</Label>
          <Input
            id="editClientName"
            type="text"
            value={editSessionData.clientName}
            onChange={setField("clientName")}
            placeholder="Enter client name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="editTechnicianName">Technician Name</Label>
          <Input
            id="editTechnicianName"
            type="text"
            value={editSessionData.technicianName}
            onChange={setField("technicianName")}
            placeholder="Enter technician name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="editTestDate">Test Date</Label>
          <Input
            id="editTestDate"
            type="date"
            value={editSessionData.testDate}
            onChange={setField("testDate")}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="editAddress">Address</Label>
          <Input
            id="editAddress"
            type="text"
            value={editSessionData.address}
            onChange={setField("address")}
            placeholder="Enter address"
            maxLength={MAX_SESSION_ADDRESS_LENGTH}
            required
          />
          <p
            className={`text-xs text-right ${(editSessionData.address?.length || 0) >= MAX_SESSION_ADDRESS_LENGTH ? "text-amber-600 font-medium" : "text-gray-500"}`}
          >
            {editSessionData.address?.length || 0}/{MAX_SESSION_ADDRESS_LENGTH}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="editSiteContact">Site Contact</Label>
          <Input
            id="editSiteContact"
            type="text"
            value={editSessionData.siteContact}
            onChange={setField("siteContact")}
            placeholder="Enter site contact"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="editCountry">Country / Form Type</Label>
          <Select
            value={editSessionData.country}
            onValueChange={(value: string) =>
              setEditSessionData((prev) => ({ ...prev, country: value as any }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country or form type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="australia">Australia</SelectItem>
              <SelectItem value="newzealand">New Zealand</SelectItem>
              <SelectItem value="national_client">ARA Compliance</SelectItem>
              {customFormTypes && customFormTypes.map((formType) => (
                <SelectItem key={formType.id} value={`custom_${formType.id}`}>
                  {formType.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={editSessionMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleUpdateSession} disabled={editSessionMutation.isPending}>
            {editSessionMutation.isPending ? "Updating..." : "Update Session"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
