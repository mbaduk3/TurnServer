export interface DBProxy {
    recordAction(id: string, action: object): void;
}