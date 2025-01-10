import { DBProxy } from "./types";

export default class NoOpDB implements DBProxy {

    recordAction() {}

    recordState() {}

}
