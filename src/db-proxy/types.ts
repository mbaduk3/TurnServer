export interface DBProxy {
    recordAction(id: string, actor: string, action: object): void;
    recordState(id: string, state: object): void;
}