"use client"

import { useCallback, useState } from "react"
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
} from "reactflow"
import "reactflow/dist/style.css"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"

// Interface for node data
interface NodeData {
  label: string;
  status: string;
  type: string;
}

interface NodeProps {
  data: NodeData;
}

// Custom Node Components
function GatewayNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md border bg-white">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(data.status)}`} />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs text-gray-500">Gateway</div>
        </div>
      </div>
    </div>
  )
}

function SensorNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md border bg-white">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(data.status)}`} />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs text-gray-500">Sensor</div>
        </div>
      </div>
    </div>
  )
}

function ControllerNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md border bg-white">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(data.status)}`} />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs text-gray-500">Controller</div>
        </div>
      </div>
    </div>
  )
}

function ServerNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md border bg-white">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(data.status)}`} />
        <div>
          <div className="font-bold">{data.label}</div>
          <div className="text-xs text-gray-500">Server</div>
        </div>
      </div>
    </div>
  )
}

// Custom Node Types
const nodeTypes = {
  gateway: GatewayNode,
  sensor: SensorNode,
  controller: ControllerNode,
  server: ServerNode,
}

// Initial Nodes with Hierarchical Layout
const initialNodes = [
  {
    id: "server-1",
    type: "server",
    position: { x: 450, y: 50 },
    data: { 
      label: "SCADA Server",
      status: "online",
      type: "server",
    },
  },
  {
    id: "gw-001",
    type: "gateway",
    position: { x: 250, y: 200 },
    data: { 
      label: "Gateway-001",
      status: "online",
      type: "gateway",
    },
  },
  {
    id: "gw-002",
    type: "gateway",
    position: { x: 650, y: 200 },
    data: { 
      label: "Gateway-002",
      status: "warning",
      type: "gateway",
    },
  },
  {
    id: "plc-1",
    type: "controller",
    position: { x: 450, y: 300 },
    data: { 
      label: "PLC Controller",
      status: "online",
      type: "controller",
    },
  },
  {
    id: "sensor-1",
    type: "sensor",
    position: { x: 150, y: 400 },
    data: { 
      label: "Temperature Sensor",
      status: "online",
      type: "sensor",
    },
  },
  {
    id: "sensor-2",
    type: "sensor",
    position: { x: 350, y: 400 },
    data: { 
      label: "Pressure Sensor",
      status: "online",
      type: "sensor",
    },
  },
  {
    id: "sensor-3",
    type: "sensor",
    position: { x: 750, y: 400 },
    data: { 
      label: "Flow Sensor",
      status: "offline",
      type: "sensor",
    },
  },
]

// Update the edges to be more visible and properly connected
const initialEdges = [
  // Server connections
  {
    id: "e1",
    source: "server-1",
    target: "gw-001",
    type: "default",
    animated: true,
    style: { stroke: "#0ea5e9", strokeWidth: 3 },
    labelStyle: { fill: '#0ea5e9', fontWeight: 700 },
    label: "Ethernet",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#0ea5e9",
    },
  },
  {
    id: "e2",
    source: "server-1",
    target: "gw-002",
    type: "default",
    animated: true,
    style: { stroke: "#0ea5e9", strokeWidth: 3 },
    labelStyle: { fill: '#0ea5e9', fontWeight: 700 },
    label: "Ethernet",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#0ea5e9",
    },
  },
  {
    id: "e3",
    source: "server-1",
    target: "plc-1",
    type: "default",
    animated: true,
    style: { stroke: "#0ea5e9", strokeWidth: 3 },
    labelStyle: { fill: '#0ea5e9', fontWeight: 700 },
    label: "Ethernet",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#0ea5e9",
    },
  },
  
  // Gateway-001 connections
  {
    id: "e4",
    source: "gw-001",
    target: "sensor-1",
    type: "default",
    animated: true,
    style: { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: '5,5' },
    labelStyle: { fill: '#94a3b8', fontWeight: 700 },
    label: "Wireless",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#94a3b8",
    },
  },
  {
    id: "e5",
    source: "gw-001",
    target: "sensor-2",
    type: "default",
    animated: true,
    style: { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: '5,5' },
    labelStyle: { fill: '#94a3b8', fontWeight: 700 },
    label: "Wireless",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#94a3b8",
    },
  },
  {
    id: "e6",
    source: "gw-001",
    target: "plc-1",
    type: "default",
    animated: true,
    style: { stroke: "#0ea5e9", strokeWidth: 3 },
    labelStyle: { fill: '#0ea5e9', fontWeight: 700 },
    label: "Ethernet",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#0ea5e9",
    },
  },

  // Gateway-002 connections
  {
    id: "e7",
    source: "gw-002",
    target: "sensor-3",
    type: "default",
    animated: true,
    style: { stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: '5,5' },
    labelStyle: { fill: '#94a3b8', fontWeight: 700 },
    label: "Wireless",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#94a3b8",
    },
  },
  {
    id: "e8",
    source: "gw-002",
    target: "plc-1",
    type: "default",
    animated: true,
    style: { stroke: "#0ea5e9", strokeWidth: 3 },
    labelStyle: { fill: '#0ea5e9', fontWeight: 700 },
    label: "Ethernet",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#0ea5e9",
    },
  },
]

function getStatusColor(status: string): string {
  switch (status) {
    case "online":
      return "bg-green-500"
    case "offline":
      return "bg-red-500"
    case "warning":
      return "bg-yellow-500"
    default:
      return "bg-gray-500"
  }
}

export function NetworkGraph() {
  const router = useRouter()
  const [selectedNode, setSelectedNode] = useState<any>(null)
  
  // Initialize nodes and edges with the hooks
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((event: any, node: any) => {
    setSelectedNode(node)
  }, [])

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Network Topology</CardTitle>
        <CardDescription>Interactive view of connected devices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-[600px] rounded-lg border">
          {selectedNode && (
            <div className="absolute left-4 top-4 z-10">
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2">
                    <strong>{selectedNode.data.label}</strong>
                    <div className="text-sm text-muted-foreground">
                      Type: {selectedNode.data.type}
                      <br />
                      Status: {selectedNode.data.status}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        Actions
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/dashboard?device=${selectedNode.id}`)
                        }
                      >
                        Manage Device
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(
                            `/onboarding/configure?device=${selectedNode.id}`
                          )
                        }
                      >
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{
              type: 'default',
              animated: true,
              style: { strokeWidth: 3 },
              labelStyle: { fill: '#0ea5e9', fontWeight: 700 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
              },
            }}
            attributionPosition="bottom-right"
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.5}
            maxZoom={2}
          >
            <Controls />
            <MiniMap 
              nodeColor={node => {
                switch (node.data.status) {
                  case "online": return "#22c55e"
                  case "offline": return "#ef4444"
                  case "warning": return "#f59e0b"
                  default: return "#94a3b8"
                }
              }}
              style={{
                backgroundColor: '#fff',
              }}
            />
            <Background color="#aaa" gap={16} variant={"dots" as any} />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  )
} 