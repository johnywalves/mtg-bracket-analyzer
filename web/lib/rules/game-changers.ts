import "server-only";
import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

// Lê direto de backend/mtg_analyzer/rules/commander/*.yaml — fonte única e
// versionada (ver CLAUDE.md da raiz: nunca hard-codear a lista de Game
// Changers). Sempre pega o arquivo de versão mais recente por nome.
const RULES_DIR = path.join(process.cwd(), "..", "backend", "mtg_analyzer", "rules", "commander");

interface RulesFile {
  version: string;
  brackets: Record<string, { name: string }>;
  game_changers: { name: string; oracle_id: string; colors: string[] }[];
  signals: Record<string, { enabled: boolean }>;
}

let cached: RulesFile | null = null;

function loadRules(): RulesFile {
  if (cached) return cached;

  const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".yaml"));
  const latest = files.sort().at(-1);
  if (!latest) {
    throw new Error(`Nenhum arquivo de regras encontrado em ${RULES_DIR}`);
  }
  const raw = fs.readFileSync(path.join(RULES_DIR, latest), "utf-8");
  cached = loadYaml(raw) as RulesFile;
  return cached;
}

export function getGameChangerNames(): string[] {
  return loadRules().game_changers.map((card) => card.name);
}

/** Nome + identidade de cor (WUBRG, ordenado), pra segmentar a listagem por cor. */
export function getGameChangersWithColors(): { name: string; colors: string[] }[] {
  return loadRules().game_changers.map((card) => ({
    name: card.name,
    colors: card.colors,
  }));
}

export function getRulesVersion(): string {
  return loadRules().version;
}

/** Chaves dos sinais além de Game Changers que entram na estimativa de bracket. */
export function getSignalKeys(): string[] {
  return Object.keys(loadRules().signals).filter((key) => loadRules().signals[key]?.enabled);
}
