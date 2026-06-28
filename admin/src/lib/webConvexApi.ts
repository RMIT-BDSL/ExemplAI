import { type FunctionReference, anyApi } from "convex/server";
import { type GenericId as Id } from "convex/values";

export const api: PublicApiType = anyApi as unknown as PublicApiType;
export const internal: InternalApiType = anyApi as unknown as InternalApiType;

export type PublicApiType = {
  auth: {
    checkUserExistsQuery: FunctionReference<
      "query",
      "public",
      { email: string },
      any
    >;
    getSessionUser: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
  };
  courses: {
    getAllCourses: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getQuestionById: FunctionReference<"query", "public", { id: string }, any>;
    getLessonProgress: FunctionReference<
      "query",
      "public",
      { tokenIdentifier: string },
      any
    >;
    setLessonStatus: FunctionReference<
      "mutation",
      "public",
      {
        lessonId: Id<"questions">;
        status: "in-progress" | "completed" | "pending";
        tokenIdentifier: string;
      },
      any
    >;
    getLessonCompletionStats: FunctionReference<
      "query",
      "public",
      { lessonId: Id<"questions"> },
      any
    >;
  };
  invitationCodes: {
    add: FunctionReference<
      "mutation",
      "public",
      {
        code: string;
        createdBy?: string;
        expiryDate?: string;
        quantity?: number;
      },
      any
    >;
    useCode: FunctionReference<
      "mutation",
      "public",
      { code: string; userTokenIdentifier: string },
      any
    >;
    invalidateCode: FunctionReference<
      "mutation",
      "public",
      { code: string },
      any
    >;
    listAll: FunctionReference<"query", "public", Record<string, never>, any>;
    remove: FunctionReference<"mutation", "public", { code: string }, any>;
    validateCode: FunctionReference<"query", "public", { code: string }, any>;
    createUserAndUseCode: FunctionReference<
      "mutation",
      "public",
      {
        code: string;
        email: string;
        image?: string;
        name?: string;
        tokenIdentifier: string;
      },
      any
    >;
    list: FunctionReference<"query", "public", Record<string, never>, any>;
    deleteCode: FunctionReference<
      "mutation",
      "public",
      { id: Id<"invitationCodes"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        code?: string;
        expiryDate?: string | null;
        id: Id<"invitationCodes">;
        isValid?: boolean;
        quantity?: number;
      },
      any
    >;
  };
  init: {
    createAdminUser: FunctionReference<
      "mutation",
      "public",
      Record<string, never>,
      any
    >;
  };
};
export type InternalApiType = {};
