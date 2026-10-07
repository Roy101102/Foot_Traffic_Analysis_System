import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      // TODO: Replace with your real backend API endpoint
      // await axios.post("/api/auth/forgot-password", { email });

      // Simulated network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsSubmitted(true);
    } catch (err) {
      setError("Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-28 w-28 rounded-2xl flex items-center justify-center">
              <img
                src="images/Logo_DIY.png"
                alt="logo"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">FootTraffic AI</h1>
            <p className="text-slate-400 mt-2">Password Recovery</p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-center">
              {isSubmitted ? "Check Your Email" : "Reset Your Password"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-300">
                    We sent a password reset link to:
                  </p>
                  <p className="text-white font-medium break-all">{email}</p>
                </div>
                <p className="text-xs text-slate-400">
                  Didn’t receive the email? Check your spam folder or try again.
                </p>
                <div className="pt-2 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSubmitted(false)}
                    className="w-full bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                  >
                    Resend Email
                  </Button>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center w-full text-sm text-slate-400 hover:text-white pt-2"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-sm text-slate-400 text-center">
                  Enter the email address associated with your account, and we’ll send you a link to reset your password.
                </p>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? "Sending link..." : "Send Reset Link"}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}