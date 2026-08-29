"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { login, logout } from "@/services/auth";

type LoginPageProps = {
  nextPath: string;
  initialMessage?: string;
};

export function LoginPage({ nextPath, initialMessage }: LoginPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedEmail || !password) {
      setError("Informe o e-mail e a senha do administrador.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await login({
        email: normalizedEmail,
        password,
      });

      if (response.account.role !== "admin") {
        await logout();
        setError("Esta conta não possui permissão administrativa.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Não foi possível realizar o login.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7f6] text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-emerald-200/55 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -left-32 size-[28rem] rounded-full bg-sky-200/40 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-slate-900/10 pb-6">
          <Link
            href="/"
            aria-label="Voltar para a página inicial"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#12322b] text-lg font-bold text-white shadow-sm">
              S
            </span>
            <span>
              <span className="block text-lg font-bold tracking-[-0.03em] text-[#12322b]">
                StoreSales
              </span>
              <span className="block text-xs font-medium text-slate-500">
                Gestão comercial
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/75 px-4 py-2 text-sm font-bold text-[#12322b] shadow-sm transition hover:border-emerald-700/30 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span aria-hidden="true">&larr;</span>
            Voltar
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,29rem)] lg:gap-16 lg:py-14">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Área protegida
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-[#102c27] sm:text-5xl lg:text-6xl">
              Administração com acesso seguro.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Entre com sua conta administrativa para cadastrar, editar e
              controlar os vendedores da loja.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-lg">
              <div className="rounded-2xl border border-emerald-900/10 bg-white/70 p-4">
                <p className="text-sm font-bold text-[#12322b]">Sessão protegida</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Token seguro em cookie e proteção contra requisições indevidas.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-900/10 bg-white/70 p-4">
                <p className="text-sm font-bold text-[#12322b]">Acesso por função</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Somente contas com permissão de administrador entram nesta área.
                </p>
              </div>
            </div>
          </div>

          <section
            aria-labelledby="login-title"
            className="rounded-3xl border border-slate-900/10 bg-white/95 p-6 shadow-[0_28px_75px_-38px_rgba(15,23,42,0.5)] sm:p-8"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 font-bold text-emerald-800">
              A
            </div>
            <h2
              id="login-title"
              className="mt-5 text-2xl font-bold tracking-[-0.035em] text-[#12322b]"
            >
              Entrar na administração
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use o e-mail e a senha cadastrados no backend.
            </p>

            {initialMessage && !error && (
              <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {initialMessage}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6">
              <div>
                <label
                  htmlFor="admin-email"
                  className="text-sm font-bold text-slate-700"
                >
                  E-mail
                </label>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={100}
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  placeholder="admin@loja.com"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="admin-password"
                  className="text-sm font-bold text-slate-700"
                >
                  Senha
                </label>
                <div className="relative mt-2">
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-20 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-pressed={showPassword}
                    className="absolute inset-y-1 right-1 rounded-lg px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#12322b] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(18,50,43,0.9)] transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </section>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-900/10 pt-5 text-xs text-slate-500">
          <p>StoreSales</p>
          <p>Acesso administrativo</p>
        </footer>
      </div>
    </main>
  );
}
