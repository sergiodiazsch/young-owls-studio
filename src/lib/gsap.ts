import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register plugins
gsap.registerPlugin(ScrollTrigger);

// Set global defaults for smooth, elegant animations
gsap.defaults({
  ease: "power2.out",
  duration: 0.6,
});

export { gsap, ScrollTrigger };
