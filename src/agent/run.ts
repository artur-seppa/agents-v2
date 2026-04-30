import "dotenv/config";
import {generateText, type ModelMessage} from 'ai'
import {openai} from '@ai-sdk/openai'
import {SYSTEM_PROMPT} from './system/prompt'
import type { AgentCallbacks } from "../types";

//import da tools
import { tools } from "./tools/index";
import { executeTools } from "./executeTools";

const MODEL_NAME = "gpt-5-mini";

export const runAgent = async (
  userMessage: string,
  conversationHistory: ModelMessage[],
  callback: AgentCallbacks
) => {
  const {text, toolCalls} = await generateText({
    model: openai(MODEL_NAME),
    prompt: userMessage,
    system: SYSTEM_PROMPT,
    tools, //indica as tools disponiveis para uso
    toolChoice: 'auto' //choice com auto indica que o LLM pode escolher as tools de execucao
  });

  //a partir da pergunta de data, o LLM indica a chamada do tool no toolCalls, mas não efetua sua execucao
  console.log(text, toolCalls)

  // Agora sim, efetuamos a execucao da tool, a partir da chamada com executeTools, com o nome da tool e input
  toolCalls.forEach(async (tc) => {
    console.log(await executeTools(tc.toolName, tc.input))
  });
}

runAgent("what time and date is right now?");