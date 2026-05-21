import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_ENV_FILES = [".env.local", ".env"];
let localEnvCache: Record<string, string> | undefined;

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (!key) continue;

    const quote = value[0];
    if (
      (quote === "'" || quote === '"') &&
      value.endsWith(quote)
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function readLocalEnv(): Record<string, string> {
  if (localEnvCache) return localEnvCache;

  localEnvCache = {};
  for (const file of LOCAL_ENV_FILES) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    Object.assign(localEnvCache, parseEnvFile(readFileSync(path, "utf8")));
  }

  return localEnvCache;
}

export function getServerEnv(name: string): string | undefined {
  return process.env[name] ?? readLocalEnv()[name];
}
