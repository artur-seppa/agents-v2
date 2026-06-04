import { evaluate } from "@lmnr-ai/lmnr";
import { toolOrderCorrect, toolsAvoided, llmJudge } from "./evaluators";

import type {
    MultiTurnEvalData,
    MultiTurnDatasetEntry,
    MultiTurnResult,
    MultiTurnTarget
} from "./types"

import dataset from './data/agent-multiturn.json' with {type: "json"};

import { multiTurnWithMocks } from "./executors";

const executor = async (data: MultiTurnEvalData) => {
    return multiTurnWithMocks(data);
}

/* 
    Efetuamos o evaluate usando o llaminar junto com seu dashboard de exibição.
    Chamamos a execução do testes com os cenarios com o executor e efetuamos a 
    avaliação do output e target com o llmJudge
*/
evaluate({
    data: dataset as any,
    executor, 
    evaluators: {
        outputQuality: async (output: any, target: any) => {
            if(!target) return 1;
            return llmJudge(output, target);
        },
    },
    config: {
        projectApiKey: process.env.LMR_API_KEY,
    },
    groupName: "agent-multiturn"
})