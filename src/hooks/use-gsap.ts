"use client";

import { useRef, useEffect, type RefObject, type DependencyList } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

// ---------------------------------------------------------------------------
// useGSAP — core hook that wraps gsap.context for safe cleanup
// ---------------------------------------------------------------------------

export function useGSAP(
  callback: (ctx: gsap.Context) => void,
  deps: DependencyList = [],
  scope?: RefObject<HTMLElement | null>,
) {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      callback(ctx!);
    }, scope?.current ?? undefined);

    ctxRef.current = ctx;

    return () => {
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ctxRef;
}

// ---------------------------------------------------------------------------
// useFadeIn — fade in with translateY
// ---------------------------------------------------------------------------

export interface FadeInOptions {
  delay?: number;
  duration?: number;
  y?: number;
  ease?: string;
}

export function useFadeIn(
  ref: RefObject<HTMLElement | null>,
  options: FadeInOptions = {},
) {
  const { delay = 0, duration = 0.6, y = 20, ease = "power2.out" } = options;

  useGSAP(
    () => {
      if (!ref.current) return;

      gsap.set(ref.current, { opacity: 0, y });
      gsap.to(ref.current, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease,
      });
    },
    [],
    ref,
  );
}

// ---------------------------------------------------------------------------
// useStaggerIn — stagger children into view
// ---------------------------------------------------------------------------

export interface StaggerInOptions {
  delay?: number;
  stagger?: number;
  y?: number;
  ease?: string;
  duration?: number;
}

export function useStaggerIn(
  containerRef: RefObject<HTMLElement | null>,
  childSelector: string,
  options: StaggerInOptions = {},
) {
  const {
    delay = 0,
    stagger = 0.06,
    y = 15,
    ease = "power2.out",
    duration = 0.5,
  } = options;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const children = containerRef.current.querySelectorAll(childSelector);
      if (!children.length) return;

      gsap.set(children, { opacity: 0, y });
      gsap.to(children, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease,
      });
    },
    [],
    containerRef,
  );
}

// ---------------------------------------------------------------------------
// usePageTransition — animate page content in on mount
// ---------------------------------------------------------------------------

export function usePageTransition(ref: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (!ref.current) return;

      gsap.set(ref.current, {
        opacity: 0,
        y: 12,
        scale: 0.99,
        filter: "blur(2px)",
      });

      gsap.to(ref.current, {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.5,
        ease: "power3.out",
      });
    },
    [],
    ref,
  );
}

// ---------------------------------------------------------------------------
// useHoverLift — lift element on hover
// ---------------------------------------------------------------------------

export interface HoverLiftOptions {
  y?: number;
  duration?: number;
  shadow?: boolean;
}

export function useHoverLift(
  ref: RefObject<HTMLElement | null>,
  options: HoverLiftOptions = {},
) {
  const { y = -4, duration = 0.3, shadow = false } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const enterProps: gsap.TweenVars = {
      y,
      duration,
      ease: "power2.out",
    };

    const leaveProps: gsap.TweenVars = {
      y: 0,
      duration,
      ease: "power2.out",
    };

    if (shadow) {
      enterProps.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
      leaveProps.boxShadow = "0 0px 0px rgba(0,0,0,0)";
    }

    const onEnter = () => gsap.to(el, enterProps);
    const onLeave = () => gsap.to(el, leaveProps);

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [ref, y, duration, shadow]);
}

// ---------------------------------------------------------------------------
// useScrollReveal — reveal elements on scroll with ScrollTrigger
// ---------------------------------------------------------------------------

export interface ScrollRevealOptions {
  y?: number;
  duration?: number;
  start?: string;
}

export function useScrollReveal(
  ref: RefObject<HTMLElement | null>,
  options: ScrollRevealOptions = {},
) {
  const { y = 30, duration = 0.6, start = "top 85%" } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, y });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start,
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration,
          ease: "power2.out",
        });
      },
    });

    return () => {
      trigger.kill();
    };
  }, [ref, y, duration, start]);
}

// ---------------------------------------------------------------------------
// usePressScale — scale down on press, spring back on release
// ---------------------------------------------------------------------------

export function usePressScale(
  ref: RefObject<HTMLElement | null>,
  scale: number = 0.97,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = () => {
      gsap.to(el, {
        scale,
        duration: 0.15,
        ease: "power2.out",
      });
    };

    const onUp = () => {
      gsap.to(el, {
        scale: 1,
        duration: 0.4,
        ease: "elastic.out(1, 0.5)",
      });
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);

    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onUp);
    };
  }, [ref, scale]);
}
