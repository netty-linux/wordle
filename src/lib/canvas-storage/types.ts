export interface CanvasStorage {
  get(id: string): Promise<Buffer | null>;
  set(id: string, data: Buffer): Promise<void>;
  readonly mode: 'sqlite' | 'blob' | 'memory';
}
