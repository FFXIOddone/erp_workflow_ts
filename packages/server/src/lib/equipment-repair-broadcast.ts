import { buildRouteBroadcastPayload } from './route-broadcast.js';

type EquipmentIdentityLike = {
  id: string;
  name: string;
  type: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  station?: string | null;
  ipAddress?: string | null;
  snmpCommunity?: string | null;
  connectionType?: string | null;
};

export type EquipmentIdentitySnapshot = {
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  station: string;
  ipAddress: string;
  snmpCommunity: string;
  connectionType: string;
};

function normalizeEquipmentIdentityField(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function getEquipmentIdentitySnapshot(equipment: EquipmentIdentityLike): EquipmentIdentitySnapshot {
  return {
    name: normalizeEquipmentIdentityField(equipment.name),
    type: normalizeEquipmentIdentityField(equipment.type),
    manufacturer: normalizeEquipmentIdentityField(equipment.manufacturer),
    model: normalizeEquipmentIdentityField(equipment.model),
    serialNumber: normalizeEquipmentIdentityField(equipment.serialNumber),
    location: normalizeEquipmentIdentityField(equipment.location),
    station: normalizeEquipmentIdentityField(equipment.station),
    ipAddress: normalizeEquipmentIdentityField(equipment.ipAddress),
    snmpCommunity: normalizeEquipmentIdentityField(equipment.snmpCommunity),
    connectionType: normalizeEquipmentIdentityField(equipment.connectionType),
  };
}

export function equipmentIdentityChanged(before: EquipmentIdentityLike, after: EquipmentIdentityLike): boolean {
  return JSON.stringify(getEquipmentIdentitySnapshot(before)) !== JSON.stringify(getEquipmentIdentitySnapshot(after));
}

export function buildEquipmentRepairBroadcastPayload(
  equipment: EquipmentIdentityLike,
  options: {
    previousIdentity?: EquipmentIdentitySnapshot;
    reason?: string;
  } = {}
) {
  return buildRouteBroadcastPayload({
    type: 'EQUIPMENT_REPAIRED',
    payload: {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      previousIdentity: options.previousIdentity ?? null,
      currentIdentity: getEquipmentIdentitySnapshot(equipment),
      reason: options.reason ?? null,
    },
  });
}
