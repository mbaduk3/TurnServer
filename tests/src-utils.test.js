import { genKey } from "../src/utils";

describe("test utils", () => {

    test("test genKey", async () => {
        const key = genKey(5);

        expect(key.length === 5).toBeTruthy();
    });

});