import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register all Better Auth routes (/api/auth/*)
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
