import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const FILES = ["profile.json", "backlog.json", "moodlog.json", "exams.json"];

/**
 * JSON files on disk, written atomically. Personal data lives here, so nothing
 * under data/ is ever committed to git.
 */
export function createStore({ dataDir, exampleDir }) {
  const daysDir = join(dataDir, "days");

  async function seed() {
    await mkdir(dataDir, { recursive: true });
    await mkdir(daysDir, { recursive: true });
    for (const file of FILES) {
      try {
        await readFile(join(dataDir, file));
      } catch {
        try {
          await copyFile(join(exampleDir, file), join(dataDir, file));
        } catch {
          await writeFile(join(dataDir, file), "{}\n");
        }
      }
    }
  }

  async function writeAtomic(path, text) {
    const tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, path);
  }

  async function read(file) {
    const path = join(dataDir, file);
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        await seed();
        try {
          return JSON.parse(await readFile(path, "utf8"));
        } catch {
          return defaultFor(file);
        }
      }
      // Corrupt file: keep it, start a clean one, carry on.
      try {
        await rename(path, `${path}.bak`);
      } catch {
        /* the backup rename is best effort */
      }
      const fallback = defaultFor(file);
      await writeAtomic(path, JSON.stringify(fallback, null, 2));
      return fallback;
    }
  }

  async function write(file, data) {
    await writeAtomic(join(dataDir, file), JSON.stringify(data, null, 2));
    return data;
  }

  async function readDay(date) {
    try {
      return JSON.parse(await readFile(join(daysDir, `${date}.json`), "utf8"));
    } catch {
      return null;
    }
  }

  async function writeDay(date, plan) {
    await writeAtomic(join(daysDir, `${date}.json`), plan);
    return plan;
  }

  return { seed, read, write, readDay, writeDay, dataDir, daysDir };
}

function defaultFor(file) {
  switch (file) {
    case "backlog.json":
      return { items: [] };
    case "moodlog.json":
      return { days: [] };
    case "exams.json":
      return { exams: [] };
    default:
      return { name: "", createdAt: "" };
  }
}
