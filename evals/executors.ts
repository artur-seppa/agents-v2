import { generateText, getToolName, stepCountIs, tool, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod"

import type {
  EvalData,
  SingleTurnResult,
  MultiTurnEvalData,
  MultiTurnResult,
} from "./types.ts";
import { buildMessages } from "./utils.ts";

// Mocks de chamadas de tools, com a description e parametros de entrada utilizados na chamada do tool
// zod valida o tipo da entrada da chamada do tool
const TOOL_DEFINITIONS: any = {
  readFile: {
    description: "Read the content a file at the specified path",
    parameters: z.object({
      path: z.string().describe("the path to the file that you want to read")
    })
  },
  writeFile: {
    description: "Write given content to the file at the given path",
    parameters: z.object({
      path: z.string().describe("the path to the file that you want write to"),
      content: z.string().describe("the content you want to write to the file")
    })
  },
  listFiles: {
    description: "List the all the files in directory",
    parameters: z.object({
      path: z.string().describe("the path to the directory in wich you want to list the files")
    })
  },
  deleteFile: {
    description: "Delete a file at the given path",
    parameters: z.object({
      path: z.string().describe("the path to the file that you want to delete")
    })
  },
  runCommand: {
    description: "Execute a shell command and return its output",
    parameters: z.object({
      path: z.string().describe("the shell command to execute")
    })
  }
}

// Executor de uma unica instancia, chamado apenas uma unica vez
export const singleTurnExecutor = async (data: EvalData) => {

  //retorna o prompt com o indentificador (user ou assistent)
  const messages = buildMessages(data);

  /*
    Se um tool name escolhido pelo agent (data) for similar ao nosso mock,
    entao verifica o description e inputSchema
  */
  const tools: ToolSet = {};
  for (const toolName of data.tools) {
    const def = TOOL_DEFINITIONS[toolName]

    if(def){
      tools[toolName] = tool({
        description: def.description,
        inputSchema: def.parameters
      })
    }
  }

  // efetua a chamada do agent (LLM) com os tools e prompt escolhido. Sendo chamado apenas uma unica vez o agente com o stepCountIs(1)
  const {toolCalls} = await generateText({
    model: openai(data.config?.model ?? "gpt-5-mini"),
    messages,
    tools,
    stopWhen: stepCountIs(1),
    temperature: data.config?.temperature ?? undefined,
  });

  // armazena os nomes das tools executadas com a chamada do agent
  const toolNames = toolCalls.map(tc => tc.toolName)

  return {
    toolCalls,
    toolNames,
    selectedAny: toolNames.length > 0
  }
}
