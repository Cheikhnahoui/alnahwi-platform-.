import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
      <p className="mt-1 mb-8 text-muted-foreground">
        لوحة تحكم الموقع الرسمي للشيخ عبد الرحمن النحوي
      </p>
      <LoginForm />
    </main>
  );
}