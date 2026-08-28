export const clerkAppearance = {
  variables: {
    colorPrimary: "#17663a",
    colorText: "#1e293b",
    colorTextSecondary: "#526158",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#1e293b",
    borderRadius: "12px",
    fontFamily: '"Outfit", sans-serif',
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full bg-transparent p-0 shadow-none",
    headerTitle: "text-2xl font-extrabold tracking-tight text-slate-900",
    headerSubtitle: "text-sm leading-5 text-slate-600",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-none hover:bg-slate-50",
    socialButtonsBlockButtonText: "font-semibold",
    socialButtonsBlockButtonBadge: { display: "none" },
    dividerLine: "bg-slate-200",
    dividerText: "text-slate-500",
    formFieldLabel: "text-sm font-semibold text-slate-800",
    formFieldInput:
      "h-11 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none focus:border-[#17663a] focus:ring-2 focus:ring-[#17663a]/20",
    formButtonPrimary:
      "h-11 rounded-xl bg-[#17663a] font-semibold text-white shadow-none hover:bg-[#12512e] focus:ring-2 focus:ring-[#17663a]/30",
    formFieldAction: "font-semibold text-[#17663a] hover:text-[#12512e]",
    formFieldErrorText: "text-sm text-red-700",
    alert: "rounded-xl border border-red-200 bg-red-50 text-red-800",
    identityPreview:
      "rounded-xl border border-slate-200 bg-slate-50 shadow-none",
    identityPreviewEditButton: "text-[#17663a]",
    footer: "bg-transparent",
    footerAction: { display: "flex" },
    footerActionText: {
      fontSize: "12px",
      lineHeight: "16px",
      color: "#64748b",
      fontWeight: "400",
    },
    footerActionLink: { display: "none" },
  },
};

export const clerkEmbeddedAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    cardBox: { width: "100%", boxShadow: "none" },
    card: { width: "100%", padding: 0, background: "transparent", boxShadow: "none" },
    header: { display: "none" },
    footer: { background: "transparent", boxShadow: "none" },
    footerAction: { display: "flex" },
    footerActionLink: "font-semibold text-[#17663a] hover:text-[#12512e]",
  },
};

export const clerkStaffSignInAppearance = {
  ...clerkEmbeddedAppearance,
  elements: {
    ...clerkEmbeddedAppearance.elements,
    footerAction: { display: "none" },
  },
};

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Staff Sign In",
      subtitle:
        "Sign in with your authorized BreedSmart staff account to access the staff workspace.",
      actionText: "Need access? Contact your BreedSmart administrator.",
    },
  },
};

export default clerkAppearance;
