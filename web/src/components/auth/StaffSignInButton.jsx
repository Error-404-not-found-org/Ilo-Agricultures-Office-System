import { SignInButton } from "@clerk/clerk-react";
import { LogIn } from "lucide-react";

import { clerkAppearance } from "../../config/clerkAppearance";
import { STAFF_SIGN_IN_INTENT_KEY } from "../../config/staffAccess";

const variantClasses = {
  primary:
    "border-[#17663a] bg-[#17663a] text-white hover:border-[#12512e] hover:bg-[#12512e]",
  outline:
    "border-slate-300 bg-white text-slate-800 hover:border-[#17663a] hover:bg-emerald-50 hover:text-[#12512e]",
  inverse:
    "border-white bg-white text-[#174f32] hover:border-emerald-50 hover:bg-emerald-50",
  link: "border-transparent bg-transparent text-current hover:bg-black/5",
};

const sizeClasses = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export default function StaffSignInButton({
  children = "Staff Sign In",
  className = "",
  variant = "outline",
  size = "md",
  showIcon = true,
  onClick,
}) {
  return (
    <SignInButton
      mode="modal"
      withSignUp={false}
      appearance={clerkAppearance}
    >
      <button
        type="button"
        onClick={(event) => {
          window.sessionStorage.setItem(STAFF_SIGN_IN_INTENT_KEY, "true");
          onClick?.(event);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17663a] focus-visible:ring-offset-2 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      >
        {showIcon ? <LogIn className="h-4 w-4" aria-hidden="true" /> : null}
        {children}
      </button>
    </SignInButton>
  );
}
