import type { TodoDetails } from "./types.js";
export declare function execute(params: {
    action: string;
    text?: string;
    id?: number;
}): {
    content: {
        type: "text";
        text: string;
    }[];
    details: TodoDetails;
};
