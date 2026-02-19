import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Environment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Edit, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

type Item = {
  type: string;
  name: string;
  icon: string;
  description: string;
  classification?: string;
};

const CLASSIFICATION_OPTIONS = [
  { value: 'class1', label: 'Class 1' },
  { value: 'class2', label: 'Class 2' },
  { value: 'epod', label: 'EPOD' },
  { value: 'rcd', label: 'RCD' },
  { value: '3phase', label: '3 Phase' },
];

// Predefined icon library organized by category - focused on electrical testing
const ICON_LIBRARY = {
  "Power & Electrical": [
    "⚡", "🔌", "🔋", "🪫", "⚙️", "💡", "🔦", "🕯️", "💫", "⚠️",
  ],
  "Tools & Equipment": [
    "🔧", "🔨", "🪛", "🪚", "⛏️", "🪓", "⚒️", "🛠️", "🔩", "🧲",
    "⛓️", "🪝", "🧰", "✂️", "📏",
  ],
  "Computing & Office": [
    "💻", "🖥️", "⌨️", "🖱️", "🖨️", "📱", "☎️", "📠", "📞", "🖇️",
    "📎", "📋", "📁", "🗂️",
  ],
  "Electronics": [
    "📺", "📻", "📡", "🎙️", "🎚️", "🎛️", "📟", "🔊", "🎧", "📷",
    "📹", "🎥", "📽️", "🕹️",
  ],
  "Kitchen Appliances": [
    "☕", "🫖", "🍳", "🧊", "🌡️", "🥘", "🍲", "🥄", "🔪", "🥢",
  ],
  "Home Appliances": [
    "🧹", "🧺", "🪣", "🚿", "🛁", "🚽", "🧴", "🧼", "🪠", "🧯",
    "🪟", "🚪", "🛋️", "🪑",
  ],
  "Heating & Cooling": [
    "🌡️", "❄️", "🔥", "💨", "🌬️", "💧", "☂️", "⛱️",
  ],
  "Safety & Security": [
    "🧯", "⚠️", "🚨", "🔔", "📢", "🔑", "🔒", "🔓", "🛡️", "🚦",
  ],
};

