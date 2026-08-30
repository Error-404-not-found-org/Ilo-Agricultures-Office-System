export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-primary)",
    colorPrimaryForeground: "var(--color-primary-content)",
    colorDanger: "var(--color-error)",
    colorSuccess: "var(--color-success)",
    colorWarning: "var(--color-warning)",
    colorNeutral: "var(--color-base-content)",
    colorForeground: "var(--color-base-content)",
    colorMuted: "var(--color-base-200)",
    colorMutedForeground:
      "color-mix(in srgb, var(--color-base-content) 65%, transparent)",
    colorBackground: "var(--color-base-100)",
    colorInput: "var(--color-base-100)",
    colorInputForeground: "var(--color-base-content)",
    colorShimmer:
      "color-mix(in srgb, var(--color-base-content) 10%, transparent)",
    colorRing: "var(--color-primary)",
    colorShadow: "var(--color-neutral)",
    colorBorder: "var(--color-base-300)",
    colorModalBackdrop: "var(--color-neutral)",
    borderRadius: "var(--radius-field)",
    fontFamily: '"Outfit", sans-serif',
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "w-full overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-xl",
    card: "w-full bg-base-100 shadow-none",
    headerTitle: "text-2xl font-extrabold tracking-tight text-base-content",
    headerSubtitle: "text-sm leading-5 text-base-content/65",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-base-300 bg-base-100 text-base-content shadow-none hover:bg-base-200",
    socialButtonsBlockButtonText: "font-semibold",
    socialButtonsBlockButtonBadge: { display: "none" },
    dividerLine: "bg-base-300",
    dividerText: "text-base-content/60",
    formFieldLabel: "text-sm font-semibold text-base-content",
    formFieldInput:
      "h-11 rounded-xl border-base-300 bg-base-100 text-base-content shadow-none focus:border-primary focus:ring-2 focus:ring-primary/20",
    formButtonPrimary:
      "h-11 rounded-xl bg-primary font-semibold text-primary-content shadow-none hover:bg-primary/90 focus:ring-2 focus:ring-primary/30",
    formFieldAction: "font-semibold text-primary hover:text-primary/80",
    formFieldErrorText: "text-sm text-error",
    alert: "rounded-xl border border-error/30 bg-error/10 text-error",
    identityPreview:
      "rounded-xl border border-base-300 bg-base-200 shadow-none",
    identityPreviewEditButton: "text-primary",
    footer: "bg-transparent",
    footerAction: { display: "flex" },
    footerActionText: {
      fontSize: "12px",
      lineHeight: "16px",
      color:
        "color-mix(in srgb, var(--color-base-content) 60%, transparent)",
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
    footerActionLink: "font-semibold text-primary hover:text-primary/80",
  },
};

export const clerkStaffSignInAppearance = {
  ...clerkEmbeddedAppearance,
  elements: {
    ...clerkEmbeddedAppearance.elements,
    footerAction: { display: "none" },
  },
};

export const clerkPublicSignInAppearance = {
  ...clerkAppearance,
  variables: {
    ...clerkAppearance.variables,
    colorPrimary: "#17663a",
    colorPrimaryForeground: "#ffffff",
    colorDanger: "#dc2626",
    colorSuccess: "#15803d",
    colorWarning: "#d97706",
    colorNeutral: "#1d2b27",
    colorForeground: "#0f172a",
    colorMuted: "#f8fafc",
    colorMutedForeground: "#475569",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#0f172a",
    colorRing: "#17663a",
    colorShadow: "#1d2b27",
    colorBorder: "#e2e8f0",
    colorModalBackdrop: "#1d2b27",
  },
  elements: {
    ...clerkAppearance.elements,
    cardBox:
      "w-full overflow-hidden rounded-box border border-slate-200 bg-white shadow-sm",
    card: "w-full bg-white shadow-none",
    headerTitle: "text-2xl font-extrabold tracking-tight text-slate-900",
    headerSubtitle: "text-sm leading-5 text-slate-600",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-none hover:bg-slate-50",
    dividerLine: "bg-slate-200",
    dividerText: "text-slate-600",
    formFieldLabel: "text-sm font-semibold text-slate-800",
    formFieldInput:
      "h-11 rounded-xl border-slate-300 bg-white text-slate-900 shadow-none focus:border-[#17663a] focus:ring-2 focus:ring-[#17663a]/20",
    formButtonPrimary:
      "h-11 rounded-xl bg-[#17663a] font-semibold text-white shadow-none hover:bg-[#12512e] focus:ring-2 focus:ring-[#17663a]/30",
    formFieldAction: "font-semibold text-[#17663a] hover:text-[#12512e]",
    identityPreview:
      "rounded-xl border border-slate-200 bg-slate-50 shadow-none",
    identityPreviewEditButton: "text-[#17663a]",
    footerActionText: {
      ...clerkAppearance.elements.footerActionText,
      color: "#475569",
    },
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
