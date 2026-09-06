import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MOTION_QUERY = {
  all: "all",
  desktop: "(min-width: 64rem)",
  mobile: "(max-width: 39.999rem)",
  reduceMotion: "(prefers-reduced-motion: reduce)",
};

const selectAll = (root, selector) => Array.from(root.querySelectorAll(selector));

export default function useLandingAnimations(scope) {
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return undefined;

      const media = gsap.matchMedia();

      media.add(MOTION_QUERY, (context) => {
        const { desktop, mobile, reduceMotion } = context.conditions;
        const animatedElements = selectAll(
          root,
          "[data-motion-navbar], [data-motion-hero-part], [data-motion-hero-cta], [data-motion-hero-image], [data-motion-intro], [data-motion-visual], [data-motion-item], [data-motion-cta]",
        );

        if (reduceMotion) {
          gsap.set(animatedElements, { clearProps: "all" });
          return undefined;
        }

        const distance = mobile ? 16 : desktop ? 28 : 22;
        const navbar = root.querySelector("[data-motion-navbar]");
        const hero = root.querySelector("[data-motion-hero]");
        const heroImage = root.querySelector("[data-motion-hero-image]");
        const heroParts = selectAll(root, "[data-motion-hero-part]");
        const heroCallsToAction = selectAll(root, "[data-motion-hero-cta]");

        if (navbar) {
          gsap.from(navbar, {
            autoAlpha: 0,
            y: -12,
            duration: 0.55,
            ease: "power3.out",
            clearProps: "opacity,visibility,transform",
          });
        }

        if (hero && heroParts.length) {
          const heroTimeline = gsap.timeline({
            defaults: { ease: "power3.out" },
          });

          if (heroImage) {
            heroTimeline.from(
              heroImage,
              {
                autoAlpha: 0,
                scale: 1.03,
                duration: 1.15,
                clearProps: desktop
                  ? "opacity,visibility"
                  : "opacity,visibility,transform",
              },
              0,
            );
          }

          heroTimeline.from(
            heroParts,
            {
              autoAlpha: 0,
              y: (index) => (index === 1 ? (mobile ? 24 : 35) : distance),
              duration: 0.72,
              stagger: 0.11,
              clearProps: "opacity,visibility,transform",
            },
            0.18,
          );

          heroTimeline.from(
            heroCallsToAction,
            {
              autoAlpha: 0,
              y: mobile ? 12 : 15,
              duration: 0.5,
              stagger: 0.1,
              clearProps: "opacity,visibility,transform",
            },
            "-=0.34",
          );

          if (desktop && heroImage) {
            gsap.to(heroImage, {
              yPercent: 7,
              ease: "none",
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "bottom top",
                scrub: 0.6,
              },
            });
          }

        }

        const focusCleanups = [];
        selectAll(root, "[data-motion-section]").forEach((section) => {
          const intro = selectAll(section, "[data-motion-intro]");
          const visuals = selectAll(section, "[data-motion-visual]");
          const items = selectAll(section, "[data-motion-item]");
          const callsToAction = selectAll(section, "[data-motion-cta]");
          const timeline = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: section,
              start: mobile ? "top 88%" : "top 82%",
              end: "bottom top",
              toggleActions: "play reset play reverse",
              invalidateOnRefresh: true,
            },
          });

          if (intro.length) {
            timeline.from(intro, {
              opacity: 0,
              y: distance,
              duration: 0.62,
              stagger: 0.08,
            });
          }

          if (visuals.length) {
            timeline.from(
              visuals,
              {
                opacity: 0,
                x: (index, element) =>
                  mobile ? 0 : Number(element.dataset.motionX || 0),
                y: mobile ? distance : 20,
                scale: 0.98,
                duration: 0.72,
                stagger: 0.1,
              },
              intro.length ? "-=0.32" : 0,
            );
          }

          if (items.length) {
            timeline.from(
              items,
              {
                opacity: 0,
                y: mobile ? 14 : 22,
                scale: 1,
                duration: 0.56,
                stagger: mobile ? 0.06 : 0.1,
              },
              intro.length || visuals.length ? "-=0.32" : 0,
            );
          }

          if (callsToAction.length) {
            timeline.from(
              callsToAction,
              {
                opacity: 0,
                y: mobile ? 12 : 16,
                duration: 0.5,
                stagger: 0.1,
              },
              "-=0.2",
            );
          }
          // Keyboard navigation must reveal content even before its scroll entrance.
          const revealFocusedSection = () => timeline.progress(1).pause();
          section.addEventListener("focusin", revealFocusedSection);
          focusCleanups.push(() => section.removeEventListener("focusin", revealFocusedSection));
        });

        return () => focusCleanups.forEach((cleanup) => cleanup());
      });

      return () => media.revert();
    },
    { scope },
  );
}
