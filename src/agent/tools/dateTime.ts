import { tool } from "ai";
import { z } from "zod";

/*
    A tool tem 3 parametros de entrada:
    - description: indica a funcionalidade dessa ferramenta
    - inputSchema: indica o schema de input da tool, nesse caso nao tem schema
    - execute: indica o que de fato a tool vai fazer, entao nesse caso vai retornar o datetime do momento da execucao
*/
export const dateTime = tool({
    description:
        "returns the current time and date. Use this tool before any time related task",
    inputSchema: z.object({}),
    execute: async () => {
        return new Date().toISOString();
    }
})