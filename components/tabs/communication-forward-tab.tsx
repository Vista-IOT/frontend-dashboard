import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  X,
  ArrowRight,
  Settings,
  Droplets,
  Filter,
  Sigma,
  Server,
  Cpu,
  Tag as TagIcon,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState, FC, useMemo, useEffect } from "react";
import {
  useConfigStore,
  DESTINATION_TYPES,
} from "@/lib/stores/configuration-store";
import type {
  IOTag,
  CalculationTag,
  StatsTag,
  DeviceConfig,
  IOPortConfig,
  Bridge,
  BridgeBlock,
} from "@/lib/stores/configuration-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VirtualMemoryMapConfig } from "../forms/virtual-memory-map-config";
import { MqttBrokerConfig } from "../forms/mqtt-broker-config";
import { AwsIotConfig } from "../forms/aws-iot-config";
import { FormulaConfig } from "../forms/formula-config";
import { FilterConfig } from "../forms/filter-config";
import { DataConversionConfig } from "../forms/data-conversion-config";
import CommunicationForwardDestinationsTab from "./communication-forward-destinations-tab";
import DestinationForm from "../forms/destination-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

// --- Data Structures are now in configuration-store.ts ---

const INTERMEDIATE_TYPES = [
  { key: "data-conversion", label: "Data Conversion", icon: Droplets },
  { key: "filter", label: "Filter", icon: Filter },
  { key: "formula", label: "Formula", icon: Sigma },
];

// --- Reusable Components ---

