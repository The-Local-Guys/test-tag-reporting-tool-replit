import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Environment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Edit, Plus, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Item = {
  type: string;
  name: string;
  icon: string;
  description: string;
};

export default function Environments() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<number | null>(null);
  const [newEnvironment, setNewEnvironment] = useState({
    name: "",
    serviceType: "electrical" as "electrical" | "emergency_exit_light" | "fire_testing",
  });
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState({
    type: "",
    name: "",
    description: "",
  });

  // Fetch environments
  const { data: environments, isLoading } = useQuery<Environment[]>({
    queryKey: ["/api/environments"],
  });

  // Create environment mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; serviceType: string }) => {
      return await apiRequest("POST", "/api/environments", { ...data, items: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      setIsCreateDialogOpen(false);
      setNewEnvironment({ name: "", serviceType: "electrical" });
      toast({
        title: "Success",
        description: "Environment created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create environment",
        variant: "destructive",
      });
    },
  });

  // Update environment mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Environment> }) => {
      return await apiRequest("PATCH", `/api/environments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      setEditingEnvironmentId(null);
      setEditItems([]);
      toast({
        title: "Success",
        description: "Environment updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update environment",
        variant: "destructive",
      });
    },
  });

  // Delete environment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/environments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      toast({
        title: "Success",
        description: "Environment deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete environment",
        variant: "destructive",
      });
    },
  });

  const handleCreateEnvironment = () => {
    if (!newEnvironment.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an environment name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newEnvironment);
  };

  const handleEditEnvironment = (env: Environment) => {
    setEditingEnvironmentId(env.id);
    setEditItems(Array.isArray(env.items) ? env.items : []);
  };

  const handleSaveEnvironment = (env: Environment) => {
    updateMutation.mutate({
      id: env.id,
      data: { items: editItems },
    });
  };

  const handleCancelEdit = () => {
    setEditingEnvironmentId(null);
    setEditItems([]);
    setNewItem({ type: "", name: "", description: "" });
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim() || !newItem.type.trim()) {
      toast({
        title: "Error",
        description: "Please fill in item name and type",
        variant: "destructive",
      });
      return;
    }
    
    if (editingEnvironmentId === null) return;
    
    const newItemWithIcon = { ...newItem, icon: "📦" };
    const updatedItems = [...editItems, newItemWithIcon];
    
    // Update local state
    setEditItems(updatedItems);
    setNewItem({ type: "", name: "", description: "" });
    
    // Auto-save to backend
    try {
      await updateMutation.mutateAsync({
        id: editingEnvironmentId,
        data: { items: updatedItems },
      });
    } catch (error) {
      // Rollback on error
      setEditItems(editItems);
    }
  };

  const handleRemoveItem = async (index: number) => {
    if (editingEnvironmentId === null) return;
    
    const updatedItems = editItems.filter((_, i) => i !== index);
    
    // Update local state
    setEditItems(updatedItems);
    
    // Auto-save to backend
    try {
      await updateMutation.mutateAsync({
        id: editingEnvironmentId,
        data: { items: updatedItems },
      });
    } catch (error) {
      // Rollback on error
      setEditItems(editItems);
    }
  };

  const getServiceTypeLabel = (serviceType: string) => {
    switch (serviceType) {
      case "electrical":
        return "Electrical Testing";
      case "emergency_exit_light":
        return "Emergency Exit Light";
      case "fire_testing":
        return "Fire Testing";
      default:
        return serviceType;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading environments...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Environments</h1>
          <p className="text-gray-600 mt-1">Manage your custom item sets for different testing types</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-environment">
              <Plus className="w-4 h-4 mr-2" />
              Create Environment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Environment</DialogTitle>
              <DialogDescription>
                Create a custom environment with your own set of items for testing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="env-name">Environment Name</Label>
                <Input
                  id="env-name"
                  data-testid="input-environment-name"
                  placeholder="e.g., Office Equipment, Workshop Tools"
                  value={newEnvironment.name}
                  onChange={(e) =>
                    setNewEnvironment({ ...newEnvironment, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-type">Testing Type</Label>
                <Select
                  value={newEnvironment.serviceType}
                  onValueChange={(value: "electrical" | "emergency_exit_light" | "fire_testing") =>
                    setNewEnvironment({ ...newEnvironment, serviceType: value })
                  }
                >
                  <SelectTrigger data-testid="select-service-type">
                    <SelectValue placeholder="Select testing type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electrical">Electrical Testing</SelectItem>
                    <SelectItem value="emergency_exit_light">Emergency Exit Light</SelectItem>
                    <SelectItem value="fire_testing">Fire Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateEnvironment}
                disabled={createMutation.isPending}
                data-testid="button-submit-create"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!environments || environments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">No environments yet</p>
              <p className="text-sm">Create your first environment to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {environments.map((env) => (
            <Card key={env.id} data-testid={`card-environment-${env.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{env.name}</CardTitle>
                    <CardDescription>{getServiceTypeLabel(env.serviceType)}</CardDescription>
                  </div>
                  {editingEnvironmentId !== env.id && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditEnvironment(env)}
                        data-testid={`button-edit-${env.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit Items
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete environment "${env.name}"?`)) {
                            deleteMutation.mutate(env.id);
                          }
                        }}
                        data-testid={`button-delete-${env.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingEnvironmentId === env.id ? (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h4 className="font-semibold mb-3">Add New Item</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`item-name-${env.id}`}>Item Name</Label>
                          <Input
                            id={`item-name-${env.id}`}
                            data-testid="input-item-name"
                            placeholder="e.g., Drill, Lamp"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`item-type-${env.id}`}>Item Type</Label>
                          <Input
                            id={`item-type-${env.id}`}
                            data-testid="input-item-type"
                            placeholder="e.g., drill, lamp"
                            value={newItem.type}
                            onChange={(e) =>
                              setNewItem({ ...newItem, type: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`item-description-${env.id}`}>Description</Label>
                          <Input
                            id={`item-description-${env.id}`}
                            data-testid="input-item-description"
                            placeholder="e.g., Power Tool"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleAddItem}
                        size="sm"
                        className="mt-3"
                        data-testid="button-add-item"
                        disabled={updateMutation.isPending}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {updateMutation.isPending ? "Adding..." : "Add Item"}
                      </Button>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold">Items ({editItems.length})</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          data-testid="button-done-edit"
                        >
                          Done
                        </Button>
                      </div>
                      {editItems.length === 0 ? (
                        <p className="text-gray-500 text-sm">No items added yet</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {editItems.map((item, index) => (
                            <div
                              key={index}
                              data-testid={`item-${index}`}
                              className="flex items-center justify-between border rounded-lg p-3 bg-white"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{item.icon || "📦"}</span>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-gray-500">{item.description}</div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                data-testid={`button-remove-item-${index}`}
                                disabled={updateMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {!env.items || (Array.isArray(env.items) && env.items.length === 0) ? (
                      <p className="text-gray-500 text-sm">No items configured yet. Click "Edit Items" to add items.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {(Array.isArray(env.items) ? env.items : []).map((item: Item, index: number) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50"
                          >
                            <span className="text-xl">{item.icon}</span>
                            <div className="text-sm">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-gray-500 text-xs">{item.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
