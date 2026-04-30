import { tools } from "./tools/index";
export type ToolName = keyof typeof tools;

export const executeTools = async (name: string, args: any) => {
    // obtemos as tools disponiveis no diretorio tools
    const tool = tools[name as ToolName];

    if(!tool) {
        return "Unknow tool";
    }

    const execute = tool.execute;

    if(!execute){
        return "This tool doesn't have execution"
    }

    // efetua a execucao da tool
    const result = await execute(args, {
        toolCallId: "",
        messages: []
    })

    return String(result)
}