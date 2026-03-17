declare module 'net-snmp' {
  export const Version1: number;
  export const Version2c: number;
  export const Version3: number;

  export interface SessionOptions {
    port?: number;
    retries?: number;
    timeout?: number;
    backoff?: number;
    transport?: string;
    trapPort?: number;
    version?: number;
    backwardsGetNexts?: boolean;
    idBitsSize?: number;
    context?: string;
  }

  export interface VarBind {
    oid: string;
    type: number;
    value: any;
  }

  export interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: VarBind[]) => void): void;
    getNext(oids: string[], callback: (error: Error | null, varbinds: VarBind[]) => void): void;
    getBulk(oids: string[], nonRepeaters: number, maxRepetitions: number, callback: (error: Error | null, varbinds: VarBind[][]) => void): void;
    set(varbinds: VarBind[], callback: (error: Error | null, varbinds: VarBind[]) => void): void;
    subtree(oid: string, maxRepetitions: number, feedCallback: (varbinds: VarBind[]) => void, doneCallback: (error?: Error) => void): void;
    table(oid: string, maxRepetitions: number, callback: (error: Error | null, table: any) => void): void;
    tableColumns(oid: string, columns: number[], maxRepetitions: number, callback: (error: Error | null, table: any) => void): void;
    walk(oid: string, maxRepetitions: number, feedCallback: (varbinds: VarBind[]) => void, doneCallback: (error?: Error) => void): void;
    close(): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  export function createSession(target: string, community: string, options?: SessionOptions): Session;
  export function isVarbindError(varbind: VarBind): boolean;
  export function varbindError(varbind: VarBind): string;

  export const ObjectType: {
    Boolean: number;
    Integer: number;
    OctetString: number;
    Null: number;
    OID: number;
    IpAddress: number;
    Counter: number;
    Gauge: number;
    TimeTicks: number;
    Opaque: number;
    Integer32: number;
    Counter32: number;
    Gauge32: number;
    Unsigned32: number;
    Counter64: number;
    NoSuchObject: number;
    NoSuchInstance: number;
    EndOfMibView: number;
  };
}
