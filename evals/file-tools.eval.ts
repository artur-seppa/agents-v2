import { evaluate } from "@lmnr-ai/lmnr";
import {toolSelectionScore} from "./evaluators"

import type { EvalData, EvalTarget } from "./types";
import dataset from "./data/file-tools.json" with {type: "json"}
import { singleTurnExecutor } from "./executors";

const executor = async (data: EvalData) => {
    return singleTurnExecutor(data);
}

/*
   Com o laminar (telemetry) efetuamos o uso da telemetria com o evaluate, 
   passando o dataset (casos de testes com prompts e tools), o executor da chamada 
   do agente/LLM que retorna os numeros de tools, quais foram selecionados e resposta;
   por fim, temos o evaluators com o a trasformação de metrica quantitativa, vendo o 
   valor obtido pelo agente e os que deveriam ter sidos selecionados, voltando um score de pontos
*/
evaluate({
    data: dataset as any,
    executor,
    evaluators: {
        selectionScore: (output: any, target: any) => {
            // Nao queremos avaliar testes de categoria secondaria, retornando 1
            if(target?.category === "secondary") return 1;
            
            //retorna o score de pontos pelo output de tools usadas e o target (o que deveria ter sido usado)
            return toolSelectionScore(output, target)
        }
    },
    
    // agrupamento de teste, que permite comparacao futura posteriormente
    groupName: "file-tools-selection"
})