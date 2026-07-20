// Harici bağımlılık (@types/node) kullanmamak için minimal ambient tanımlar
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

declare module "node:fs/promises" {
  export function writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
  export function mkdir(path: string, options: { recursive: boolean }): Promise<string | undefined>;
}
