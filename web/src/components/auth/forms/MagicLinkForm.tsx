import { usePostHog } from "@posthog/react";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, Mail } from "lucide-react";
import { buildMagicLinkCallback } from "#/lib/auth-callback";
import { checkUserExists } from "#/lib/auth.functions";
import { authClient } from "#/lib/auth-client";
import { AuthButton } from "../AuthButton";
import { AuthTextField } from "../AuthTextField";

interface MagicLinkFormProps {
  onSuccess: () => void;
  onUserNotFound: (email: string) => void;
  onError: (msg: string) => void;
  redirectUrl?: string;
}

export function MagicLinkForm({
  onSuccess,
  onUserNotFound,
  onError,
  redirectUrl,
}: MagicLinkFormProps) {
  const posthog = usePostHog();
  const form = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      try {
        // Check if email exists in authentication database
        const { exists } = await checkUserExists({ data: value.email });
        if (!exists) {
          onUserNotFound(value.email);
          return;
        }

        console.log(
          `[Auth] Magic Link Sign In initiated for email: "${value.email}"`,
        );

        const { error } = await authClient.signIn.magicLink({
          email: value.email,
          callbackURL: buildMagicLinkCallback(redirectUrl),
        });

        if (error) {
          onError(error.message || "Failed to send magic link");
        } else {
          posthog.capture("magic_link_requested", { email: value.email });
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
            Send Magic Link
          </AuthButton>
        )}
      </form.Subscribe>
    </form>
  );
}
