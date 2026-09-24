const express = require("express");
const session = require("express-session");
const request = require("supertest");

jest.mock("argon2", () => ({
    argon2id: 2,
    hash: jest.fn(),
    verify: jest.fn()
}));

jest.mock("../models/User", () => ({
    exists: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn()
}));

const argon2 = require("argon2");
const User = require("../models/User");
const authRoutes = require("../routes/auth.routes");
const userRoutes = require("../routes/user.routes");

const makeSelectQuery = (value) => ({
    select: jest.fn().mockResolvedValue(value)
});

const makeUsersQuery = (value) => {
    const chain = {
        select: jest.fn(),
        sort: jest.fn(),
        limit: jest.fn(),
        lean: jest.fn().mockResolvedValue(value)
    };
    chain.select.mockReturnValue(chain);
    chain.sort.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    return chain;
};

const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use(session({
        name: "secure_chat.sid",
        secret: "test-only-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 60 * 60 * 1000
        }
    }));
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    return app;
};

describe("Account/Auth API", () => {
    let app;
    let agent;

    const user = {
        _id: {
            toString: () => "507f1f77bcf86cd799439011"
        },
        username: "Cong",
        usernameNormalized: "cong",
        displayName: "Công",
        passwordHash: "argon2-hash",
        createdAt: new Date("2026-09-23T00:00:00.000Z")
    };

    beforeEach(() => {
        app = createTestApp();
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

    test("Đăng ký thành công theo schema username/displayName/password", async () => {
        User.exists.mockResolvedValue(null);
        argon2.hash.mockResolvedValue("argon2-hash");
        User.create.mockResolvedValue(user);

        const res = await agent.post("/api/auth/register").send({
            username: "Cong",
            displayName: "Công",
            password: "12345678"
        });

        expect(res.statusCode).toBe(201);
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            username: "Cong",
            usernameNormalized: "cong",
            displayName: "Công",
            passwordHash: "argon2-hash"
        }));
        expect(res.body.user.passwordHash).toBeUndefined();
        expect(res.body.user.usernameNormalized).toBeUndefined();
    });

    test("Username trùng bị từ chối 409", async () => {
        User.exists.mockResolvedValue({ _id: "exists" });

        const res = await agent.post("/api/auth/register").send({
            username: "Cong",
            displayName: "Công",
            password: "12345678"
        });

        expect(res.statusCode).toBe(409);
        expect(argon2.hash).not.toHaveBeenCalled();
    });

    test("Username không hợp lệ bị từ chối 400", async () => {
        const res = await agent.post("/api/auth/register").send({
            username: "co ng",
            displayName: "Công",
            password: "12345678"
        });

        expect(res.statusCode).toBe(400);
    });

    test("Đăng nhập đúng tạo session", async () => {
        User.findOne.mockReturnValue(makeSelectQuery(user));
        argon2.verify.mockResolvedValue(true);

        const res = await agent.post("/api/auth/login").send({
            username: "CONG",
            password: "12345678"
        });

        expect(res.statusCode).toBe(200);
        expect(User.findOne).toHaveBeenCalledWith({ usernameNormalized: "cong" });
        expect(res.body.user.passwordHash).toBeUndefined();
    });

    test("Sai mật khẩu bị từ chối 401", async () => {
        User.findOne.mockReturnValue(makeSelectQuery(user));
        argon2.verify.mockResolvedValue(false);

        const res = await agent.post("/api/auth/login").send({
            username: "cong",
            password: "wrong-password"
        });

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe("Username hoặc password không đúng");
    });

    test("Đăng nhập rồi GET /me trả user công khai", async () => {
        User.findOne.mockReturnValue(makeSelectQuery(user));
        argon2.verify.mockResolvedValue(true);
        await agent.post("/api/auth/login").send({
            username: "cong",
            password: "12345678"
        });

        User.findById.mockReturnValue(makeSelectQuery(user));
        const res = await agent.get("/api/auth/me");

        expect(res.statusCode).toBe(200);
        expect(res.body.user.username).toBe("Cong");
        expect(res.body.user.displayName).toBe("Công");
        expect(res.body.user.passwordHash).toBeUndefined();
    });

    test("Đăng nhập rồi lấy danh sách user, không trả passwordHash", async () => {
        User.findOne.mockReturnValue(makeSelectQuery(user));
        argon2.verify.mockResolvedValue(true);
        await agent.post("/api/auth/login").send({
            username: "cong",
            password: "12345678"
        });

        const peer = {
            _id: { toString: () => "507f1f77bcf86cd799439099" },
            username: "Hai",
            displayName: "Hải",
            passwordHash: "must-not-leak",
            createdAt: new Date("2026-09-23T01:00:00.000Z")
        };
        User.find.mockReturnValue(makeUsersQuery([peer]));

        const res = await agent.get("/api/users?q=hai");

        expect(res.statusCode).toBe(200);
        expect(res.body.users).toHaveLength(1);
        expect(res.body.users[0].passwordHash).toBeUndefined();
    });

    test("Logout làm mất quyền truy cập", async () => {
        User.findOne.mockReturnValue(makeSelectQuery(user));
        argon2.verify.mockResolvedValue(true);
        await agent.post("/api/auth/login").send({
            username: "cong",
            password: "12345678"
        });

        const logoutRes = await agent.post("/api/auth/logout");
        expect(logoutRes.statusCode).toBe(200);

        const meRes = await agent.get("/api/auth/me");
        expect(meRes.statusCode).toBe(401);
    });
});
