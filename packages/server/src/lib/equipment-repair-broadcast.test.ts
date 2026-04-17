import { describe, expect, it } from 'vitest';
import {
  buildEquipmentRepairBroadcastPayload,
  equipmentIdentityChanged,
  getEquipmentIdentitySnapshot,
} from './equipment-repair-broadcast.js';

describe('equipment identity repair helpers', () => {
  it('detects when the equipment identity changes', () => {
    const before = {
      id: 'eq-1',
      name: 'Flatbed Computer',
      type: 'Workstation',
      manufacturer: 'Dell',
      model: 'OptiPlex',
      serialNumber: 'ABC123',
      location: 'Shop Floor',
      station: 'FLATBED',
      ipAddress: '192.168.1.10',
      snmpCommunity: 'public',
      connectionType: 'PING',
    };

    const after = {
      ...before,
      ipAddress: '192.168.1.11',
    };

    expect(equipmentIdentityChanged(before, after)).toBe(true);
    expect(equipmentIdentityChanged(before, { ...before, notes: 'ignored' } as any)).toBe(false);
  });

  it('builds a repair broadcast payload with the normalized identity snapshot', () => {
    const payload = buildEquipmentRepairBroadcastPayload(
      {
        id: 'eq-1',
        name: 'Flatbed Computer',
        type: 'Workstation',
        manufacturer: 'Dell',
        model: 'OptiPlex',
        serialNumber: 'ABC123',
        location: 'Shop Floor',
        station: 'FLATBED',
        ipAddress: '192.168.1.10',
        snmpCommunity: 'public',
        connectionType: 'PING',
      },
      {
        previousIdentity: {
          name: 'flatbed computer',
          type: 'workstation',
          manufacturer: 'dell',
          model: 'optiplex',
          serialNumber: 'abc123',
          location: 'shop floor',
          station: 'flatbed',
          ipAddress: '192.168.1.9',
          snmpCommunity: 'public',
          connectionType: 'ping',
        },
        reason: 'network identity changed',
      }
    );

    expect(payload.type).toBe('EQUIPMENT_REPAIRED');
    expect(payload.payload).toEqual({
      equipmentId: 'eq-1',
      equipmentName: 'Flatbed Computer',
      previousIdentity: {
        name: 'flatbed computer',
        type: 'workstation',
        manufacturer: 'dell',
        model: 'optiplex',
        serialNumber: 'abc123',
        location: 'shop floor',
        station: 'flatbed',
        ipAddress: '192.168.1.9',
        snmpCommunity: 'public',
        connectionType: 'ping',
      },
      currentIdentity: getEquipmentIdentitySnapshot({
        id: 'eq-1',
        name: 'Flatbed Computer',
        type: 'Workstation',
        manufacturer: 'Dell',
        model: 'OptiPlex',
        serialNumber: 'ABC123',
        location: 'Shop Floor',
        station: 'FLATBED',
        ipAddress: '192.168.1.10',
        snmpCommunity: 'public',
        connectionType: 'PING',
      }),
      reason: 'network identity changed',
    });
  });
});
