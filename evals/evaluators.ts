import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import type {
  EvalTarget,
  SingleTurnResult,
  MultiTurnTarget,
  MultiTurnResult,
} from "./types.ts";

/*
  Obtemos o score de 1-10 (o LLM não trabalha bem com ponto flutuante) e temos o reason
  para justificativa do score e isso faz o LLM pensar melhor na resposta
*/
const judgeSchema = z.object({
  score: z.number().min(1).max(10).describe('Score from 1-10 where 10 is perfect'),
  reason: z.string().describe('Brief explanation for the score')
})

export const llmJudge = async(output: MultiTurnResult, target: MultiTurnTarget) => {
  /* generateObject faz com que o LLM retorna um object json com o schema que voce deseja, 
    entao usamos o judgeSchema pro retorno.
    schemaDescription: descreve o que o schema retornado representa
    O messages: permite alocar o contexto, nesse caso alocamos o contexto de avaliação de judge do nosso LLM,
    além dos dados de usuario, como o texto apresentado e o output obtido, com a resposta em texto e chamadas de tools
  */
  const result = await generateObject({
    model: openai("gpt-5.1"),
    schema: judgeSchema,
    schemaName: "evaluation",
    providerOptions: {
      openai: {
        reasoningEffort: "high", //indica que o esforço deve ser alto
      },
    },
    schemaDescription: "Evaluation of an Ai agent response",
    messages: [
      {role: 'system', content: `You are an evaluation judge. Score the agent's response on a scale of 1-10.
        
        Scoring criteria:
        - 10: response fully addresses the task using tool results correctly
        - 7-9: response is mostly correct with minor issues
        - 4-6: response partially addresses the task
        - 1-3: response is mostly incorrect or irrelevant`},
        {
          role: 'user',
          content: `Task: ${target.originalTask}
          
          Tools Called: ${JSON.stringify(output.toolCallOrder)}
          Tool Results provided: ${JSON.stringify(target.mockToolResults)}
          
          Agent's final answer:
          ${output.text}
          
          Evaluate if this response corectly uses the tool results to answer the task`
        }
    ]
  });

  return result.object.score / 10;
}

export function toolsSelected(
  output: SingleTurnResult | MultiTurnResult,
  target: EvalTarget | MultiTurnTarget,
): number {
  const expectedTools =
    "expectedTools" in target
      ? target.expectedTools
      : "expectedToolOrder" in target
        ? target.expectedToolOrder
        : undefined;

  if (!expectedTools?.length) return 1;

  const selected = new Set(
    "toolNames" in output ? output.toolNames : output.toolsUsed,
  );

  return expectedTools.every((t) => selected.has(t)) ? 1 : 0;
}

/**
 * Evaluator: Check if forbidden tools were avoided.
 * Returns 1 if NONE of the forbidden tools are in the output, 0 otherwise.
 * For negative prompts.
 */
export function toolsAvoided(
  output: SingleTurnResult | MultiTurnResult,
  target: EvalTarget | MultiTurnTarget,
): number {
  if (!target.forbiddenTools?.length) return 1;

  const selected = new Set(
    "toolNames" in output ? output.toolNames : output.toolsUsed,
  );

  return target.forbiddenTools.some((t) => selected.has(t)) ? 0 : 1;
}

/**
 * Evaluator: Precision/recall score for tool selection.
 * Returns a score between 0 and 1 based on correct selections.
 * For secondary prompts.
 */
export function toolSelectionScore(
  output: SingleTurnResult,
  target: EvalTarget,
): number {
  if (!target.expectedTools?.length) {
    return output.selectedAny ? 0.5 : 1;
  }

  const expected = new Set(target.expectedTools);
  const selected = new Set(output.toolNames);

  const hits = output.toolNames.filter((t) => expected.has(t)).length;
  const precision = selected.size > 0 ? hits / selected.size : 0;
  const recall = expected.size > 0 ? hits / expected.size : 0;

  // Simple F1-ish score
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Evaluator: Check if tools were called in the expected order.
 * Returns the fraction of expected tools found in sequence.
 * Order matters but tools don't need to be consecutive.
 */
export function toolOrderCorrect(
  output: MultiTurnResult,
  target: MultiTurnTarget,
): number {
  if (!target.expectedToolOrder?.length) return 1;

  const actualOrder = output.toolCallOrder;

  // Check if expected tools appear in order (not necessarily consecutive)
  let expectedIdx = 0;
  for (const toolName of actualOrder) {
    if (toolName === target.expectedToolOrder[expectedIdx]) {
      expectedIdx++;
      if (expectedIdx === target.expectedToolOrder.length) break;
    }
  }

  return expectedIdx / target.expectedToolOrder.length;
}
