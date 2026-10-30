import { redirect } from "next/navigation";

// OTP verification now happens on the login page only.
export default function VerifyOtpPage() {
  redirect("/login");
}
