import {
  APP_DOWNLOAD_URL,
  getDownloadQrUrl,
} from "../../../config/appDistribution";

export const HERO_BG = "https://res.cloudinary.com/donhulins/image/upload/v1785461083/ChatGPT_Image_Jul_31_2026_09_22_42_AM_qs3wcd.png";
export const OTON_LOGO = "https://res.cloudinary.com/donhulins/image/upload/v1780316603/OtonImg2_fwxtsh.png";
export const MUNICIPAL_SEAL = "https://res.cloudinary.com/donhulins/image/upload/v1780319299/foreground_fpxivy.png";
export const MOCKUP_IMG = "https://res.cloudinary.com/donhulins/image/upload/v1780318231/mockup_1.png";
export const APK_URL = APP_DOWNLOAD_URL;
export const QR_URL = getDownloadQrUrl(APP_DOWNLOAD_URL);

export const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "For Farmers", href: "#for-farmers" },
  { label: "For Staff", href: "#for-staff" },
  { label: "Download App", href: "#download-app" },
];

export const VALUE_STRIP_ITEMS = [
  {
    icon: "FileText",
    title: "Organized Records",
    description: "Keep cattle information in one place.",
  },
  {
    icon: "HeartPulse",
    title: "Service Requests",
    description: "Request artificial insemination or health assistance.",
  },
  {
    icon: "Sprout",
    title: "Breeding Monitoring",
    description: "Follow breeding and pregnancy progress.",
  },
  {
    icon: "Calendar",
    title: "Technician Updates",
    description: "Receive schedules and service updates.",
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Register cattle",
    description: "Add the animal's profile through the Farmer app.",
  },
  {
    step: "2",
    title: "Request a service",
    description: "Request artificial insemination or cattle-health assistance.",
  },
  {
    step: "3",
    title: "Technician responds",
    description: "An authorized Technician reviews, schedules, and provides the service.",
  },
  {
    step: "4",
    title: "Track updates",
    description: "Review progress, records, schedules, and follow-ups.",
  },
];

export const FARMER_APP_FEATURES = [
  "Cattle profiles and records",
  "Artificial insemination requests",
  "Cattle-health assistance requests",
  "Breeding and pregnancy monitoring",
  "Schedules and notifications",
];

export const TECH_CAPABILITIES = [
  "Review Farmer service requests",
  "Manage schedules and farm visits",
  "Record artificial insemination and pregnancy findings",
  "Handle health assistance and follow-ups",
  "Review animal histories",
];

export const ADMIN_CAPABILITIES = [
  "Manage users and access",
  "Review operational records",
  "Monitor services and reports",
  "Maintain system oversight",
];
