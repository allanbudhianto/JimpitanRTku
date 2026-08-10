import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, HandCoins, Loader2, Lock, User } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", {
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      navigate(redirect);
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Gagal masuk. Periksa kembali username dan password Anda.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Auth Content */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex w-full max-w-sm flex-col">
          <Card className="gap-0 overflow-hidden pb-0 shadow-xl shadow-primary/5">
            <CardHeader className="border-b bg-muted/30 text-center">
              <div className="flex justify-center">
                <div
                  className="flex size-14 cursor-pointer items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
                  onClick={() => navigate("/")}
                >
                  <HandCoins className="size-7" />
                </div>
              </div>
              <CardTitle className="mt-3 text-xl">
                Masuk ke Jimpitan RT
              </CardTitle>
              <CardDescription>
                Masukkan username dan password Anda
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="px-6 pt-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        name="username"
                        placeholder="cth: admin"
                        className="pl-9"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-9 pr-10"
                        autoComplete="current-password"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Memeriksa...
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
            <CardFooter className="border-t bg-muted/30 px-6 py-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Akun bawaan admin:{" "}
                <span className="font-mono font-semibold text-foreground">
                  admin
                </span>{" "}
                /{" "}
                <span className="font-mono font-semibold text-foreground">
                  admin
                </span>
                . Warga & pengurus didaftarkan oleh admin RT.
              </p>
            </CardFooter>
            <div className="border-t bg-muted/40 px-6 py-3 text-center text-xs text-muted-foreground">
              Aman bersama{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-primary"
              >
                freebuff.com
              </a>
            </div>
          </Card>
          <Button
            variant="link"
            className="mt-4 self-center text-muted-foreground"
            onClick={() => navigate("/")}
          >
            Kembali ke beranda
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
