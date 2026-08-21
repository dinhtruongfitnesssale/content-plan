import { Suspense } from "react";
import { LoginForm } from "./form";

export const metadata = { title: "Đăng nhập · Bàn viết" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
