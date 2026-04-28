import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/gi,
  /disregard (all )?(previous|prior|above) instructions/gi,
  /system prompt/gi,
  /developer message/gi,
  /you are now/gi,
  /reveal (the )?(secret|api key|token|credentials)/gi,
];

const SECRET_PATTERNS = [
  /API_KEY=\S+/g,
  /GEMINI_API_KEY=\S+/g,
  /ANTHROPIC_API_KEY=\S+/g,
  /OPENAI_API_KEY=\S+/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
];

export function registerContextShield(pi: ExtensionAPI) {
  pi.on("context", async (event, _ctx) => {
    const messages = event.messages
      .filter((message: any) => !(message.role === "custom" && message.customType === "debug-only"))
      .map((message: any) => sanitizeMessage(message));

    return { messages };
  });

  pi.on("tool_result", async (event, _ctx) => {
    const content = event.content.map((chunk: any) => {
      if (chunk?.type !== "text" || typeof chunk.text !== "string") return chunk;
      return { ...chunk, text: sanitizeText(chunk.text) };
    });
    return { content };
  });
}

function sanitizeMessage(message: any): any {
  const cloned = clone(message);
  if (typeof cloned.content === "string") {
    cloned.content = sanitizeText(cloned.content);
    return cloned;
  }
  if (Array.isArray(cloned.content)) {
    cloned.content = cloned.content.map((chunk: any) => {
      if (chunk?.type !== "text" || typeof chunk.text !== "string") return chunk;
      return { ...chunk, text: sanitizeText(chunk.text) };
    });
  }
  return cloned;
}

function sanitizeText(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED_SECRET]");
  }
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, "[FILTERED_INSTRUCTION]");
  }
  return result;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
