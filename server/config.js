import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: join(rootDir, ".env") });

function readConfig() {
  const raw = JSON.parse(readFileSync(join(rootDir, "config.json"), "utf8"));
  return {
    rootDir,
    publicDir: join(rootDir, "public"),
    dataDir: join(rootDir, "data"),
    port: Number(process.env.PORT) || raw.port || 4747,
    debug: process.env.KAIROS_DEBUG === "1" ? true : raw.debug === true,
    name: raw.name || "Blaze",
    plan: raw.plan || { backlogPerDay: 3, staples: ["Revise today's live class"] },
    voice: raw.voice || { language: "en-IN", voiceName: null },
    providers: raw.providers || { modelOverride: {} },
    keys: {
      groq: process.env.GROQ_API_KEY || "",
      nvidia: process.env.NVIDIA_API_KEY || "",
      mistral: process.env.MISTRAL_API_KEY || "",
      openrouter: process.env.OPENROUTER_API_KEY || "",
    },
  };
}

export const config = readConfig();
