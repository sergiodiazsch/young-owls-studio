"use client";

import { useState, useCallback, useEffect } from "react";
import { WALKTHROUGH_STEPS } from "@/components/onboarding/walkthrough-steps";

const STORAGE_KEY = "screenplay-onboarding-completed";

export function useWalkthrough() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => {
        setHasCompleted(false);
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const complete = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setHasCompleted(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const next = useCallback(() => {
    if (currentStep < WALKTHROUGH_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      complete();
    }
  }, [currentStep, complete]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  const restart = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    setHasCompleted(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    isActive,
    currentStep,
    step: WALKTHROUGH_STEPS[currentStep],
    totalSteps: WALKTHROUGH_STEPS.length,
    hasCompleted,
    next,
    prev,
    skip,
    complete,
    restart,
  };
}
