import { DBProxy } from "./types";
// import { appendFile, readFile } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

interface DBAction {
    timestamp: number,
    data: object
}

interface DBFile {
    id: string,
    actions: DBAction[],
}

export default class LocalDB implements DBProxy {

    recordAction(id: string, action: object): void {
        const filePath = `./static/local-db-items/${id}.json`;
        let file:DBFile = {
            id: id,
            actions: [],
        };
        try {
            if (existsSync(filePath)) {
                file = JSON.parse(readFileSync(filePath, { encoding: "utf8"}).toString());
            }

            const actionRecord:DBAction = {
                timestamp: new Date().getTime(),
                data: action,
            }
            file.actions = [...file.actions, actionRecord];

            writeFileSync(filePath, JSON.stringify(file, null, 2));
        } catch (error) {
            console.error("Failure to write to local DB", error);
        }
    }

}
