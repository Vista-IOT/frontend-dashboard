import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import yaml from 'js-yaml';

// Add CORS headers to all responses
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  return response;
}

// Handle preflight requests
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    let config;
    try {
      config = yaml.load(body); // Try YAML first
    } catch (e) {
      try {
        config = JSON.parse(body); // Try JSON fallback
      } catch (e2) {
        const response = NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
        return addCorsHeaders(response);
      }
    }

    // Store the raw config as a snapshot
    await prisma.configSnapshot.create({
      data: {
        raw: body,
      },
    });

    // --- Comprehensive DB population ---
    // Clear existing records (for a fresh deployment)
    // Delete in order that respects foreign key constraints
    await prisma.virtualMemoryMap.deleteMany({});
    await prisma.statsTag.deleteMany({});
    await prisma.calculationTag.deleteMany({});
    await prisma.iOTag.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.iOPort.deleteMany({});
    await prisma.bridgeBlock.deleteMany({});
    await prisma.communicationBridge.deleteMany({});
    await prisma.destination.deleteMany({});
    await prisma.hardwareMapping.deleteMany({});

    let ioPortCount = 0;
    let deviceCount = 0;
    let tagCount = 0;
    let calcTagCount = 0;
    let statsTagCount = 0;
    let bridgeCount = 0;
    let blockCount = 0;

    // Build a lookup map for IOTags by 'DeviceName:TagName' for reference resolution
    const ioTagLookup: Record<string, string> = {};
    if (config?.io_setup?.ports && Array.isArray(config.io_setup.ports)) {
      for (const port of config.io_setup.ports) {
        for (const device of port.devices || []) {
          for (const tag of device.tags || []) {
            // Key: 'DeviceName:TagName' (case-insensitive)
            ioTagLookup[`${device.name}:${tag.name}`.toLowerCase()] = tag.id;
          }
        }
      }
    }

    // Insert Hardware Mappings FIRST
    if (config?.hardware_mappings && Array.isArray(config.hardware_mappings)) {
      for (const mapping of config.hardware_mappings) {
        await prisma.hardwareMapping.create({
          data: {
            id: mapping.id?.toString() ?? undefined,
            name: mapping.name,
            type: mapping.type,
            path: mapping.path,
            description: mapping.description ?? null,
          },
        });
      }
    }

    // Insert IO Ports, Devices, and Tags
    if (config?.io_setup?.ports && Array.isArray(config.io_setup.ports)) {
      for (const port of config.io_setup.ports) {
        const ioPortData: any = {
          id: port.id,
          type: port.type,
          name: port.name,
          description: port.description ?? '',
          scanTime: port.scanTime ?? 0,
          timeOut: port.timeOut ?? 0,
          retryCount: port.retryCount ?? 0,
          autoRecoverTime: port.autoRecoverTime ?? 0,
          scanMode: port.scanMode ?? '',
          enabled: port.enabled ?? true,
        };

        if (port.serialSettings) {
          ioPortData.serialSettings = JSON.stringify(port.serialSettings);
        }
        if (port.hardwareMappingId) {
          // Use hardwareMappingId as the primary hardware source
          ioPortData.hardwareMappingId = port.hardwareMappingId;
          ioPortData.hardwareInterface = undefined;
        } else if (port.hardwareInterface) {
          // Only use hardwareInterface for custom/manual entries
          ioPortData.hardwareInterface = port.hardwareInterface;
        }

        const createdPort = await prisma.iOPort.create({ data: ioPortData });
        ioPortCount++;
        if (port.devices && Array.isArray(port.devices)) {
          for (const device of port.devices) {
            const createdDevice = await prisma.device.create({
              data: {
                id: device.id,
                ioPortId: createdPort.id,
                enabled: device.enabled ?? true,
                name: device.name,
                deviceType: device.deviceType ?? device.type ?? '',
                unitNumber: device.unitNumber ?? 1,
                tagWriteType: device.tagWriteType ?? '',
                description: device.description ?? '',
                addDeviceNameAsPrefix: device.addDeviceNameAsPrefix ?? false,
                useAsciiProtocol: device.useAsciiProtocol ?? 0,
                packetDelay: device.packetDelay ?? 0,
                digitalBlockSize: device.digitalBlockSize ?? 0,
                analogBlockSize: device.analogBlockSize ?? 0,
              },
            });
            deviceCount++;
            if (device.tags && Array.isArray(device.tags)) {
              for (const tag of device.tags) {
                await prisma.iOTag.create({
                  data: {
                    id: tag.id,
                    deviceId: createdDevice.id,
                    name: tag.name,
                    dataType: tag.dataType ?? '',
                    registerType: tag.registerType ?? null,
                    conversionType: tag.conversionType ?? null,
                    address: tag.address ?? '',
                    startBit: tag.startBit ?? null,
                    lengthBit: tag.lengthBit ?? null,
                    spanLow: tag.spanLow ?? null,
                    spanHigh: tag.spanHigh ?? null,
                    defaultValue: tag.defaultValue ?? null,
                    scanRate: tag.scanRate ?? null,
                    readWrite: tag.readWrite ?? null,
                    description: tag.description ?? null,
                    scaleType: tag.scaleType ?? null,
                    formula: tag.formula ?? null,
                    scale: tag.scale ?? null,
                    offset: tag.offset ?? null,
                    clampToLow: tag.clampToLow ?? null,
                    clampToHigh: tag.clampToHigh ?? null,
                    clampToZero: tag.clampToZero ?? null,
                  },
                });
                tagCount++;
              }
            }
          }
        }
      }
    }

    // Insert Calculation Tags with normalized references
    if (config?.calculation_tags && Array.isArray(config.calculation_tags)) {
      for (const tag of config.calculation_tags) {
        // Helper to resolve a reference string to IOTag ID
        const resolveTagId = (ref: string | undefined) => {
          if (!ref) return null;
          const key = ref.toLowerCase();
          return ioTagLookup[key] || null;
        };
        await prisma.calculationTag.create({
          data: {
            id: tag.id,
            name: tag.name,
            defaultValue: tag.defaultValue ?? null,
            formula: tag.formula ?? null,
            a: tag.a ?? null,
            b: tag.b ?? null,
            c: tag.c ?? null,
            d: tag.d ?? null,
            e: tag.e ?? null,
            f: tag.f ?? null,
            g: tag.g ?? null,
            h: tag.h ?? null,
            aTagId: resolveTagId(tag.a),
            bTagId: resolveTagId(tag.b),
            cTagId: resolveTagId(tag.c),
            dTagId: resolveTagId(tag.d),
            eTagId: resolveTagId(tag.e),
            fTagId: resolveTagId(tag.f),
            gTagId: resolveTagId(tag.g),
            hTagId: resolveTagId(tag.h),
            period: tag.period !== undefined && tag.period !== null ? (typeof tag.period === 'string' ? parseInt(tag.period, 10) : tag.period) : null,
            readWrite: tag.readWrite ?? null,
            spanHigh: tag.spanHigh !== undefined && tag.spanHigh !== null ? (typeof tag.spanHigh === 'string' ? parseInt(tag.spanHigh, 10) : tag.spanHigh) : null,
            spanLow: tag.spanLow !== undefined && tag.spanLow !== null ? (typeof tag.spanLow === 'string' ? parseInt(tag.spanLow, 10) : tag.spanLow) : null,
            isParent: tag.isParent ?? null,
            description: tag.description ?? null,
          },
        });
        calcTagCount++;
      }
    }

    // Insert Stats Tags with normalized references
    if (config?.stats_tags && Array.isArray(config.stats_tags)) {
      for (const tag of config.stats_tags) {
        // Helper to resolve referTag string to IOTag ID
        const resolveTagId = (ref: string | undefined) => {
          if (!ref) return null;
          const key = ref.toLowerCase();
          return ioTagLookup[key] || null;
        };
        const referTagId = resolveTagId(tag.referTag);
        if (typeof referTagId !== 'string') continue; // Skip if referTagId is not a string
        await prisma.statsTag.create({
          data: {
            id: tag.id?.toString() ?? undefined,
            name: tag.name,
            referTagObj: { connect: { id: referTagId } },
            type: tag.type,
            updateCycleValue: (tag.updateCycleValue !== undefined && tag.updateCycleValue !== null && !isNaN(Number(tag.updateCycleValue)))
              ? (typeof tag.updateCycleValue === 'string' ? parseInt(tag.updateCycleValue, 10) : tag.updateCycleValue)
              : 1, // Default to 1 if missing or invalid
            updateCycleUnit: tag.updateCycleUnit ?? "sec",
            description: tag.description ?? null,
          },
        });
        statsTagCount++;
      }
    }

    // Insert Communication Bridges and Blocks
    if (config?.communication_forward?.bridges && Array.isArray(config.communication_forward.bridges)) {
      for (const bridge of config.communication_forward.bridges) {
        if (!bridge.id) continue; // Skip bridges without an ID

        const createdBridge = await prisma.communicationBridge.create({
          data: {
            id: bridge.id,
          },
        });
        bridgeCount++;

        if (bridge.blocks && Array.isArray(bridge.blocks)) {
          for (const block of bridge.blocks) {
            if (!block.id) continue; // Skip blocks without an ID

            await prisma.bridgeBlock.create({
              data: {
                id: block.id,
                bridgeId: createdBridge.id,
                type: block.type,
                subType: block.subType ?? null,
                label: block.label,
                configJson: block.config ? JSON.stringify(block.config) : '{}',
              },
            });
            blockCount++;
          }
        }
      }
    }

    // Insert Destinations for VMM (must exist before VMM entries)
    if (config?.communication_forward?.destinations && Array.isArray(config.communication_forward.destinations)) {
      for (const dest of config.communication_forward.destinations) {
        // Only create if type is virtual-memory-map and not already created
        if (dest.type === 'virtual-memory-map') {
          await prisma.destination.create({
            data: {
              id: dest.id,
              name: dest.name || dest.id,
              type: dest.type,
              configJson: dest.configJson ? JSON.stringify(dest.configJson) : '{}',
              description: dest.description || null,
            },
          });
        }
      }
    }

    // Insert Virtual Memory Map entries (VMM)
    if (config?.communication_forward?.destinations && Array.isArray(config.communication_forward.destinations)) {
      for (const dest of config.communication_forward.destinations) {
        if (dest.type === 'virtual-memory-map' && dest.memory) {
          // Use unitId from VMM form field if present, else default to 1
          let unitId = 1;
          if (dest.memory.unitId !== undefined && dest.memory.unitId !== null) {
            unitId = parseInt(dest.memory.unitId, 10) || 1;
          }
          await prisma.virtualMemoryMap.create({
            data: {
              destinationId: dest.id,
              address: dest.memory.address,
              dataType: dest.memory.dataType,
              length: dest.memory.length !== undefined ? parseInt(dest.memory.length, 10) : null,
              value: null,
              buffer: null,
              unitId: unitId,
            },
          });
        }
      }
    }

    // Trigger backend reload/restart (use env var for backend URL)
    // try {
    //   const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    //   const resp = await fetch(`${backendUrl}/restart`, {
    //     method: 'POST',
    //   });
    //   // Optionally log the response for debugging
    //   const respText = await resp.text();
    //   console.log('Backend restart response:', resp.status, respText);
    // } catch (err) {
      // console.error('Failed to trigger backend restart:', err);
    // }

    const response = NextResponse.json({
      success: true,
      ioPorts: ioPortCount,
      devices: deviceCount,
      tags: tagCount,
      calculationTags: calcTagCount,
      statsTags: statsTagCount,
      bridges: bridgeCount,
      blocks: blockCount,
    });
    
    return addCorsHeaders(response);
  } catch (error) {
    console.error("DEPLOY ERROR:", error);
    const response = NextResponse.json(
      { error: error instanceof Error ? (error.stack || error.message) : String(error) },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}

export async function GET() {
  try {
    // Get the latest config snapshot
    const latest = await prisma.configSnapshot.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      const response = NextResponse.json({ error: 'No config snapshot found' }, { status: 404 });
      return addCorsHeaders(response);
    }
    const response = NextResponse.json({ raw: latest.raw });
    return addCorsHeaders(response);
  } catch (error) {
    console.error("GET ERROR:", error);
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
