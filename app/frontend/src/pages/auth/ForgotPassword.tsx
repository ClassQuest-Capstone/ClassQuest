import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";
import { teacherForgotPassword, teacherConfirmForgotPassword } from "../../api/auth.js";

type Step = "request" | "confirm" | "success";

const ERROR_MESSAGES: Record<string, string> = {
    INVALID_CODE:      "That code is incorrect. Please check and try again.",
    EXPIRED_CODE:      "That code has expired. Please request a new one.",
    WEAK_PASSWORD:     "Password must be at least 6 characters and include uppercase, lowercase, a number, and a symbol.",
    TOO_MANY_ATTEMPTS: "Too many attempts. Please wait a few minutes before trying again.",
    RESET_FAILED:      "Something went wrong. Please try again.",
    VALIDATION_ERROR:  "Please fill in all fields correctly.",
};

export default function ForgotPassword() {
    const [step, setStep] = useState<Step>("request");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        feather.replace();
    });

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await teacherForgotPassword(email);
        } catch {
            // Intentionally swallowed — always advance to step 2 to prevent enumeration
        } finally {
            setIsLoading(false);
        }
        setStep("confirm");
    };

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        try {
            await teacherConfirmForgotPassword(email, code, newPassword);
            setStep("success");
        } catch (err: any) {
            const errorCode: string = err?.message ?? "RESET_FAILED";
            setError(ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES["RESET_FAILED"]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        setError("");
        setIsLoading(true);
        try {
            await teacherForgotPassword(email);
        } catch {
            // swallowed
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="font-poppins min-h-screen bg-gray-50 text-gray-900">
            <nav className="bg-blue-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link
                                to="/"
                                className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                            >
                                <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                                <span className="text-xl font-bold">ClassQuest</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <Link
                    to="/TeacherLogin"
                    className="inline-flex items-center text-gray-700 hover:text-indigo-600 transition-colors"
                >
                    <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                    <span className="text-sm font-medium">Back to login</span>
                </Link>
            </div>

            <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <div className="max-w-lg w-full space-y-8 p-5 pt-2">
                    <div className="bg-white p-7 rounded-xl shadow-lg">
                        <div className="text-center mb-6">
                            <i data-feather="lock" className="mx-auto h-12 w-12 text-gray-900"></i>
                            <h3 className="text-2xl font-bold text-gray-900">Reset Password</h3>
                        </div>

                        {step === "request" && (
                            <form onSubmit={handleRequestCode} className="space-y-6">
                                <p className="text-sm text-gray-600 text-center">
                                    Enter your teacher email address and we'll send you a reset code.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Enter your email"
                                    />
                                </div>
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                        {error}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? "Sending..." : "Send Reset Code"}
                                </button>
                            </form>
                        )}

                        {step === "confirm" && (
                            <form onSubmit={handleConfirmReset} className="space-y-6">
                                <p className="text-sm text-gray-600 text-center">
                                    If <strong>{email}</strong> is registered, a 6-digit code has been sent. Enter it below along with your new password.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reset Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Enter 6-digit code"
                                        maxLength={6}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="New password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Confirm new password"
                                    />
                                </div>
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                        {error}
                                        {error === ERROR_MESSAGES["EXPIRED_CODE"] && (
                                            <button
                                                type="button"
                                                onClick={handleResendCode}
                                                disabled={isLoading}
                                                className="ml-2 text-blue-600 hover:text-blue-500 underline disabled:opacity-50"
                                            >
                                                Resend code
                                            </button>
                                        )}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? "Resetting..." : "Reset Password"}
                                </button>
                            </form>
                        )}

                        {step === "success" && (
                            <div className="text-center space-y-4">
                                <i data-feather="check-circle" className="mx-auto h-12 w-12 text-green-500"></i>
                                <p className="text-gray-700">Your password has been reset successfully.</p>
                                <Link
                                    to="/TeacherLogin"
                                    className="inline-block w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition duration-150"
                                >
                                    Back to Login
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
