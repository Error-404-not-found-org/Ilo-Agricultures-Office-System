import { SignInButton } from "@clerk/clerk-react";
import { LogIn } from "lucide-react";

import { clerkPublicSignInAppearance } from "../../config/clerkAppearance";
import { STAFF_SIGN_IN_INTENT_KEY } from "../../config/staffAccess";

const variantClasses = {
  primary: "bg-[#0D3320] text-[#A8E063] hover:bg-[#1A5C35]",
  outline: "bg-transparent text-[#061A0E] hover:bg-[#0D3320]/10",
  inverse: "bg-transparent text-white hover:bg-white/10",
  link: "bg-transparent text-current hover:bg-black/5",
};

const sizeClasses = {
  sm: "min-h-10 px-4 text-[13px]",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-[15px]",
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
      forceRedirectUrl="/"
      appearance={clerkPublicSignInAppearance}
    >
      <button
        type="button"
        onClick={(event) => {
          window.sessionStorage.setItem(STAFF_SIGN_IN_INTENT_KEY, "true");
          onClick?.(event);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8E063] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061A0E] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      >
        {showIcon ? <LogIn className="h-4 w-4" aria-hidden="true" /> : null}
        {children}
      </button>
    </SignInButton>
  );
}
