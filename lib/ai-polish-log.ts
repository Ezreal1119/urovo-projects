import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { beijingNowIsoString } from "./time";

const AI_POLISH_LOG_DIR = path.join(process.cwd(), "logs");
const AI_POLISH_LOG_FILE = path.join(AI_POLISH_LOG_DIR, "ai-polish-interactions.jsonl");

type AiPolishLogEntry = {
  project_key: string;
  mode: "batch" | "single-ticket" | "auto-single-ticket";
  ticket_id?: string;
  prompt: string;
  context: unknown;
  raw_response?: string;
  retry_raw_response?: string;
  retry_reason?: string;
  validation: "success" | "error";
  error?: string;
};

export async function appendAiPolishInteraction(entry: AiPolishLogEntry) {
  try {
    await mkdir(AI_POLISH_LOG_DIR, { recursive: true });
    await appendFile(
      AI_POLISH_LOG_FILE,
      `${JSON.stringify({
        timestamp: beijingNowIsoString(),
        ...entry,
      })}\n`,
      "utf8",
    );
  } catch {
    // AI Polish must not fail because diagnostic logging is unavailable.
  }
}
