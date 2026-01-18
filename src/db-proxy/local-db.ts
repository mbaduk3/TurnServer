import { DBProxy } from "./types";
// import { appendFile, readFile } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import logger from "../logger.ts";

interface DBAction {
    timestamp: number,
    actor: string,
    data: object
}

interface DBState {
    timestamp: number,
    state: object,
}

interface DBFile {
    id: string,
    actions: DBAction[],
    states: DBState[],
}

export default class LocalDB implements DBProxy {

    recordAction(id: string, actor: string, action: object): void {
        const filePath = `./static/local-db-items/${id}.json`;
        let file:DBFile = {
            id: id,
            actions: [],
            states: [],
        };
        try {
            if (existsSync(filePath)) {
                file = JSON.parse(readFileSync(filePath, { encoding: "utf8"}).toString());
            }

            const actionRecord:DBAction = {
                timestamp: new Date().getTime(),
                actor: actor,
                data: action,
            }
            file.actions = [...file.actions, actionRecord];

            writeFileSync(filePath, JSON.stringify(file, null, 2));
        } catch (error) {
            console.error("Failure to write to local DB", error);
        }
    }

    recordState(id: string, state: object): void {
        const filePath = `./static/local-db-items/${id}.json`;
        let file:DBFile = {
            id: id,
            actions: [],
            states: [],
        };
        try {
            if (existsSync(filePath)) {
                file = JSON.parse(readFileSync(filePath, { encoding: "utf8"}).toString());
            }

            const stateRecord:DBState = {
                timestamp: new Date().getTime(),
                state: state, 
            }
            file.states = [...file.states, stateRecord];

            writeFileSync(filePath, JSON.stringify(file, null, 2));
        } catch (error) {
            logger.error("Failure to write to local DB", error);
        }
    }

}
