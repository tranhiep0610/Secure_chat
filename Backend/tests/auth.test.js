const request = require("supertest");

const app = require("../server");

describe("Auth API", () => {
    let agent;

    beforeEach(() => {
        agent = request.agent(app);
    });

    test("Chưa đăng nhập không được xem /me", async () => {
        const res = await agent
            .get("/api/auth/me");

        expect(res.statusCode).toBe(401);
    });

    test("Chưa đăng nhập không được xem danh sách user", async () => {
        const res = await agent
            .get("/api/users");

        expect(res.statusCode).toBe(401);
    });
});