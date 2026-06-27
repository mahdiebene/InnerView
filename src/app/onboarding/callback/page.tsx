"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePollinations } from "@/components/PollinationsProvider";
import { readByopFragment, verifyByopState, clearByopState } from "@/lib/pollinations/byop";
import { Brand } from "@/components/Brand";

export default function ByopCallback() {
  const router = useRouter();
  const { connect } = usePollinations();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Finishing your connection…");

  useEffect(() => {
    (async () => {
      const { apiKey, error, state } = readByopFragment();
      // Clean the fragment so a refresh doesn't re-process it.
      if (typeof history !== "undefined") history.replaceState(null, "", window.location.pathname);

      if (error) {
        setStatus("error");
        setMessage(error === "access_denied" ? "You declined the connection." : `Error: ${error}`);
        clearByopState();
        return;
      }
      if (!apiKey) {
        setStatus("error");
        setMessage("No key was returned. Try connecting again.");
        clearByopState();
        return;
      }
      if (!verifyByopState(state)) {
        setStatus("error");
        setMessage("Security check failed (state mismatch). Please try again.");
        clearByopState();
        return;
      }
      try {
        await connect(apiKey, "byop");
        clearByopState();
        setStatus("ok");
        setMessage("Connected. Taking you to your journal…");
        setTimeout(() => router.replace("/journal"), 700);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Couldn't store your key.");
      }
    })();
  }, [connect, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      <Brand />
      <p
        className={`mt-10 font-serif text-2xl ${
          status === "error" ? "text-red-700" : status === "ok" ? "text-accent" : "text-ink-900/80"
        }`}
      >
        {message}
      </p>
      {status === "error" && (
        <a
          href="/onboarding/connect"
          className="mt-6 rounded-full bg-ink-900 px-5 py-2.5 text-paper"
        >
          Try again
        </a>
      )}
    </main>
  );
}
