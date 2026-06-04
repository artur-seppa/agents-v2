import { streamText, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getTracer } from "@lmnr-ai/lmnr";
import { tools } from "./tools/index.ts";
import { executeTool } from "./executeTool.ts";
import { SYSTEM_PROMPT } from "./system/prompt.ts";
import { Laminar } from "@lmnr-ai/lmnr";
import type { AgentCallbacks, ToolCallInfo } from "../types.ts";

import { filterCompatibleMessages } from "./system/filterMessages.ts";

Laminar.initialize({
  projectApiKey: process.env.LMNR_API_KEY,
});

const MODEL_NAME = "gpt-5-mini";

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
): Promise<ModelMessage[]> {
  const workingHistory = filterCompatibleMessages(conversationHistory);

  /* 
    System role: indica o contexto/comportamento prioritario antes da execução do LLM (ex: llm você é um expert em culinaria italiana ...)
    workingHistory: indica os contextos passados, isto é, o chat anterior com os seus resultados atrelados de LLM ou tool
    userMessage: indica a mensagem mandada agora na UI
  */
  const messages: ModelMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...workingHistory,
    { role: "user", content: userMessage }
  ];

  let fullResponse = "";

  while (true) {
    //como um promisse que faz multiplas chamadas concorrentes, efetua um chunk de processamento de IA
    const result = streamText({
      model: openai(MODEL_NAME),
      messages,
      tools,
      // Alocamos a telemetria para obter dados de chamada do streamText
      experimental_telemetry: {
        isEnabled: true,
        tracer: getTracer(),
      }
    })

    const toolCalls: ToolCallInfo[] = []
    let currentText = "";
    let streamError: Error | null = null;

    try {
      // chunks representam parte do resultado do streamText, como se fosse as multiplas chamadas do promisse
      for await (const chunk of result.fullStream) {
        /*
          Aqui token por token (palavra por palavra) respondida pelo LLM, é exibida para o usuário, como
          se estivesse sendo escrito um texto na nossa tela. 
        */
        if (chunk.type === 'text-delta') {
          //Obtem o token respondido pelo LLM
          currentText += chunk.text

          //aqui retornamos a mensagem obtida pela LLM
          callbacks.onToken(chunk.text)
        }


        /*
          Aqui lidamos com chamadas de ferramenta externa (tool call)
          1) armazenamos no nosso array de toolCalls a chamada da tool feita, para telemetria
          2) Com o 'onToolCallStart' podemos exibir a chamada do tool para o usuario, com um spinner
          carregando o tool
        */
        if (chunk.type === 'tool-call') {
          const input = 'input' in chunk ? chunk.input : {};
          toolCalls.push({
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: input as any
          });

          callbacks.onToolCallStart(chunk.toolName, input);
        }
      }
    } catch (e) {
      streamError = e as Error;

      //Sem retorno de mensagem no while, geramos o throw do error;
      if (!currentText && !streamError.message.includes("No output generated")) {
        throw streamError;
      }
    }

    fullResponse += currentText;

    // Apos lancado o throw e nao ter currentText de retorno para o usuario, exibir o fullResponse
    if (streamError && !currentText) {
      fullResponse = 'Sorry about that.'
      callbacks.onToken(fullResponse);
      break;
    }

    const finishReason = await result.finishReason;

    /*
      Valida se a razao de encerramento nao eh um toolCall, 
      entao obtem a resposta do LLM e aloca no messages array e sai do loop
    */
    if (finishReason !== 'tool-calls' || toolCalls.length === 0) {
      const responseMessages = await result.response;
      messages.push(...responseMessages.messages);
      break;
    }

    const responseMessages = await result.response;
    messages.push(...responseMessages.messages);

    /*
      Lida com as chamadas de tools
    */
    for (const tc of toolCalls) {
      //Para cada chamada de tool, executamos a ferramenta correspondente com os args necessarios
      const result = await executeTool(tc.toolName, tc.args);

      /*
        Finalizamos a chamada da tool, alocando o resultado na tela de usuario, como log.
      */
      callbacks.onToolCallEnd(tc.toolName, result);

      // Armazena no message a resposta do tool para alimentar o contexto do while e generate text, com
      // as informações trazidas pelo tool, e assim o LLM tomar uma decisao com o resultado
      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            output: { type: "text", value: "result" }
          }
        ]
      })
    }
  }

  /*
    Retorna com o callback a resposta obtida pela IA, com o parecer final.
    O messages funciona como um corpo de texto completo com todas as informações (toolcalls e contextos)
  */
  callbacks.onComplete(fullResponse);
  return messages;
}
