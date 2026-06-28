import { type FunctionReference, anyApi } from "convex/server";
import { type GenericId as Id } from "convex/values";

export const api: PublicApiType = anyApi as unknown as PublicApiType;
export const internal: InternalApiType = anyApi as unknown as InternalApiType;

export type PublicApiType = {
  courses: {
    getAllCourses: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    getQuestionById: FunctionReference<"query", "public", { id: string }, any>;
  };
  invitationCodes: {
    add: FunctionReference<
      "mutation",
      "public",
      { code: string; createdBy?: string; expiryDate?: string },
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
  };
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
};
export type InternalApiType = {};
