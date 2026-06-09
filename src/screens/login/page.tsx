"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export default function LoginScreen() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-50 px-4">
      <form
        action={action}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl ring-1 ring-navy-100 p-8 space-y-4"
      >
        <h1 className="font-heading text-2xl font-bold text-navy-900">
          Masuk Admin
        </h1>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-navy-900">
            Email
          </label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-navy-900">
            Password
          </label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Memproses…" : "Masuk"}
        </Button>
      </form>
    </div>
  );
}
