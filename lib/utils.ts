import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Build a consistent IO tag/device/port tree from config
export function buildIoTagTree(config: any, options: { excludeCalculationTagId?: string, excludeCalculationTags?: boolean } = {}) {
  const { excludeCalculationTagId, excludeCalculationTags } = options;
  const ports = config?.io_setup?.ports || [];
  return ports.map((port: any) => ({
    ...port,
    devices: (port.devices || []).map((device: any) => ({
      ...device,
      tags: (device.tags || []).filter((tag: any) => {
        if (excludeCalculationTagId && tag.id === excludeCalculationTagId) return false;
        if (excludeCalculationTags && tag.type === 'calculation') return false;
        return true;
      })
    }))
  }));
}
