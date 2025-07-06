import {
  useConfigStore,
  DESTINATION_TYPES,
} from "@/lib/stores/configuration-store";
import type { Destination } from "@/lib/stores/configuration-store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  X,
} from "lucide-react";
import { useState, useMemo, FC } from "react";
import DestinationForm from "../forms/destination-form";

const DestinationModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Destination) => void;
  initialData?: Destination | null;
  initialType?: string | null;
  existingConfigs: Destination[];
}> = ({ isOpen, onClose, onSubmit, initialData, initialType }) => {
  if (!isOpen) return null;

  const [selectedType, setSelectedType] = useState<string | null>(
    initialData?.type ?? initialType ?? null
  );
  const [isEditing, setIsEditing] = useState<boolean>(!!initialData);

  const getTitle = () => {
    if (isEditing) return `Edit ${initialData?.name || "Destination"}`;
    if (selectedType) {
      const typeInfo = DESTINATION_TYPES.find((t) => t.key === selectedType);
      return `Create New ${typeInfo?.label || "Destination"}`;
    }
    return "Add New Destination";
  };

  const renderIcon = (icon: any, className: string = "h-6 w-6") => {
    if (typeof icon === "string") {
      return <img src={icon} alt="" className={className} />;
    }
    const IconComponent = icon;
    return <IconComponent className={className} />;
  };
  const { config, updateConfig } = useConfigStore();
  const destinations = useMemo(
    () => config.communication_forward?.destinations || [],
    [config.communication_forward]
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{getTitle()}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          {!selectedType ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DESTINATION_TYPES.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-4 p-4 rounded-lg border-2 border-transparent bg-gray-50 hover:border-gray-300 cursor-pointer transition-all"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedType(item.key);
                  }}
                >
                  {renderIcon(item.icon, "h-8 w-8 text-blue-600")}
                  <div>
                    <span className="text-md font-semibold">{item.label}</span>
                    <p className="text-sm text-muted-foreground">
                      Create a new {item.label} destination.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DestinationForm
              type={selectedType}
              initialValues={initialData}
              existingConfigs={destinations}
              onSubmit={onSubmit}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default function CommunicationForwardDestinationsTab() {
  const { config, updateConfig } = useConfigStore();
  const destinations = useMemo(
    () => config.communication_forward?.destinations || [],
    [config.communication_forward]
  );
  const [activeType, setActiveType] = useState<string>(
    DESTINATION_TYPES[0].key
  );
  const [editingDestination, setEditingDestination] =
    useState<Destination | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const grouped = useMemo(() => {
    return destinations.reduce<Record<string, Destination[]>>((acc, dest) => {
      if (!acc[dest.type]) acc[dest.type] = [];
      acc[dest.type].push(dest);
      return acc;
    }, {});
  }, [destinations]);

  const handleOpenModal = (dest: Destination | null = null) => {
    setEditingDestination(dest);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingDestination(null);
    setIsModalOpen(false);
  };

  const handleSave = (destData: Destination) => {
    let newDests;
    if (editingDestination) {
      newDests = destinations.map((d) => (d.id === destData.id ? destData : d));
    } else {
      newDests = [...destinations, destData];
    }
    updateConfig(["communication_forward", "destinations"], newDests);
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this destination?")) {
      const newDests = destinations.filter((d) => d.id !== id);
      updateConfig(["communication_forward", "destinations"], newDests);
    }
  };

  const renderIcon = (icon: any, className: string = "h-5 w-5") => {
    if (typeof icon === "string") {
      return <img src={icon} alt="" className={className} />;
    }
    const IconComponent = icon;
    return <IconComponent className={className} />;
  };

  const activeTypeInfo = useMemo(
    () => DESTINATION_TYPES.find((t) => t.key === activeType),
    [activeType]
  );

  return (
    <>
      <div className="border rounded-lg flex h-[calc(100vh-280px)] bg-background mt-4">
        {/* Left Panel: Tree/Navigation */}
        <div className="w-1/3 lg:w-1/4 border-r bg-muted/20 overflow-y-auto">
          <div className="p-2">
            <h3 className="text-base font-semibold p-2 text-foreground">
              Destination Types
            </h3>
          </div>
          <nav className="space-y-1 p-2">
            {DESTINATION_TYPES.map(({ key, label, icon }) => (
              <a
                key={key}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveType(key);
                }}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeType === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {renderIcon(icon)}
                <span className="flex-1">{label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    activeType === key ? "bg-primary-foreground/20" : "bg-muted"
                  }`}
                >
                  {grouped[key]?.length || 0}
                </span>
              </a>
            ))}
          </nav>
        </div>

        {/* Right Panel: Content */}
        <div className="w-2/3 lg:w-3/4 overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">{activeTypeInfo?.label}</h2>
                <p className="text-muted-foreground">
                  Define and manage reusable{" "}
                  {activeTypeInfo?.label.toLowerCase()} destinations.
                </p>
              </div>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="mr-2 h-4 w-4" /> Add Destination
              </Button>
            </div>

            <div className="space-y-3">
              {grouped[activeType] && grouped[activeType].length > 0 ? (
                grouped[activeType].map((dest) => (
                  <Card
                    key={dest.id}
                    className="flex items-center justify-between p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-primary">{dest.name}</p>
                      {dest.description && (
                        <p className="text-sm text-muted-foreground">
                          {dest.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenModal(dest)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive/80"
                        onClick={() => handleDelete(dest.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                  <p className="font-medium">
                    No {activeTypeInfo?.label} destinations found.
                  </p>
                  <p className="text-sm mt-1">
                    Click "Add Destination" to create one
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DestinationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSave}
        initialData={editingDestination}
        initialType={!editingDestination ? activeType : undefined}
        existingConfigs={destinations}
      />
    </>
  );
}