const BlockEditorModal = ({
  isOpen,
  onClose,
  onSave,
  block,
  config,
  onConfigChange,
  onSelectionChange,
  isSaveDisabled,
  ioTree,
  calculationTags,
  statsTags,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  block: BridgeBlock | null;
  config: any;
  onConfigChange: (newConfig: any) => void;
  onSelectionChange: (newSelection: any) => void;
  isSaveDisabled: boolean;
  ioTree: any[];
  calculationTags: CalculationTag[];
  statsTags: StatsTag[];
}) => {
  if (!isOpen || !block) return null;

  const { config: appConfig, updateConfig } = useConfigStore();
  const destinations = useMemo(
    () => appConfig.communication_forward?.destinations || [],
    [appConfig.communication_forward]
  );
  const [collapsedPorts, setCollapsedPorts] = useState<Record<string, boolean>>(
    {}
  );
  const [collapsedDestinations, setCollapsedDestinations] = useState<
    Record<string, boolean>
  >({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);

  // Helper function to render icons
  const renderIcon = (icon: any, className: string = "h-8 w-8") => {
    if (typeof icon === "string") {
      return <img src={icon} alt="" className={className} />;
    }
    // If it's a React component, render it
    const IconComponent = icon;
    return <IconComponent className={className} />;
  };

  const getModalTitle = () => {
    if (!block) return "";
    if (showCreateForm) return `Create New ${config.label || "Destination"}`;

    const action = block.subType ? "Edit" : "Select";
    const subject = block.type.charAt(0).toUpperCase() + block.type.slice(1);
    return `${action} ${subject}`;
  };

  const renderContent = () => {
    const typeList =
      block.type === "destination" ? DESTINATION_TYPES : INTERMEDIATE_TYPES;

    switch (block.type) {
      case "source":
        return (
          <Tabs defaultValue={config?.sourceType || "io-tag"}>
            <TabsList>
              <TabsTrigger value="io-tag">IO Tags</TabsTrigger>
              <TabsTrigger value="calc-tag">Calculation Tags</TabsTrigger>
              <TabsTrigger value="stats-tag">Stats Tags</TabsTrigger>
              <TabsTrigger value="user-tag">User Tags</TabsTrigger>
              <TabsTrigger value="system-tag">System Tags</TabsTrigger>
            </TabsList>
            <TabsContent value="io-tag">
              <ScrollArea className="h-96">
                <div className="space-y-2 p-1">
                  {ioTree.map((port: IOPortConfig) => (
                    <div key={port.id} className="relative pl-2">
                      <div className="absolute left-0 top-2 bottom-0 w-px bg-blue-200" />
                      <div
                        className="flex items-center font-medium text-primary mb-1 relative cursor-pointer select-none"
                        onClick={() =>
                          setCollapsedPorts((p) => ({
                            ...p,
                            [port.id]: !p[port.id],
                          }))
                        }
                      >
                        {collapsedPorts[port.id] ? (
                          <ChevronRight size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                        <Server size={16} className="mx-1 text-blue-700" />{" "}
                        {port.name}
                      </div>
                      {!collapsedPorts[port.id] &&
                        port.devices.map((device: DeviceConfig) => (
                          <div key={device.id} className="ml-4 relative pl-4">
                            <div className="flex items-center font-normal text-sm text-blue-900 mb-1 relative">
                              <Cpu size={16} className="mr-1 text-blue-500" />{" "}
                              {device.name}
                            </div>
                            {device.tags.map((tag: IOTag) => (
                              <div
                                key={tag.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ml-6 ${
                                  config?.id === tag.id
                                    ? "bg-purple-100 text-purple-900"
                                    : "hover:bg-accent"
                                }`}
                                onClick={() =>
                                  onSelectionChange({
                                    sourceType: "io-tag",
                                    ...tag,
                                  })
                                }
                              >
                                <TagIcon className="h-4 w-4 text-purple-600" />
                                {tag.name}
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="calc-tag">
              <ScrollArea className="h-96">
                <div className="space-y-1 p-1">
                  {calculationTags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                        config?.id === tag.id
                          ? "bg-green-100 text-green-900"
                          : "hover:bg-accent"
                      }`}
                      onClick={() =>
                        onSelectionChange({ sourceType: "calc-tag", ...tag })
                      }
                    >
                      <TagIcon className="h-4 w-4 text-green-600" />
                      {tag.name}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="stats-tag">
              <ScrollArea className="h-96">
                <div className="space-y-1 p-1">
                  {statsTags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                        config?.id === tag.id
                          ? "bg-orange-100 text-orange-900"
                          : "hover:bg-accent"
                      }`}
                      onClick={() =>
                        onSelectionChange({ sourceType: "stats-tag", ...tag })
                      }
                    >
                      <TagIcon className="h-4 w-4 text-orange-600" />
                      {tag.name}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="user-tag">
              <ScrollArea className="h-96">
                <div className="space-y-1 p-1">
                  {(appConfig.user_tags || []).map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                        config?.id === tag.id
                          ? "bg-blue-100 text-blue-900"
                          : "hover:bg-accent"
                      }`}
                      onClick={() =>
                        onSelectionChange({ sourceType: "user-tag", ...tag })
                      }
                    >
                      <TagIcon className="h-4 w-4 text-blue-600" />
                      {tag.name}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="system-tag">
              <ScrollArea className="h-96">
                <div className="space-y-1 p-1">
                  {(appConfig.system_tags || []).map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                        config?.id === tag.id
                          ? "bg-gray-100 text-gray-900"
                          : "hover:bg-accent"
                      }`}
                      onClick={() =>
                        onSelectionChange({ sourceType: "system-tag", ...tag })
                      }
                    >
                      <TagIcon className="h-4 w-4 text-gray-600" />
                      {tag.name}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        );

      case "destination":
        if (showCreateForm) {
          return (
            <div className="flex gap-6">
              {/* Left Panel: Type List */}
              <div className="w-1/3 space-y-2 pr-4 border-r">
                <h4 className="text-md font-semibold text-muted-foreground pb-2 border-b">
                  Destination Types
                </h4>
                {DESTINATION_TYPES.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      config.key === item.key
                        ? "border-primary bg-blue-50"
                        : "border-transparent bg-gray-50 hover:border-gray-300"
                    }`}
                    onClick={() => onSelectionChange({ ...item, config: {} })}
                  >
                    {renderIcon(item.icon, "h-8 w-8 text-blue-600")}
                    <span className="text-md font-semibold">{item.label}</span>
                  </div>
                ))}
              </div>
              {/* Right Panel: Configuration Form */}
              <div className="w-2/3">
                {config.key ? (
                  <DestinationForm
                    type={config.key}
                    onSubmit={(newDestData) => {
                      const allDestinations =
                        appConfig.communication_forward?.destinations || [];
                      updateConfig(
                        ["communication_forward", "destinations"],
                        [...allDestinations, newDestData]
                      );

                      onSelectionChange({
                        ...newDestData,
                        key: newDestData.type,
                        id: newDestData.id,
                        name: newDestData.name,
                      });

                      setShowCreateForm(false);
                    }}
                    onCancel={() => {
                      onSelectionChange({});
                      setShowCreateForm(false);
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Select a destination type to begin.</p>
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div>
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={() => {
                  onSelectionChange({});
                  setShowCreateForm(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Create New Destination
              </Button>
            </div>
            <ScrollArea className="h-96">
              <div className="space-y-2 p-1">
                {DESTINATION_TYPES.map((destType) => {
                  const typeDestinations = destinations.filter(
                    (d) => d.type === destType.key
                  );
                  if (typeDestinations.length === 0) return null;

                  return (
                    <div key={destType.key} className="relative pl-2">
                      <div className="absolute left-0 top-2 bottom-0 w-px bg-green-200" />
                      <div
                        className="flex items-center font-medium text-primary mb-1 relative cursor-pointer select-none"
                        onClick={() =>
                          setCollapsedDestinations((p) => ({
                            ...p,
                            [destType.key]: !p[destType.key],
                          }))
                        }
                      >
                        {collapsedDestinations[destType.key] ? (
                          <ChevronRight size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                        {renderIcon(
                          destType.icon,
                          "h-4 w-4 mx-1 text-green-700"
                        )}
                        {destType.label} ({typeDestinations.length})
                      </div>
                      {!collapsedDestinations[destType.key] &&
                        typeDestinations.map((dest: any) => (
                          <div
                            key={dest.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-sm ml-6 ${
                              config?.id === dest.id
                                ? "bg-green-100 text-green-900"
                                : "hover:bg-accent"
                            }`}
                            onClick={() =>
                              onSelectionChange({ ...dest, key: dest.type })
                            }
                          >
                            <div className="h-4 w-4 rounded-full bg-green-400" />
                            {dest.name}
                            {dest.type === "mqtt-broker" && (
                              <Input
                                type="text"
                                className="ml-2 border rounded px-2 py-1 w-56"
                                placeholder="Enter topic"
                                value={config?.config?.topic ?? ""}
                                onChange={e => {
                                  setSelectedBrokerId(dest.id);
                                  onConfigChange({ ...config, config: { ...config.config, topic: e.target.value } });
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            )}
                            {dest.description && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({dest.description})
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  );
                })}
                {destinations.length === 0 && (
                  <div className="text-center text-muted-foreground p-8">
                    <p>No destinations found.</p>
                    <p className="text-sm">
                      Click "Create New Destination" to add one.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );

      case "intermediate":
        return (
          <div className="flex gap-6">
            {/* Left Panel: Type List */}
            <div className="w-1/3 space-y-2 pr-4 border-r">
              {typeList.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    config.key === item.key
                      ? "border-primary bg-blue-50"
                      : "border-transparent bg-gray-50 hover:border-gray-300"
                  }`}
                  onClick={() => onSelectionChange({ ...item, config: {} })}
                >
                  {renderIcon(item.icon, "h-8 w-8 text-blue-600")}
                  <span className="text-md font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
            {/* Right Panel: Configuration Form */}
            <div className="w-2/3">
              {config.key ? (
                <>
                  {config.key === "virtual-memory-map" && (
                    <VirtualMemoryMapConfig
                      config={config.config}
                      onUpdate={(c) => onConfigChange({ ...config, config: c })}
                    />
                  )}
                  {config.key === "mqtt-broker" && (
                    <MqttBrokerConfig
                      config={config.config}
                      onUpdate={(c) => onConfigChange({ ...config, config: c })}
                    />
                  )}
                  {config.key === "aws-iot" && (
                    <AwsIotConfig
                      config={config.config}
                      onUpdate={(c) => onConfigChange({ ...config, config: c })}
                    />
                  )}
                  {config.key === "formula" && (
                    <FormulaConfig
                      config={config.config}
                      onUpdate={(c) => onConfigChange({ ...config, config: c })}
                    />
                  )}
                  {config.key === "filter" && (
                    <FilterConfig
                      config={config.config}
                      onUpdate={(c) => onConfigChange({ ...config, config: c })}
                    />
                  )}
                  {config.key === "data-conversion" && (
                    <DataConversionConfig
                      config={config.config}
                      onUpdate={(c) => onConfigChange({ ...config, config: c })}
                    />
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>Select a type to configure it.</p>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold">{getModalTitle()}</h3>
        <div className="my-4 max-h-[70vh] overflow-y-auto pr-2">
          {renderContent()}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="ghost"
            onClick={() => {
              if (showCreateForm) {
                setShowCreateForm(false);
                onSelectionChange({});
              } else {
                onClose();
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave();
            }}
            disabled={isSaveDisabled || showCreateForm}
          >
            Select
          </Button>
        </div>
      </div>
    </div>
  );
};

const ConfigPreview = ({ block }: { block: BridgeBlock }) => {
  if (
    !block.subType ||
    !block.config ||
    Object.keys(block.config).length === 0
  ) {
    return <p>No configuration set.</p>;
  }

  const { config: appConfig } = useConfigStore();
  const destinations = useMemo(
    () => appConfig.communication_forward?.destinations || [],
    [appConfig.communication_forward]
  );

  const renderDetails = () => {
    // Handle destination blocks that reference existing destinations
    if (block.type === "destination" && block.config.destinationId) {
      const destination = destinations.find(
        (d) => d.id === block.config.destinationId
      );
      if (destination) {
        return (
          <>
            <p>
              <strong>Destination:</strong> {destination.name}
            </p>
            <p>
              <strong>Type:</strong> {destination.type}
            </p>
            {destination.description && (
              <p>
                <strong>Description:</strong> {destination.description}
              </p>
            )}
          </>
        );
      }
      return <p>Destination not found.</p>;
    }

    // Handle other block types
    switch (block.subType) {
      case "mqtt-broker":
        return (
          <>
            <p>
              <strong>Topic:</strong> {block.config.topic || "N/A"}
            </p>
            <p>
              <strong>QoS:</strong> {block.config.qos ?? "N/A"}
            </p>
            <p>
              <strong>Retain:</strong> {block.config.retain ? "Yes" : "No"}
            </p>
          </>
        );
      case "virtual-memory-map":
        return (
          <>
            <p>
              <strong>Address:</strong> {block.config.address || "N/A"}
            </p>
            <p>
              <strong>Data Type:</strong> {block.config.dataType || "N/A"}
            </p>
            {block.config.dataType === "ascii" && (
              <p>
                <strong>Length:</strong> {block.config.length || "N/A"}{" "}
                registers
              </p>
            )}
          </>
        );
      case "aws-iot":
        return (
          <>
            <p>
              <strong>Thing Name:</strong> {block.config.thingName || "N/A"}
            </p>
            <p>
              <strong>Shadow:</strong> {block.config.shadow || "N/A"}
            </p>
          </>
        );
      case "formula":
        return (
          <p>
            <strong>Expression:</strong>{" "}
            <span className="font-mono">
              {block.config.expression || "N/A"}
            </span>
          </p>
        );
      case "filter":
        return (
          <p>
            <strong>Condition:</strong>{" "}
            <span className="font-mono">{`${
              block.config.condition || "pass"
            } if x ${block.config.operator || "=="} ${
              block.config.value || "N/A"
            }`}</span>
          </p>
        );
      case "data-conversion":
        return (
          <p>
            <strong>Convert to:</strong> {block.config.toType || "N/A"}
          </p>
        );
      default:
        return <p>Preview not available for this block type.</p>;
    }
  };

  return (
    <div className="space-y-1 text-sm p-1">
      <h4 className="font-bold border-b pb-1 mb-2">{block.label}</h4>
      {renderDetails()}
    </div>
  );
};

// A component to render a single block within a bridge.
const BridgeBlockDisplay: FC<{
  block: BridgeBlock;
  onConfigure: () => void;
  onDelete: () => void;
}> = ({ block, onConfigure, onDelete }) => {
  const isConfigured = block.subType !== null;
  const { config: appConfig } = useConfigStore();
  const destinations = useMemo(
    () => appConfig.communication_forward?.destinations || [],
    [appConfig.communication_forward]
  );

  const getIcon = () => {
    if (!isConfigured)
      return <Plus className="h-6 w-6 text-muted-foreground" />;

    const renderIcon = (icon: any, className: string = "h-8 w-8 mb-1") => {
      if (typeof icon === "string") {
        return <img src={icon} alt="" className={className} />;
      }
      const IconComponent = icon;
      return <IconComponent className={className} />;
    };

    // Different colors for different tag types
    if (block.subType === "io-tag") {
      return <TagIcon className="h-8 w-8 mb-1 text-purple-600" />;
    }
    if (block.subType === "calc-tag") {
      return <TagIcon className="h-8 w-8 mb-1 text-green-600" />;
    }
    if (block.subType === "stats-tag") {
      return <TagIcon className="h-8 w-8 mb-1 text-orange-600" />;
    }
    if (block.subType === "user-tag") {
      return <TagIcon className="h-8 w-8 mb-1 text-blue-600" />;
    }
    if (block.subType === "system-tag") {
      return <TagIcon className="h-8 w-8 mb-1 text-gray-600" />;
    }

    let destinationTypeKey = block.subType;

    // If the block is linked to a destination, find its type
    if (block.type === "destination" && block.config.destinationId) {
      const destination = destinations.find(
        (d) => d.id === block.config.destinationId
      );
      if (destination) {
        destinationTypeKey = destination.type;
      }
    }

    const destType =
      DESTINATION_TYPES.find((d) => d.key === destinationTypeKey) ||
      INTERMEDIATE_TYPES.find((i) => i.key === destinationTypeKey);

    if (destType) {
      return renderIcon(destType.icon);
    }

    return <Settings className="h-6 w-6" />;
  };

  const getBlockColor = () => {
    if (!isConfigured) return "border-gray-300";

    // Different border colors for different tag types
    if (block.subType === "io-tag") {
      return "border-purple-300 bg-purple-50";
    }
    if (block.subType === "calc-tag") {
      return "border-green-300 bg-green-50";
    }
    if (block.subType === "stats-tag") {
      return "border-orange-300 bg-orange-50";
    }
    if (block.subType === "user-tag") {
      return "border-blue-300 bg-blue-50";
    }
    if (block.subType === "system-tag") {
      return "border-gray-300 bg-gray-50";
    }

    // Default colors for other block types
    return "border-blue-300 bg-blue-50";
  };

  const renderConfigDetails = () => {
    if (!block.config || Object.keys(block.config).length === 0) return null;

    let details: string | React.ReactNode = "";

    // Handle destination blocks that reference existing destinations
    if (block.type === "destination" && block.config.destinationId) {
      const destination = destinations.find(
        (d) => d.id === block.config.destinationId
      );
      if (destination) {
        details = `${destination.type} - ${destination.name}`;
      } else {
        details = "Destination not found";
      }
    } else {
      // Handle other block types
      switch (block.subType) {
        case "mqtt-broker":
          details = block.config.topic || "No topic set";
          break;
        case "virtual-memory-map":
          details = `Addr: ${block.config.address || "N/A"}`;
          break;
        case "aws-iot":
          details = block.config.thingName || "No thing name";
          break;
        case "formula":
          details = block.config.expression || "No formula";
          break;
        case "filter":
          if (block.config.value) {
            details = (
              <span className="font-mono text-blue-700">{`${
                block.config.condition || "pass"
              } if x ${block.config.operator || "=="} ${
                block.config.value
              }`}</span>
            );
          } else {
            details = "Incomplete filter";
          }
          break;
        case "data-conversion":
          details = `To: ${block.config.toType || "N/A"}`;
          break;
        default:
          return null;
      }
    }

    return (
      <div className="text-xs text-slate-500 mt-1 px-1 w-full truncate text-center">
        {details}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              variant={isConfigured ? "secondary" : "outline"}
              className={`w-48 h-24 flex flex-col items-center justify-center border-2 text-center p-2 ${getBlockColor()}`}
              onClick={onConfigure}
            >
              {getIcon()}
              <span className="text-sm mt-1 whitespace-normal">
                {block.label}
              </span>
              {renderConfigDetails()}
            </Button>
            {block.type === "intermediate" && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        {isConfigured && (
          <TooltipContent>
            <ConfigPreview block={block} />
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

// Bridges Tab Content Component
const BridgesTabContent = () => {
  const { config: appConfig, updateConfig, saveConfigToBackend } = useConfigStore();
  const bridges = useMemo(
    () => appConfig.communication_forward?.bridges || [],
    [appConfig.communication_forward]
  );

  const [editingBlock, setEditingBlock] = useState<{
    bridgeId: string;
    blockId: string;
    atIndex?: number;
  } | null>(null);
  const [tempSelection, setTempSelection] = useState<any>(null);

  const setBridges = (newBridges: Bridge[]) => {
    updateConfig(["communication_forward", "bridges"], newBridges);
  };

  const ioTree = useMemo(
    () =>
      (appConfig.io_setup?.ports || []).map((port) => ({
        ...port,
        devices: (port.devices || []).map((device) => ({
          ...device,
          tags: device.tags || [],
        })),
      })),
    [appConfig.io_setup?.ports]
  );

  const calculationTags = useMemo(
    () => appConfig.calculation_tags || [],
    [appConfig.calculation_tags]
  );
  const statsTags = useMemo(
    () => appConfig.stats_tags || [],
    [appConfig.stats_tags]
  );

  const addBridge = () => {
    const bridgeId = `bridge-${Date.now()}`;
    const newBridge: Bridge = {
      id: bridgeId,
      blocks: [
        {
          id: `${bridgeId}-source`,
          type: "source",
          subType: null,
          label: "Select Source",
          config: {},
        },
        {
          id: `${bridgeId}-dest`,
          type: "destination",
          subType: null,
          label: "Select Destination",
          config: {},
        },
      ],
    };
    setBridges([...bridges, newBridge]);
  };

  const removeBridge = (bridgeId: string) => {
    const newBridges = bridges.filter((b) => b.id !== bridgeId);
    setBridges(newBridges);
  };

  const removeBlock = (bridgeId: string, blockId: string) => {
    const newBridges = bridges.map((bridge) => {
      if (bridge.id === bridgeId) {
        const blockToRemove = bridge.blocks.find((b) => b.id === blockId);
        if (blockToRemove?.type !== "intermediate") return bridge;

        const newBlocks = bridge.blocks.filter((block) => block.id !== blockId);
        return { ...bridge, blocks: newBlocks };
      }
      return bridge;
    });
    setBridges(newBridges);
  };

  const handleSaveConfiguration = async () => {
    if (!editingBlock) return;

    const { bridgeId, blockId, atIndex } = editingBlock;

    // Handle insertion of a new intermediate block
    if (atIndex !== undefined) {
      const newBlock: BridgeBlock = {
        id: `bridge-${bridgeId}-block-${Date.now()}`,
        type: "intermediate",
        subType: tempSelection.key as BridgeBlock["subType"],
        label: tempSelection.label,
        config: tempSelection.config || {},
      };

      const newBridges = bridges.map((bridge) => {
        if (bridge.id === bridgeId) {
          const newBlocks = [...bridge.blocks];
          newBlocks.splice(atIndex, 0, newBlock);
          return { ...bridge, blocks: newBlocks };
        }
        return bridge;
      });
      setBridges(newBridges);
    } else {
      // Handle updating an existing block
      const newBridges = bridges.map((bridge) => {
        if (bridge.id !== bridgeId) return bridge;

        const newBlocks = bridge.blocks.map((block) => {
          if (block.id !== blockId) return block;

          let updatedBlock: BridgeBlock = { ...block };

          // This logic now covers both initial selection and re-selection/editing
          if (tempSelection.sourceType) {
            // It's a source block
            updatedBlock.subType = tempSelection.sourceType;
            updatedBlock.label = tempSelection.tagName || tempSelection.name;
            updatedBlock.config = {
              tagId: tempSelection.tagId || tempSelection.id,
            };
          } else if (tempSelection.key) {
            // It's a dest or intermediate block
            if (block.type === "destination" && tempSelection.id) {
              // This is an existing destination being selected
              updatedBlock.subType = tempSelection.type as BridgeBlock["subType"];
              updatedBlock.label = tempSelection.name;
              // Merge topic from tempSelection.config.topic if present
              updatedBlock.config = {
                destinationId: tempSelection.id,
                ...(tempSelection.config && tempSelection.config.topic ? { topic: tempSelection.config.topic } : {}),
              };
            } else {
              // This is a new destination or intermediate block being configured
              updatedBlock.subType =
                tempSelection.key as BridgeBlock["subType"];
              updatedBlock.label = tempSelection.label;
              updatedBlock.config = tempSelection.config || {};
            }
          }

          return updatedBlock;
        });
        toast.success("Added New Bridge");
        return { ...bridge, blocks: newBlocks };
      });
      setBridges(newBridges);
    }

    await saveConfigToBackend();
    setEditingBlock(null);
    setTempSelection(null);
  };

  const openConfigurationModal = (bridgeId: string, blockId: string) => {
    const bridge = bridges.find((b) => b.id === bridgeId);
    const block = bridge?.blocks.find((b) => b.id === blockId);
    if (!block) return;

    // Prepare tempSelection state based on the block being edited
    if (block.subType) {
      if (block.type === "source") {
        // Find the full tag object to populate tempSelection
        const sourceTag =
          block.subType === "io-tag"
            ? appConfig.io_setup?.ports
                .flatMap((p) => p.devices)
                .flatMap((d) => d.tags)
                .find((t) => t.id === block.config.tagId)
            : block.subType === "calc-tag"
            ? appConfig.calculation_tags?.find(
                (t) => t.id === block.config.tagId
              )
            : appConfig.stats_tags?.find((t) => t.id === block.config.tagId);
        setTempSelection({ sourceType: block.subType, ...sourceTag });
      } else {
        const typeDef =
          block.type === "destination"
            ? DESTINATION_TYPES.find((d) => d.key === block.subType)
            : INTERMEDIATE_TYPES.find((i) => i.key === block.subType);
        setTempSelection({ ...typeDef, config: block.config });
      }
    } else {
      setTempSelection({}); // Initialize with empty object, not null
    }

    setEditingBlock({ bridgeId, blockId });
  };

  const currentEditingBlock = useMemo(() => {
    if (!editingBlock) return null;
    const bridge = bridges.find((b) => b.id === editingBlock.bridgeId);
    // If we're adding a new intermediate block, we created a placeholder.
    if (editingBlock.atIndex !== undefined) {
      const placeholderBlock: BridgeBlock = {
        id: editingBlock.blockId,
        type: "intermediate",
        subType: null,
        label: "Select Step",
        config: {},
      };
      return placeholderBlock;
    }
    return bridge?.blocks.find((b) => b.id === editingBlock.blockId) || null;
  }, [editingBlock, bridges]);

  // This logic for adding an intermediate block needs to be updated to use the new modal system
  const openAddIntermediateModal = (bridgeId: string, atIndex: number) => {
    // Create a temporary ID for the new block we're about to add.
    const tempBlockId = `temp-intermediate-${Date.now()}`;
    setTempSelection({}); // It starts with nothing selected
    setEditingBlock({ bridgeId, blockId: tempBlockId, atIndex });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-start">
        <Button onClick={addBridge}>
          <Plus className="mr-2 h-4 w-4" /> Add Bridge
        </Button>
      </div>

      <div className="space-y-4">
        {bridges.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 rounded-lg border border-dashed">
            <span>No bridges created yet.</span>
            <p className="text-sm">Click "Add Bridge" to get started.</p>
          </div>
        )}
        {bridges.map((bridge) => (
          <Card
            key={bridge.id}
            className="bg-white shadow-sm hover:shadow-md transition-shadow overflow-x-auto"
          >
            <CardContent className="p-4 flex items-center justify-between min-w-max">
              <div className="flex items-center gap-2 flex-1">
                {bridge.blocks.map((block, index) => (
                  <div key={block.id} className="flex items-center gap-2">
                    <BridgeBlockDisplay
                      block={block}
                      onConfigure={() =>
                        openConfigurationModal(bridge.id, block.id)
                      }
                      onDelete={() => removeBlock(bridge.id, block.id)}
                    />
                    {index < bridge.blocks.length - 1 && (
                      <div className="flex flex-col items-center">
                        <ArrowRight className="h-6 w-6 text-gray-300" />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full -my-2"
                          onClick={() =>
                            openAddIntermediateModal(bridge.id, index + 1)
                          }
                        >
                          <Plus className="h-4 w-4 text-blue-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive ml-4"
                onClick={() => removeBridge(bridge.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <BlockEditorModal
        isOpen={!!editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={handleSaveConfiguration}
        block={currentEditingBlock}
        config={tempSelection}
        onConfigChange={setTempSelection}
        onSelectionChange={(newSel) => setTempSelection(newSel)}
        isSaveDisabled={!tempSelection}
        ioTree={ioTree}
        calculationTags={calculationTags}
        statsTags={statsTags}
      />
    </div>
  );
};

export default function CommunicationForwardTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Forward</CardTitle>
        <CardDescription>
          Create data bridges by connecting sources to destinations, with
          optional intermediate steps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bridges" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bridges">Bridges</TabsTrigger>
            <TabsTrigger value="destinations">Destinations</TabsTrigger>
          </TabsList>
          <TabsContent value="bridges">
            <BridgesTabContent />
          </TabsContent>
          <TabsContent value="destinations">
            <CommunicationForwardDestinationsTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
