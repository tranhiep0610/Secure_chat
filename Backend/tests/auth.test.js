const request = require("supertest");

jest.mock("../models/User", () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn()
}));

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const app = require("../server");

describe("Auth API", () => {
    let agent;

    const user = {
        _id: "507f1f77bcf86cd799439011",
        username: "cong",
        email: "cong@example.com",
        passwordHash: "hashed-password",
        role: "user"
    };

    beforeEach(() => {
        agent = request.agent(app);
        jest.clearAllMocks();
    });

    test("Chưa đăng nhập không được xem /me", async () => {
        const res = await agent.get("/api/auth/me");

        expect(res.statusCode).toBe(401);
    });

    test("Chưa đăng nhập không được xem danh sách user", async () => {
        const res = await agent.get("/api/users");

        expect(res.statusCode).toBe(401);
    });

    test("Đăng ký thành công với username/email được chuẩn hóa", async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({
            ...user,
            username: "cong",
            email: "cong@example.com"
        });

        const res = await agent.post("/api/auth/register").send({
            username: "  Cong  ",
            email: "  CONG@EXAMPLE.COM  ",
            password: "123456"
        });

        expect(res.statusCode).toBe(201);
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            username: "cong",
            email: "cong@example.com"
        }));
    });

    test("Đăng nhập đúng username và password", async () => {
        User.findOne.mockResolvedValue(user);
        jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

        const res = await agent.post("/api/auth/login").send({
            username: "  CONG  ",
            password: "123456"
        });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe("Đăng nhập thành công");
        expect(User.findOne).toHaveBeenCalledWith({ username: "cong" });
    });

    test("Đăng nhập sai password bị từ chối", async () => {
        User.findOne.mockResolvedValue(user);
        jest.spyOn(bcrypt, "compare").mockResolvedValue(false);

        const res = await agent.post("/api/auth/login").send({
            username: "cong",
            password: "wrongpass"
        });

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe("Username hoặc password không đúng");
    });

    test("Logout yêu cầu đăng nhập", async () => {
        const res = await agent.post("/api/auth/logout");

        expect(res.statusCode).toBe(401);
    });

    test("Đăng nhập rồi logout thành công", async () => {
        User.findOne.mockResolvedValue(user);
        jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

        const loginRes = await agent.post("/api/auth/login").send({
            username: "cong",
            password: "123456"
        });
        expect(loginRes.statusCode).toBe(200);

        const logoutRes = await agent.post("/api/auth/logout");
        expect(logoutRes.statusCode).toBe(200);
        expect(logoutRes.body.message).toBe("Đăng xuất thành công");

        const meRes = await agent.get("/api/auth/me");
        expect(meRes.statusCode).toBe(401);
    });
});
