import React, { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Mail, ArrowLeft, CheckCircle } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your password reset logic here
    console.log("Password reset requested for:", email);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">College Media</span>
        </Link>

        {/* Reset Password Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-10">
          {!isSubmitted ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot password?</h1>
              <p className="text-gray-600 mb-8">
                No worries! Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e8684a] focus:border-transparent outline-none transition"
                      placeholder="you@college.edu"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-[#e8684a] text-white py-3 rounded-xl font-semibold hover:bg-[#d65a3d] transition shadow-lg hover:shadow-xl"
                >
                  Send Reset Link
                </button>
              </form>

              {/* Back to Login */}
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 mt-6 text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </>
          ) : (
            <>
              {/* Success Message */}
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Check your email</h1>
                <p className="text-gray-600 mb-6">
                  We've sent a password reset link to
                  <br />
                  <span className="font-semibold text-gray-900">{email}</span>
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Didn't receive the email?</strong> Check your spam folder or try another email address.
                  </p>
                </div>

                {/* Resend Button */}
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="w-full bg-[#e8684a] text-white py-3 rounded-xl font-semibold hover:bg-[#d65a3d] transition shadow-lg hover:shadow-xl mb-4"
                >
                  Try Another Email
                </button>

                {/* Back to Login */}
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Back to Home */}
        <Link to="/" className="block text-center mt-6 text-gray-600 hover:text-gray-900 transition">
          ← Back to home
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
