import { generateText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTracer, Laminar } from "@lmnr-ai/lmnr"

import { tools } from "./tools/index.ts";
import { SYSTEM_PROMPT } from "./system/prompt.ts";

import type { AgentCallbacks } from "../types.ts";

const MODEL_NAME = "gpt-5-mini";

// Inicializa a ferramenta e passa o secret do project
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY
})

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
): Promise<any> {
  // Filter and check if we need to compact the conversation history before starting
  const { text } = await generateText({
    model: openai(MODEL_NAME),
    prompt: userMessage,
    system: SYSTEM_PROMPT,
    tools,
    // Habilita para as chamadas desse agent a verificao da sua telemetria
    experimental_telemetry: {
      isEnabled: true,
      tracer: getTracer()
    }
  });

  // Demanda o envio dos dados de telemtria para o dashboard do laminar
  await Laminar.flush();

  console.log(text);
}
