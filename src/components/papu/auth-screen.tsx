import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, Mic, ShieldCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { playError, playSuccess, unlockAudio } from "@/lib/papu/audio";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/papu/seed";
import { usePapu } from "@/lib/papu/store";
import { Logo } from "@/components/papu/logo";

const features = [
  { icon: ShieldCheck, title: "Dos pasos", text: "Clave y un código de seis dígitos antes de entrar." },
  { icon: Mic, title: "Voz y llamadas", text: "Notas de voz en vivo, llamadas seguras y videollamadas." },
  { icon: Smartphone, title: "Cualquier pantalla", text: "El mismo producto en el teléfono, la tablet y el escritorio." },
];

const sparks = [
  { top: "14%", left: "12%", delay: "0s" },
  { top: "28%", left: "78%", delay: "1.2s" },
  { top: "62%", left: "18%", delay: "2.4s" },
  { top: "74%", left: "70%", delay: "0.6s" },
  { top: "42%", left: "46%", delay: "3s" },
  { top: "18%", left: "58%", delay: "1.8s" },
];

const soft = { duration: 0.32, ease: [0.2, 0, 0, 1] as const };

export function AuthScreen() {
  const pending = usePapu((s) => s.pending);
  const beginAuth = usePapu((s) => s.beginAuth);
  const cancelAuth = usePapu((s) => s.cancelAuth);
  const resendCode = usePapu((s) => s.resendCode);
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [countdown, setCountdown] = useState(0);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    setResendStatus("");
    setError("");
    const res = await resendCode();
    setResending(false);
    if (res.ok) {
      playSuccess();
      setResendStatus(res.message || "Nuevo código generado y enviado.");
      setCountdown(30);
    } else {
      playError();
      setError(res.error || "No se pudo generar nuevo código.");
    }
  };

  useEffect(() => {
    setDigits(["", "", "", "", "", ""]);
    setError("");
    setShake(false);
    setDone(false);
  }, [pending?.code, pending?.email]);

  async function submitAccount(event: FormEvent) {
    event.preventDefault();
    unlockAudio();
    const result = await beginAuth({ mode, name, email, password, confirm });
    if (!result.ok) {
      playError();
      setError(result.error);
      return;
    }
    setError("");
  }

  function applyDigits(start: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    const next = [...digits];

    if (!clean) {
      next[start] = "";
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      if (clean.length === 2 && digits[start]) {
        const newest = clean[clean.length - 1];
        next[start] = newest;
        setDigits(next);
        if (start < 5) refs.current[start + 1]?.focus();
        if (next.every(Boolean) && next.join("").length === 6) {
          void submitCode(next.join(""));
        }
        return;
      }

      const chars = clean.slice(0, 6 - start).split("");
      chars.forEach((ch, idx) => {
        next[start + idx] = ch;
      });
      setDigits(next);
      const focusAt = Math.min(5, start + chars.length);
      refs.current[focusAt]?.focus();
      if (next.every(Boolean) && next.join("").length === 6) {
        void submitCode(next.join(""));
      }
      return;
    }

    next[start] = clean;
    setDigits(next);
    if (start < 5) {
      refs.current[start + 1]?.focus();
    }
    if (next.every(Boolean) && next.join("").length === 6) {
      void submitCode(next.join(""));
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (digits[index]) {
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        next[index - 1] = "";
        setDigits(next);
        refs.current[index - 1]?.focus();
      }
    } else if (event.key === "Delete") {
      event.preventDefault();
      const next = [...digits];
      next[index] = "";
      setDigits(next);
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    } else if (event.key === "Enter") {
      submitCode();
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => {
      if (i < 6) next[i] = ch;
    });
    setDigits(next);
    const focusAt = Math.min(5, pasted.length);
    refs.current[focusAt]?.focus();
    if (pasted.length === 6) {
      void submitCode(pasted);
    }
  }

  async function submitCode(raw?: string) {
    const code = raw ?? digits.join("");
    if (code.length < 6) {
      setError("El código tiene 6 dígitos.");
      setShake(true);
      return;
    }
    setError("");
    const result = await usePapu.getState().completeAuth(code);
    if (!result.ok) {
      playError();
      setError(result.error);
      setShake(true);
      return;
    }
    setDone(true);
    playSuccess();
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-ink text-bone">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="glow-orb top-[-12%] left-[-8%] h-[46vw] w-[46vw] bg-amber/70" />
        <div className="glow-orb right-[-10%] bottom-[-18%] h-[40vw] w-[40vw] bg-moss/80 [animation-duration:24s] [animation-direction:alternate-reverse]" />
        <div className="glow-orb top-[38%] left-[48%] h-[26vw] w-[26vw] bg-clay/50 [animation-duration:20s]" />
        <div className="stage-grid absolute inset-0" />
        {sparks.map((spark) => (
          <span key={spark.left} className="spark" style={{ top: spark.top, left: spark.left, animationDelay: spark.delay }} />
        ))}
      </div>

      <div className="relative z-10 flex h-full items-center justify-center overflow-y-auto px-4 py-8">
        <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <motion.section
            className="hidden lg:block"
            initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ ...soft, delay: 0.05 }}
          >
            <div className="relative inline-flex">
              <span className="orbit">
                <i />
              </span>
              <Logo mark="size-14" />
            </div>
            <h1 className="mt-8 font-display text-6xl leading-none text-balance">Mensajes con calma.</h1>
            <p className="mt-5 max-w-md text-lg text-pretty text-bone-dim">
              La plataforma oficial de mensajería privada, llamadas y notas de voz para la comunidad de PapusBank.
            </p>
            <ul className="mt-10 space-y-5">
              {features.map((item, index) => (
                <motion.li
                  key={item.title}
                  className="flex items-start gap-4"
                  initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ ...soft, delay: 0.18 + index * 0.08 }}
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-panel text-amber shadow-[0_0_24px_color-mix(in_oklab,var(--color-amber)_35%,transparent)]">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold">{item.title}</span>
                    <span className="block text-bone-dim">{item.text}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.section>

          <motion.div
            layout
            className="card-frame mx-auto w-full max-w-md rounded-3xl bg-panel/80 p-6 shadow-[0_0_80px_color-mix(in_oklab,var(--color-amber)_22%,transparent)] backdrop-blur-xl sm:p-8"
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
          >
            <div className="relative z-10 mb-6 flex items-center justify-between lg:hidden">
              <Logo />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {!pending ? (
                <motion.div
                  key="gate"
                  initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.16 } }}
                  transition={soft}
                >
                  <div className="relative grid grid-cols-2 rounded-full bg-ink p-1">
                    {(["login", "register"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setMode(item);
                          setError("");
                        }}
                        className={cn(
                          "relative h-11 rounded-full text-sm font-semibold transition-colors duration-200 active:scale-[0.96]",
                          mode === item ? "text-ink" : "text-bone-dim",
                        )}
                      >
                        {mode === item ? (
                          <motion.span
                            layoutId="auth-pill"
                            className="absolute inset-0 rounded-full bg-amber shadow-[0_0_22px_color-mix(in_oklab,var(--color-amber)_55%,transparent)]"
                            transition={{ type: "spring", duration: 0.38, bounce: 0 }}
                          />
                        ) : null}
                        <span className="relative z-10">{item === "login" ? "Entrar" : "Crear cuenta"}</span>
                      </button>
                    ))}
                  </div>

                  <form className="mt-6" onSubmit={submitAccount}>
                    <AnimatePresence initial={false}>
                      {mode === "register" ? (
                        <motion.div
                          key="name"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={soft}
                          className="overflow-hidden"
                        >
                          <div className="pb-4">
                            <Field label="Nombre" value={name} onChange={setName} autoComplete="name" placeholder="Tu nombre" />
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <div className="mb-4">
                      <Field
                        label={mode === "login" ? "Usuario / Nick de PapusBank" : "Correo"}
                        value={email}
                        onChange={setEmail}
                        autoComplete={mode === "login" ? "username" : "email"}
                        placeholder={mode === "login" ? "Tu nick en PapusBank" : "tu@correo.com"}
                        type={mode === "login" ? "text" : "email"}
                      />
                    </div>
                    <div className="mb-4">
                      <Field
                        label="Clave"
                        value={password}
                        onChange={setPassword}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        placeholder="Mínimo 6 caracteres"
                        type={show ? "text" : "password"}
                        trailing={
                          <button
                            type="button"
                            className="relative size-6 text-mute hover:text-bone"
                            aria-label={show ? "Ocultar clave" : "Mostrar clave"}
                            onClick={() => setShow((value) => !value)}
                          >
                            <AnimatePresence initial={false} mode="popLayout">
                              <motion.span
                                key={show ? "hide" : "show"}
                                className="absolute inset-0 flex items-center justify-center"
                                initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                              >
                                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                              </motion.span>
                            </AnimatePresence>
                          </button>
                        }
                      />
                    </div>
                    <AnimatePresence initial={false}>
                      {mode === "register" ? (
                        <motion.div
                          key="confirm"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={soft}
                          className="overflow-hidden"
                        >
                          <div className="pb-4">
                            <Field
                              label="Confirmar clave"
                              value={confirm}
                              onChange={setConfirm}
                              type={show ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Repite la clave"
                            />
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    {error ? <p className="mb-4 text-sm text-clay-bright">{error}</p> : null}
                    <button type="submit" className="btn-sheen h-12 w-full rounded-full bg-amber text-base font-semibold text-ink active:scale-[0.96]">
                      {mode === "login" ? "Continuar" : "Crear y verificar"}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  className={cn(shake && "shake")}
                  onAnimationEnd={() => setShake(false)}
                  initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.16 } }}
                  transition={soft}
                >
                  <button type="button" className="inline-flex items-center gap-2 text-sm text-bone-dim hover:text-bone" onClick={cancelAuth}>
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Volver
                  </button>
                  <div className="mt-6 flex items-center gap-4">
                    <span className="relative inline-flex size-16 items-center justify-center">
                      <span className="pulse-ring absolute inset-0 rounded-full border border-amber" />
                      <span className="pulse-ring absolute inset-0 rounded-full border border-amber [animation-delay:1.1s]" />
                      <svg viewBox="0 0 80 88" className="relative size-14" aria-hidden="true">
                        <path
                          d="M40 6 L70 18 V42 C70 62 40 82 40 82 C40 82 10 62 10 42 V18 Z"
                          className="draw-shield fill-none stroke-amber"
                          strokeWidth="3"
                        />
                      </svg>
                    </span>
                    <div>
                      <h1 className="font-display text-3xl text-balance">Segundo paso</h1>
                      <p className="mt-1 text-sm text-bone-dim">Código para {pending.email}</p>
                    </div>
                  </div>

                  <div className={cn("mt-8 grid grid-cols-6 gap-2", done && "opacity-40")}>
                    {digits.map((digit, index) => (
                      <motion.div
                        key={index}
                        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ ...soft, delay: 0.04 * index }}
                      >
                        <input
                          ref={(node) => {
                            refs.current[index] = node;
                          }}
                          inputMode="numeric"
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          aria-label={`Dígito ${index + 1}`}
                          value={digit}
                          disabled={done}
                          onChange={(event) => applyDigits(index, event.target.value)}
                          onKeyDown={(event) => handleKeyDown(index, event)}
                          onPaste={handlePaste}
                          onFocus={(event) => event.target.select()}
                          onClick={(event) => (event.target as HTMLInputElement).select()}
                          className="h-14 w-full rounded-xl border border-line bg-ink text-center text-2xl font-semibold text-bone tabular-nums shadow-[inset_0_0_0_1px_transparent] outline-none transition-[border-color,box-shadow] duration-200 focus:border-amber focus:shadow-[0_0_18px_color-mix(in_oklab,var(--color-amber)_45%,transparent)]"
                        />
                      </motion.div>
                    ))}
                  </div>

                  {digits.some(Boolean) && !done && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setDigits(["", "", "", "", "", ""]);
                          refs.current[0]?.focus();
                        }}
                        className="text-xs text-mute underline-offset-4 hover:text-amber hover:underline"
                      >
                        Limpiar código
                      </button>
                    </div>
                  )}

                  {error ? <p className="mt-4 text-sm text-clay-bright">{error}</p> : null}

                  <div className="mt-6 rounded-2xl border border-dashed border-amber/40 bg-ink/80 p-4">
                    <p className="text-xs font-semibold tracking-wide text-amber uppercase">Verificación en dos pasos (2FA)</p>
                    <p className="mt-2 text-sm text-pretty text-bone-dim">
                      Ingresa el código de 6 dígitos generado por tu aplicación autenticadora o enviado por PapusBank.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={done}
                    onClick={() => submitCode()}
                    className="btn-sheen mt-6 h-12 w-full rounded-full bg-amber text-base font-semibold text-ink disabled:opacity-60 active:scale-[0.96]"
                  >
                    {done ? "Listo" : "Verificar"}
                  </button>
                  {resendStatus && (
                    <p className="mt-3 text-center text-xs font-semibold text-moss">
                      {resendStatus}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={resending || countdown > 0 || done}
                    className="mt-3 h-10 w-full text-sm font-semibold text-bone-dim hover:text-amber disabled:opacity-50 transition active:scale-[0.98]"
                    onClick={handleResend}
                  >
                    {resending
                      ? "Generando nuevo código..."
                      : countdown > 0
                      ? `Reenviar en ${countdown}s`
                      : "Generar otro código"}
                  </button>
                  <AnimatePresence>
                    {done ? (
                      <motion.div
                        className="mt-4 flex items-center justify-center gap-2 text-amber"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <ShieldCheck className="size-5" aria-hidden="true" />
                        <span className="text-sm font-semibold">Identidad confirmada</span>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-bone-dim">{label}</span>
      <span className="flex h-12 items-center rounded-xl border border-line bg-ink/80 px-4 transition-[border-color,box-shadow] duration-200 focus-within:border-amber focus-within:shadow-[0_0_18px_color-mix(in_oklab,var(--color-amber)_35%,transparent)]">
        <input
          value={value}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full bg-transparent text-base text-bone outline-none placeholder:text-mute"
        />
        {trailing}
      </span>
    </label>
  );
}