// Icon Picker Component
function IconPicker({ 
  selectedIcon, 
  onSelectIcon 
}: { 
  selectedIcon: string; 
  onSelectIcon: (icon: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const { toast } = useToast();

  const handleCustomEmojiSubmit = () => {
    if (customEmoji.trim()) {
      onSelectIcon(customEmoji.trim());
      setCustomEmoji("");
      setIsOpen(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - only JPG and PNG
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG or PNG image only",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 200KB to account for base64 expansion)
    if (file.size > 200 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 200KB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      onSelectIcon(base64String);
      setIsOpen(false);
      // Reset the input
      event.target.value = '';
    };
    reader.onerror = () => {
      toast({
        title: "Upload Failed",
        description: "Failed to read the image file",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  // Check if icon is a base64 image
  const isBase64Image = selectedIcon?.startsWith('data:image/');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-16 p-0 overflow-hidden"
          data-testid="button-select-icon"
        >
          {isBase64Image ? (
            <img 
              src={selectedIcon} 
              alt="Custom icon" 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">{selectedIcon || "📦"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] sm:w-[400px] max-h-[400px] overflow-y-auto p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Select Icon</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Custom Image Upload */}
          <div className="border-b pb-3">
            <Label htmlFor="custom-image" className="text-xs font-medium text-gray-600 mb-2 block">
              Upload Custom Image
            </Label>
            <div className="space-y-2">
              <Input
                id="custom-image"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
                className="text-sm"
                data-testid="input-custom-image"
              />
              <p className="text-xs text-gray-500">Max 200KB • JPG and PNG only</p>
            </div>
          </div>

          {/* Custom Emoji Input */}
          <div className="border-b pb-3">
            <Label htmlFor="custom-emoji" className="text-xs font-medium text-gray-600 mb-2 block">
              Custom Emoji
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-emoji"
                placeholder="Paste emoji here..."
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomEmojiSubmit();
                  }
                }}
                className="text-xl text-center"
                data-testid="input-custom-emoji"
              />
              <Button
                size="sm"
                onClick={handleCustomEmojiSubmit}
                disabled={!customEmoji.trim()}
                data-testid="button-use-custom-emoji"
              >
                Use
              </Button>
            </div>
          </div>
          
          {Object.entries(ICON_LIBRARY).map(([category, icons]) => (
            <div key={category}>
              <h5 className="text-xs font-medium text-gray-600 mb-2">{category}</h5>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                {icons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => {
                      onSelectIcon(icon);
                      setIsOpen(false);
                    }}
                    className={`
                      h-10 w-10 rounded-md text-xl hover:bg-gray-100 transition-colors
                      flex items-center justify-center
                      ${selectedIcon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : ''}
                    `}
                    data-testid={`icon-option-${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Environments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  // Environments are only for electrical testing
  const selectedTab = "electrical";
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [environmentToDelete, setEnvironmentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<number | null>(null);
  const [newEnvironment, setNewEnvironment] = useState({
    name: "",
  });
  const [editItems, setEditItems] = useState<Item[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemValues, setEditingItemValues] = useState<Item>({ type: "", name: "", description: "", icon: "📦", classification: "class1" });
  const [newItem, setNewItem] = useState({
    type: "",
    name: "",
    description: "",
    icon: "📦",
    classification: "class1",
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
      setNewEnvironment({ name: "" });
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

  // Update environment mutation (for final save/done action)
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

  // Auto-save mutation (for incremental changes without closing edit mode)
  const autoSaveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Environment> }) => {
      return await apiRequest("PATCH", `/api/environments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environments"] });
      // Don't reset editing state - keep user in edit mode
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save changes",
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
    createMutation.mutate({ ...newEnvironment, serviceType: selectedTab });
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
    setEditingItemIndex(null);
    setNewItem({ type: "", name: "", description: "", icon: "📦", classification: "class1" });
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
    
    const savedNewItem = { ...newItem };
    const updatedItems = [...editItems, savedNewItem];
    
    // Update local state
    setEditItems(updatedItems);
    setNewItem({ type: "", name: "", description: "", icon: "📦", classification: "class1" });

    // Auto-save to backend
    try {
      await autoSaveMutation.mutateAsync({
        id: editingEnvironmentId,
        data: { items: updatedItems },
      });
    } catch (error) {
      // Rollback on error - restore previous state and preserve form values
      setEditItems(editItems);
      setNewItem(savedNewItem);
    }
  };

  const handleRemoveItem = async (index: number) => {
    if (editingEnvironmentId === null) return;
    
    const removedItem = editItems[index];
    const updatedItems = editItems.filter((_, i) => i !== index);
    
    // Update local state
    setEditItems(updatedItems);
    
    // Auto-save to backend
    try {
      await autoSaveMutation.mutateAsync({
        id: editingEnvironmentId,
        data: { items: updatedItems },
      });
    } catch (error) {
      // Rollback on error - restore the removed item
      setEditItems(editItems);
    }
  };

  const handleEditItemIcon = async (index: number, newIcon: string) => {
    if (editingEnvironmentId === null || autoSaveMutation.isPending) return;
    
    const previousItems = [...editItems];
    const updatedItems = [...editItems];
    updatedItems[index] = { ...updatedItems[index], icon: newIcon };
    
    // Update local state
    setEditItems(updatedItems);
    
    // Auto-save to backend
    try {
      await autoSaveMutation.mutateAsync({
        id: editingEnvironmentId,
        data: { items: updatedItems },
      });
    } catch (error) {
      // Rollback on error
      setEditItems(previousItems);
    }
  };

  const handleStartItemEdit = (index: number) => {
    setEditingItemIndex(index);
    setEditingItemValues({ ...editItems[index] });
  };

  const handleCancelItemEdit = () => {
    setEditingItemIndex(null);
  };

  const handleSaveItemEdit = async () => {
    if (editingItemIndex === null || editingEnvironmentId === null) return;
    if (!editingItemValues.name.trim() || !editingItemValues.type.trim()) {
      toast({ title: "Error", description: "Item name and type are required", variant: "destructive" });
      return;
    }
    const previousItems = [...editItems];
    const updatedItems = [...editItems];
    updatedItems[editingItemIndex] = { ...editingItemValues };
    setEditItems(updatedItems);
    setEditingItemIndex(null);
    try {
      await autoSaveMutation.mutateAsync({ id: editingEnvironmentId, data: { items: updatedItems } });
    } catch {
      setEditItems(previousItems);
      setEditingItemIndex(editingItemIndex);
    }
  };

  const getServiceTypeLabel = (serviceType: string) => {
    // Environments are only for electrical testing
    return "Electrical Testing";
  };
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: string } | undefined;
  
  // Redirect non-technician users
  useEffect(() => {
    if (user && typedUser?.role !== 'technician') {
      toast({
        title: "Access Denied",
        description: "Environments are only available for technician accounts",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [user, typedUser?.role, setLocation, toast]);
  
  // Don't render anything if not a technician
  if (!user || typedUser?.role !== 'technician') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading environments...</div>
      </div>
    );
  }

  // Filter environments by selected tab
  const filteredEnvironments = environments?.filter(env => env.serviceType === selectedTab) || [];

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Environments</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your custom item sets for different testing types</p>
      </div>

      {/* Header - Environments are only for Electrical Testing */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center">
          <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-medium text-sm">
            Electrical Testing Only
          </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-create-environment">
              <Plus className="w-4 h-4 mr-2" />
              Create Environment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Environment</DialogTitle>
              <DialogDescription>
                Create a custom environment for {getServiceTypeLabel(selectedTab)}.
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

      {!filteredEnvironments || filteredEnvironments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">No environments for {getServiceTypeLabel(selectedTab)}</p>
              <p className="text-sm">Create your first environment to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredEnvironments.map((env) => (
            <Card key={env.id} data-testid={`card-environment-${env.id}`}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">{env.name}</CardTitle>
                    <CardDescription className="text-sm">{getServiceTypeLabel(env.serviceType)}</CardDescription>
                  </div>
                  {editingEnvironmentId !== env.id && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditEnvironment(env)}
                        data-testid={`button-edit-${env.id}`}
                      >
                        <Edit className="w-4 h-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit Items</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setEnvironmentToDelete({ id: env.id, name: env.name });
                          setIsDeleteDialogOpen(true);
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
                    <div className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                      <h4 className="font-semibold mb-3 text-sm sm:text-base">Add New Item</h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm block">Icon</Label>
                            <IconPicker
                              selectedIcon={newItem.icon}
                              onSelectIcon={(icon) => setNewItem({ ...newItem, icon })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`item-name-${env.id}`} className="text-sm">Item Name</Label>
                            <Input
                              id={`item-name-${env.id}`}
                              data-testid="input-item-name"
                              placeholder="e.g., Drill, Lamp"
                              value={newItem.name}
                              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`item-type-${env.id}`} className="text-sm">Item Type</Label>
                            <Input
                              id={`item-type-${env.id}`}
                              data-testid="input-item-type"
                              placeholder="e.g., drill, lamp"
                              value={newItem.type}
                              onChange={(e) =>
                                setNewItem({ ...newItem, type: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                              }
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`item-description-${env.id}`} className="text-sm block">Description</Label>
                          <Input
                            id={`item-description-${env.id}`}
                            data-testid="input-item-description"
                            placeholder="e.g., Power Tool"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm block">Classification</Label>
                          <div className="flex flex-wrap gap-2">
                            {CLASSIFICATION_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setNewItem({ ...newItem, classification: opt.value })}
                                data-testid={`classification-${opt.value}`}
                                className={`px-3 py-1.5 rounded-md border-2 text-sm font-medium transition-all ${
                                  newItem.classification === opt.value
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddItem}
                        size="sm"
                        className="mt-3"
                        data-testid="button-add-item"
                        disabled={autoSaveMutation.isPending}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        {autoSaveMutation.isPending ? "Adding..." : "Add Item"}
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
                          {editItems.map((item, index) => {
                            const isBase64Image = item.icon?.startsWith('data:image/');

                            // ── Inline edit form ──────────────────────────────
                            if (editingItemIndex === index) {
                              return (
                                <div
                                  key={index}
                                  data-testid={`item-edit-form-${index}`}
                                  className="md:col-span-2 border-2 border-primary rounded-lg p-4 bg-blue-50 space-y-3"
                                >
                                  <h5 className="font-semibold text-sm text-primary">Edit Item</h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Icon</Label>
                                      <IconPicker
                                        selectedIcon={editingItemValues.icon}
                                        onSelectIcon={(icon) => setEditingItemValues({ ...editingItemValues, icon })}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Item Name</Label>
                                      <Input
                                        value={editingItemValues.name}
                                        onChange={(e) => setEditingItemValues({ ...editingItemValues, name: e.target.value })}
                                        placeholder="e.g., Drill"
                                        className="text-sm"
                                        data-testid={`input-edit-name-${index}`}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Item Type</Label>
                                      <Input
                                        value={editingItemValues.type}
                                        onChange={(e) => setEditingItemValues({ ...editingItemValues, type: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                        placeholder="e.g., drill"
                                        className="text-sm"
                                        data-testid={`input-edit-type-${index}`}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Description</Label>
                                    <Input
                                      value={editingItemValues.description}
                                      onChange={(e) => setEditingItemValues({ ...editingItemValues, description: e.target.value })}
                                      placeholder="e.g., Power Tool"
                                      className="text-sm"
                                      data-testid={`input-edit-description-${index}`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Classification</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {CLASSIFICATION_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => setEditingItemValues({ ...editingItemValues, classification: opt.value })}
                                          className={`px-3 py-1.5 rounded-md border-2 text-sm font-medium transition-all ${
                                            editingItemValues.classification === opt.value
                                              ? 'border-primary bg-primary text-white'
                                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveItemEdit}
                                      disabled={autoSaveMutation.isPending}
                                      data-testid={`button-save-item-${index}`}
                                    >
                                      {autoSaveMutation.isPending ? "Saving..." : "Save"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelItemEdit}
                                      data-testid={`button-cancel-item-edit-${index}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              );
                            }

                            // ── Normal display ────────────────────────────────
                            return (
                            <div
                              key={index}
                              data-testid={`item-${index}`}
                              className="flex items-center justify-between border rounded-lg p-3 bg-white"
                            >
                              <div className="flex items-center gap-3">
                                <div className="shrink-0 overflow-hidden">
                                  {isBase64Image ? (
                                    <img src={item.icon} alt="Custom icon" className="w-8 h-8 object-cover rounded" />
                                  ) : (
                                    <span className="text-2xl">{item.icon || "📦"}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-gray-500">{item.description}</div>
                                  {item.classification && (
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                      {CLASSIFICATION_OPTIONS.find(o => o.value === item.classification)?.label ?? item.classification}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartItemEdit(index)}
                                  disabled={autoSaveMutation.isPending}
                                  data-testid={`button-edit-item-${index}`}
                                >
                                  <Edit className="w-4 h-4 text-blue-500" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      data-testid={`button-remove-item-${index}`}
                                      disabled={autoSaveMutation.isPending}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Item?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Remove {item.name} from this environment?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRemoveItem(index)} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {!env.items || (Array.isArray(env.items) && env.items.length === 0) ? (
                      <p className="text-gray-500 text-sm">No items configured yet. Click "Edit Items" to add items.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {(Array.isArray(env.items) ? env.items : []).map((item: Item, index: number) => {
                          const isBase64Image = item.icon?.startsWith('data:image/');
                          return (
                          <div
                            key={index}
                            className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50"
                          >
                            {isBase64Image ? (
                              <img 
                                src={item.icon} 
                                alt="Custom icon" 
                                className="w-8 h-8 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <span className="text-xl flex-shrink-0">{item.icon}</span>
                            )}
                            <div className="text-sm">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-gray-500 text-xs">{item.description}</div>
                              {item.classification && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  {CLASSIFICATION_OPTIONS.find(o => o.value === item.classification)?.label ?? item.classification}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Environment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{environmentToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setEnvironmentToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (environmentToDelete) {
                  deleteMutation.mutate(environmentToDelete.id);
                  setIsDeleteDialogOpen(false);
                  setEnvironmentToDelete(null);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
