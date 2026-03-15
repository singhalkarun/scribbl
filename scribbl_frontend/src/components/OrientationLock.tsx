"use client";

import { useEffect, useState } from "react";

export default function OrientationLock() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Enhanced mobile device detection
      const isMobileDevice = () => {
        // Check for touch capability
        const hasTouchScreen =
          "ontouchstart" in window || navigator.maxTouchPoints > 0;

        // Check user agent for mobile indicators
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = [
          "mobile",
          "android",
          "iphone",
          "ipad",
          "ipod",
          "blackberry",
          "windows phone",
        ];
        const isMobileUserAgent = mobileKeywords.some((keyword) =>
          userAgent.includes(keyword)
        );

        // Check screen dimensions - much more restrictive for mobile
        const isSmallScreen = window.innerWidth <= 768; // Typical mobile/small tablet max width
        const hasPortraitAspectRatio =
          window.screen.height > window.screen.width; // Device's natural orientation

        // Device must have touch AND (mobile user agent OR small screen with portrait natural orientation)
        return (
          hasTouchScreen &&
          (isMobileUserAgent || (isSmallScreen && hasPortraitAspectRatio))
        );
      };

      // Only proceed if this is actually a mobile device
      if (!isMobileDevice()) {
        setIsLandscape(false);
        return;
      }

      const windowIsLandscape = window.innerHeight < window.innerWidth;

      // Use screen orientation API if available for more accurate detection
      let orientationIsLandscape = false;
      if (screen.orientation) {
        orientationIsLandscape =
          screen.orientation.angle === 90 || screen.orientation.angle === -90;
      } else if (window.orientation !== undefined) {
        orientationIsLandscape = Math.abs(window.orientation) === 90;
      }

      // Show landscape warning only if:
      // - This is confirmed to be a mobile device AND
      // - Window dimensions suggest landscape AND
      // - Orientation API confirms landscape (if available)
      const shouldShowLandscapeWarning =
        windowIsLandscape &&
        (orientationIsLandscape ||
          (!screen.orientation && window.orientation === undefined));

      setIsLandscape(shouldShowLandscapeWarning);
    };

    // Check orientation on mount (with a small delay to ensure proper initialization)
    const timeoutId = setTimeout(checkOrientation, 100);

    // Listen for orientation and resize changes
    window.addEventListener("orientationchange", () => {
      // Add delay after orientation change for more accurate detection
      setTimeout(checkOrientation, 200);
    });
    window.addEventListener("resize", checkOrientation);

    // Cleanup listeners and timeout
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("orientationchange", checkOrientation);
      window.removeEventListener("resize", checkOrientation);
    };
  }, []);

  if (!isLandscape) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-cream flex items-center justify-center">
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 text-center max-w-sm mx-4">
        <div className="mb-6 flex justify-center">
          <span className="text-5xl">📱</span>
        </div>
        <h2 className="text-2xl font-display text-ink mb-3">
          Please Rotate Your Device
        </h2>
        <p className="text-ink/70 font-medium">
          This app is designed for portrait mode only.
        </p>
      </div>
    </div>
  );
}
