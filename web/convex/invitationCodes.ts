import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Creates a new invitation code.
 * The usage limit (quantity) is hardcoded to 1.
 */
export const add = mutation({
  args: {
    code: v.string(),
    createdBy: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if code already exists
    const existing = await ctx.db
      .query("invitationCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (existing) {
      throw new Error(`Invitation code "${args.code}" already exists.`);
    }

    const invitationCodeId = await ctx.db.insert("invitationCodes", {
      code: args.code,
      isValid: true,
      quantity: args.quantity ?? 1,
      usesCount: 0,
      createdBy: args.createdBy,
      whoUsed: [],
      expiryDate: args.expiryDate,
    });

    return invitationCodeId;
  },
});

/**
 * Internal logic helpers to share validation and redemption code.
 */
async function validateCodeHelper(ctx: QueryCtx | MutationCtx, code: string) {
  const invitation = await ctx.db
    .query("invitationCodes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

  if (!invitation) {
    return { isValid: false, reason: "Invitation code is invalid, already used or does not exist" };
  }

  if (!invitation.isValid) {
    return { isValid: false, reason: "Invitation code is invalid, already used or does not exist" };
  }

  if (invitation.usesCount >= invitation.quantity) {
    return { isValid: false, reason: "Invitation code is invalid, already used or does not exist" };
  }

  if (invitation.expiryDate) {
    const expiry = new Date(invitation.expiryDate);
    if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
      return { isValid: false, reason: "Code has expired" };
    }
  }

  return {
    isValid: true,
    remainingCapacity: invitation.quantity - invitation.usesCount,
    expiryDate: invitation.expiryDate,
  };
}

async function useCodeHelper(ctx: MutationCtx, code: string, userTokenIdentifier: string) {
  // 1. Retrieve the invitation code
  const invitation = await ctx.db
    .query("invitationCodes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();

  if (!invitation) {
    return { success: false, error: "Invitation code is invalid, already used or does not exist" };
  }

  // 2. Check validity flag
  if (!invitation.isValid) {
    return { success: false, error: "Invitation code is invalid, already used or does not exist" };
  }

  // 3. Check remaining quantity capacity
  if (invitation.usesCount >= invitation.quantity) {
    return { success: false, error: "Invitation code is invalid, already used or does not exist" };
  }

  // 4. Check expiration date if set
  if (invitation.expiryDate) {
    const expiry = new Date(invitation.expiryDate);
    if (isNaN(expiry.getTime())) {
      console.warn(`Invalid expiryDate format for code: ${code}`);
    } else if (expiry.getTime() < Date.now()) {
      // Automatically mark the code as invalid since it is expired
      await ctx.db.patch(invitation._id, { isValid: false });
      return { success: false, error: "Invitation code has expired." };
    }
  }

  // 5. Look up the user to associate the code with
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", userTokenIdentifier))
    .unique();

  if (!user) {
    return { success: false, error: "User not found." };
  }

  // 6. Look up the user profile to associate the code with
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();

  if (profile && profile.invitationCode === code) {
    return { success: false, error: "You have already used this invitation code." };
  }

  // 7. Update invitation code usage statistics
  const newUsesCount = invitation.usesCount + 1;
  const isNowValid = newUsesCount < invitation.quantity;
  const updatedWhoUsed = [...invitation.whoUsed, userTokenIdentifier];

  await ctx.db.patch(invitation._id, {
    usesCount: newUsesCount,
    isValid: isNowValid,
    whoUsed: updatedWhoUsed,
  });

  // 8. Link invitation code to the user profile
  if (profile) {
    await ctx.db.patch(profile._id, {
      invitationCode: code,
      tokenIdentifier: userTokenIdentifier,
    });
  } else {
    await ctx.db.insert("userProfiles", {
      userId: user._id,
      tokenIdentifier: userTokenIdentifier,
      invitationCode: code,
    });
  }

  return { success: true };
}

/**
 * Redeems an invitation code for a given user.
 * Validates existence, isValid flag, usage capacity, and expiration.
 * Associates the code with the user and records the usage.
 */
export const useCode = mutation({
  args: {
    code: v.string(),
    userTokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    return await useCodeHelper(ctx, args.code, args.userTokenIdentifier);
  },
});

/**
 * Manually invalidates an invitation code.
 */
export const invalidateCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitationCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invitation) {
      throw new Error(`Invitation code "${args.code}" not found.`);
    }

    await ctx.db.patch(invitation._id, { isValid: false });
    return { success: true };
  },
});

/**
 * Lists all invitation codes. Intended for admin use.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("invitationCodes").collect();
  },
});

/**
 * Deletes an invitation code by its string code value.
 */
export const remove = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitationCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invitation) {
      throw new Error(`Invitation code "${args.code}" not found.`);
    }

    await ctx.db.delete(invitation._id);
    return { success: true };
  },
});

/**
 * Validates an invitation code, returning its current state and availability.
 */
export const validateCode = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return await validateCodeHelper(ctx, args.code);
  },
});

/**
 * Creates the user in Convex database if they don't exist,
 * and redeems the invitation code.
 */
export const createUserAndUseCode = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    code: v.string(),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate the code
    const validation = await validateCodeHelper(ctx, args.code);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid invitation code.");
    }

    // 2. Check if user already exists in Convex
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      // Create user
      const userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        image: args.image,
        tokenIdentifier: args.tokenIdentifier,
      });
      user = (await ctx.db.get(userId))!;
    } else {
      // Sync tokenIdentifier if not set or changed
      if (user.tokenIdentifier !== args.tokenIdentifier) {
        await ctx.db.patch(user._id, {
          tokenIdentifier: args.tokenIdentifier,
        });
      }
    }

    // 3. Redeem the code
    const useResult = await useCodeHelper(ctx, args.code, args.tokenIdentifier);

    if (!useResult.success) {
      throw new Error(useResult.error || "Failed to redeem invitation code.");
    }

    return { success: true };
  },
});

/**
 * Lists all invitation codes, sorted by creation time descending.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("invitationCodes").order("desc").collect();
  },
});

/**
 * Deletes an invitation code.
 */
export const deleteCode = mutation({
  args: {
    id: v.id("invitationCodes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Updates an invitation code's details.
 */
export const update = mutation({
  args: {
    id: v.id("invitationCodes"),
    code: v.optional(v.string()),
    isValid: v.optional(v.boolean()),
    quantity: v.optional(v.number()),
    expiryDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, ...patchData } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Invitation code not found");
    }

    if (patchData.code && patchData.code !== existing.code) {
      const duplicate = await ctx.db
        .query("invitationCodes")
        .withIndex("by_code", (q) => q.eq("code", patchData.code!))
        .unique();
      if (duplicate) {
        throw new Error(`Invitation code "${patchData.code}" already exists.`);
      }
    }

    const updateData: any = { ...patchData };
    if (updateData.expiryDate === null) {
      updateData.expiryDate = undefined;
    }

    await ctx.db.patch(id, updateData);
    return { success: true };
  },
});

