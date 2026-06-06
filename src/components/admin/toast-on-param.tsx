"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function ToastOnParamInner({
  param,
  messages,
}: {
  param: string;
  messages: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const value = searchParams.get(param);
    if (!value) return;
    fired.current = true;

    const message = messages[value];
    if (message) toast.success(message);

    // Bersihkan param dari URL agar tidak terpicu ulang saat refresh.
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [param, messages, searchParams, router, pathname]);

  return null;
}

export function ToastOnParam(props: {
  param: string;
  messages: Record<string, string>;
}) {
  return (
    <Suspense fallback={null}>
      <ToastOnParamInner {...props} />
    </Suspense>
  );
}
