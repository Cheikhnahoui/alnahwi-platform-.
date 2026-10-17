"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/login/actions";
import { FormField } from "./FormField";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-5" noValidate={false}>
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      <FormField
        label="البريد الإلكتروني"
        name="email"
        type="email"
        autoComplete="username"
        dir="ltr"
      />
      <FormField
        label="كلمة المرور"
        name="password"
        type="password"
        autoComplete="current-password"
        dir="ltr"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-5 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}