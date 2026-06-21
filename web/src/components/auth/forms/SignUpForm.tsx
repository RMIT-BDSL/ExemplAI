import { Mail, Lock, User, ShieldCheck, ArrowRight } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { authClient } from "#/lib/auth-client";
import { AuthTextField } from "../AuthTextField";
import { AuthButton } from "../AuthButton";

interface SignUpFormProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function SignUpForm({ onSuccess, onError }: SignUpFormProps) {
  const convex = useConvex();
  const createUserAndUseCode = useMutation(api.invitationCodes.createUserAndUseCode);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      code: "",
    },
    onSubmit: async ({ value }) => {
      try {
        // 1. Validate invitation code in Convex
        const validation = await convex.query(api.invitationCodes.validateCode, { code: value.code });
        if (!validation.isValid) {
          onError(validation.reason || "Invalid invitation code.");
          return;
        }

        // 2. Register user in Better Auth
        const signUpRes = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: value.name,
        });

        if (signUpRes.error) {
          onError(signUpRes.error.message || "Failed to create account");
        } else {
          // 3. Create user profile in Convex and redeem invitation code
          const user = signUpRes.data?.user;
          if (user) {
            await createUserAndUseCode({
              email: user.email,
              name: user.name || undefined,
              image: user.image || undefined,
              code: value.code,
              tokenIdentifier: user.id,
            });
          }
          onSuccess();
        }
      } catch (err: any) {
        onError(err.message || "An unexpected error occurred.");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => {
            if (!value.trim()) return "Name is required";
            return undefined;
          },
        }}
      >
        {(field) => (
          <AuthTextField
            label="Full Name"
            type="text"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors ? field.state.meta.errors.join(", ") : undefined}
            leadingIcon={<User className="size-5" />}
            required
          />
        )}
      </form.Field>

      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            if (!value) return "Email is required";
            if (!/\S+@\S+\.\S+/.test(value)) return "Please enter a valid email address";
            return undefined;
          },
        }}
      >
        {(field) => (
          <AuthTextField
            label="Email Address"
            type="email"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors ? field.state.meta.errors.join(", ") : undefined}
            leadingIcon={<Mail className="size-5" />}
            required
          />
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) => {
            if (!value) return "Password is required";
            if (value.length < 8) return "Password must be at least 8 characters";
            return undefined;
          },
        }}
      >
        {(field) => (
          <AuthTextField
            label="Password"
            type="password"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors ? field.state.meta.errors.join(", ") : undefined}
            leadingIcon={<Lock className="size-5" />}
            required
          />
        )}
      </form.Field>

      <form.Field
        name="code"
        validators={{
          onChange: ({ value }) => {
            if (!value.trim()) return "Invitation code is required";
            return undefined;
          },
        }}
      >
        {(field) => (
          <AuthTextField
            label="Invitation Code"
            type="text"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={field.state.meta.errors ? field.state.meta.errors.join(", ") : undefined}
            leadingIcon={<ShieldCheck className="size-5" />}
            required
          />
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.isSubmitting]}>
        {([isSubmitting]) => (
          <AuthButton
            type="submit"
            variant="filled"
            className="w-full h-12 text-base mt-2"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            icon={<ArrowRight className="size-5" />}
          >
            Sign Up
          </AuthButton>
        )}
      </form.Subscribe>
    </form>
  );
}
