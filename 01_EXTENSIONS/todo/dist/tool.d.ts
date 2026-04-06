export declare const todoTool: {
    name: string;
    label: string;
    description: string;
    parameters: import("@sinclair/typebox").TObject<{
        action: import("@sinclair/typebox").TUnsafe<"list" | "add" | "toggle" | "clear">;
        text: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        id: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>;
    execute: (_toolCallId: string, params: {
        action: string;
        text?: string;
        id?: number;
    }) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: import("./types.js").TodoDetails;
    }>;
};
