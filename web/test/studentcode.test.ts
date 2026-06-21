import axios from "axios";
import { describe, it, expect } from "vitest";

// note: this assumes both backend server and judge0 is already running and reachable
describe("Student Code", () => {
    it("should execute student code", async () => {
        const response = await axios.post(`${process.env.VITE_BACKEND_URL}/execute`, {
            code: "print('Hello, World!')"
        });
        expect(response.data).toEqual(expect.objectContaining({
            stdout: "Hello, World!\n",
            stderr: null,
            status: expect.objectContaining({
                id: 3,
                description: "Accepted"
            })
        }));
    });
});