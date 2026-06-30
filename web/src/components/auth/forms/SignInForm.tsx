import { usePostHog } from "@posthog/react";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { authClient } from "#/lib/auth-client";
import { AuthButton } from "../AuthButton";
import { AuthTextField } from "../AuthTextField";

interface SignInFormProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function SignInForm({ onSuccess, onError }: SignInFormProps) {
  const posthog = usePostHog();
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      try {
        const { error } = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        });
        if (error) {
          onError(error.message || "Invalid email or password");
        } else {
          posthog.identify(value.email, { email: value.email });
          posthog.capture("user_signed_in", { method: "email" });
          onSuccess();
        }
      } catch (err: any) {
        posthog.captureException(err);
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
        name="email"
        validators={{
          onChange: ({ value }) => {
            if (!value) return "Email is required";
            if (!/\S+@\S+\.\S+/.test(value))
              return "Please enter a valid email address";
            const allowedDomain = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN;
            if (allowedDomain && !value.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`)) {
              return `Only email addresses from ${allowedDomain} are allowed`;
            }
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
            error={
              field.state.meta.errors
                ? field.state.meta.errors.join(", ")
                : undefined
            }
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
            error={
              field.state.meta.errors
                ? field.state.meta.errors.join(", ")
                : undefined
            }
            leadingIcon={<Lock className="size-5" />}
            required
          />
        )}
      </form.Field>

      <div className="flex justify-end -mt-1">
        <button
          type="button"
          className="text-xs font-semibold text-zinc-500 hover:underline outline-none cursor-pointer"
          onClick={() => {
            onError(
              "Password reset is not configured yet. Please contact your administrator.",
            );
          }}
        >
          Forgot Password?
        </button>
      </div>

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
            Sign In
          </AuthButton>
        )}
      </form.Subscribe>
    </form>
  );
}
