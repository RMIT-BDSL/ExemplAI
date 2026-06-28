import { createSignal, createEffect, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authClient } from "../lib/auth-client";
import { useAuth } from "../context/AuthContext";
import { createForm } from "@tanstack/solid-form";

// 1. Header Section Component
function LoginHeader() {
  return (
    <div class="text-center">
      <div class="inline-flex items-center gap-2 mb-4">
        <div class="w-8 h-8 rounded-lg bg-white text-slate-950 flex items-center justify-center font-bold tracking-tight text-base shadow-sm">
          E
        </div>
        <span class="font-semibold text-base text-white tracking-tight">
          ExemplAI Admin
        </span>
      </div>
      <h2 class="text-xl font-medium tracking-tight text-slate-200">
        Welcome back
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        Enter your credentials to access the console
      </p>
    </div>
  );
}

// 2. Error Message Component
interface ErrorMessageProps {
  message: string;
}

function ErrorMessage(props: ErrorMessageProps) {
  return (
    <div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start space-x-2 animate-shake">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-4 h-4 text-red-400 shrink-0 mt-0.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
        />
      </svg>
      <span class="leading-tight">{props.message}</span>
    </div>
  );
}

// 3. Form Field Component
interface FormFieldProps {
  label: string;
  id: string;
  type: string;
  name: string;
  placeholder: string;
  autocomplete?: string;
  value: string;
  onInput: (val: string) => void;
  onBlur: () => void;
  errors: any[];
  disabled: boolean;
}

function FormField(props: FormFieldProps) {
  return (
    <div>
      <label
        for={props.id}
        class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
      >
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.name}
        type={props.type}
        autocomplete={props.autocomplete}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onBlur={props.onBlur}
        class="block w-full px-3.5 py-2.5 border border-slate-800 bg-[#070b13] text-white rounded-lg placeholder-slate-700 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 text-sm transition duration-150"
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
      {props.errors && props.errors.length > 0 && (
        <span class="text-xs text-red-400 mt-1 block">
          <For each={props.errors}>
            {(error) => <span>{String(error)}</span>}
          </For>
        </span>
      )}
    </div>
  );
}

// 4. Submit Button Component
interface SubmitButtonProps {
  isSubmitting: boolean;
}

function SubmitButton(props: SubmitButtonProps) {
  return (
    <div>
      <button
        type="submit"
        disabled={props.isSubmitting}
        class="group w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-lg text-slate-950 bg-white hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-white transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {props.isSubmitting ? (
          <div class="flex items-center space-x-2">
            <svg
              class="animate-spin h-4 w-4 text-slate-950"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Verifying...</span>
          </div>
        ) : (
          <span>Sign In</span>
        )}
      </button>
    </div>
  );
}

// Main Login Page
export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [errorMsg, setErrorMsg] = createSignal("");

  // If user is already logged in, redirect them to dashboard immediately
  createEffect(() => {
    if (user()) {
      console.log("user created.");
      navigate("/", { replace: true });
    }
  });

  const form = createForm(() => ({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setErrorMsg("");
      try {
        const { error } = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        });

        if (error) {
          setErrorMsg(error.message || "Invalid credentials or login failed.");
        } else {
          navigate("/", { replace: true });
        }
      } catch (err: any) {
        setErrorMsg(err.message || "An unexpected error occurred.");
      }
    },
  }));

  return (
    <div class="min-h-screen flex items-center justify-center bg-[#070913] px-4 sm:px-6 lg:px-8 font-sans selection:bg-slate-800 selection:text-white relative overflow-hidden">
      {/* Subtle ambient light */}
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_65%)] pointer-events-none"></div>
      <div class="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-800/30 to-transparent"></div>

      <div class="max-w-md w-full space-y-6 relative z-10">
        <LoginHeader />

        {/* Login Form Container */}
        <div class="bg-[#0e121e] border border-slate-800 p-8 rounded-xl shadow-2xl">
          <form
            class="space-y-6"
            onsubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            {/* Error Message Box */}
            {errorMsg() && <ErrorMessage message={errorMsg()} />}

            <div class="space-y-4">
              {/* Email Input */}
              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return "Email is required";
                    if (!/\S+@\S+\.\S+/.test(value)) {
                      return "Please enter a valid email address";
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <FormField
                    label="Email Address"
                    id="email-address"
                    type="email"
                    name={field().name}
                    placeholder="name@company.com"
                    autocomplete="email"
                    value={field().state.value}
                    onInput={(val) => field().handleChange(val)}
                    onBlur={() => field().handleBlur()}
                    errors={
                      field().state.meta.isTouched
                        ? field().state.meta.errors
                        : []
                    }
                    disabled={form.state.isSubmitting}
                  />
                )}
              </form.Field>

              {/* Password Input */}
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
                  <FormField
                    label="Password"
                    id="password"
                    type="password"
                    name={field().name}
                    placeholder="••••••••••••"
                    autocomplete="current-password"
                    value={field().state.value}
                    onInput={(val) => field().handleChange(val)}
                    onBlur={() => field().handleBlur()}
                    errors={
                      field().state.meta.isTouched
                        ? field().state.meta.errors
                        : []
                    }
                    disabled={form.state.isSubmitting}
                  />
                )}
              </form.Field>
            </div>

            {/* Submit Button */}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => <SubmitButton isSubmitting={isSubmitting()} />}
            </form.Subscribe>
          </form>
        </div>

        {/* Footer info */}
        <div class="text-center text-xs text-slate-600">
          ExemplAI Security Console &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
