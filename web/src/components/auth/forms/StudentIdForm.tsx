import { usePostHog } from "@posthog/react";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, IdCard } from "lucide-react";
import { authClient } from "#/lib/auth-client";
import {
  idEmail,
  idPassword,
  isValidStudentId,
  normalizeStudentId,
} from "../../../../convex/studentIds";
import { AuthButton } from "../AuthButton";
import { AuthTextField } from "../AuthTextField";

interface StudentIdFormProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

/**
 * Sign in with a university student ID only (convex/studentIds.ts): the first
 * time creates the ID's account, later times sign into it. The app shell then
 * places the student in their cohort (cohorts.joinWithId).
 */
export function StudentIdForm({ onSuccess, onError }: StudentIdFormProps) {
  const posthog = usePostHog();
  const form = useForm({
    defaultValues: { studentId: "" },
    onSubmit: async ({ value }) => {
      const id = normalizeStudentId(value.studentId);
      const credentials = { email: idEmail(id), password: idPassword(id) };
      try {
        const signIn = await authClient.signIn.email(credentials);
        if (signIn.error) {
          // No account for this ID yet: create it (signs in as well).
          const signUp = await authClient.signUp.email({
            ...credentials,
            name: id,
          });
          if (signUp.error) {
            // The account exists, so the sign-in failed for another reason (e.g. the network): show that.
            const exists =
              /exist/i.test(signUp.error.message || "") ||
              signUp.error.code?.includes("EXIST");
            onError(
              (exists ? signIn.error.message : signUp.error.message) ||
                "Couldn't sign in with that ID.",
            );
            return;
          }
          posthog.capture("user_signed_up", { method: "student_id" });
        } else {
          posthog.capture("user_signed_in", { method: "student_id" });
        }
        onSuccess();
      } catch (err) {
        posthog.captureException(err);
        onError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
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
        name="studentId"
        validators={{
          onChange: ({ value }) => {
            if (!value.trim()) return "Student ID is required";
            if (!isValidStudentId(normalizeStudentId(value)))
              return "Please enter your student ID, e.g. s3912345";
            return undefined;
          },
        }}
      >
        {(field) => (
          <AuthTextField
            label="Student ID"
            type="text"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={
              field.state.meta.errors
                ? field.state.meta.errors.join(", ")
                : undefined
            }
            leadingIcon={<IdCard className="size-5" />}
            autoComplete="username"
            required
          />
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.isSubmitting]}>
        {([isSubmitting]) => (
          <AuthButton
            type="submit"
            variant="filled"
            className="mt-1 w-full"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            icon={<ArrowRight className="size-4" />}
          >
            Continue
          </AuthButton>
        )}
      </form.Subscribe>
    </form>
  );
}
