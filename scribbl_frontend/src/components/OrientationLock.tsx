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
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-indigo-50 via-white to-cyan-100 flex items-center justify-center transition-opacity duration-300">
      <div className="text-center text-gray-800 p-8 max-w-md mx-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20">
        <div className="mb-6 flex justify-center">
          {/* Phone rotation icon using CSS */}
          <div className="relative">
            <div className="w-16 h-24 border-4 border-blue-400 rounded-lg animate-pulse"></div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
              ↻
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-4 font-outfit text-gray-800">
          Please Rotate Your Device
        </h2>
        <p className="text-lg text-gray-600 mb-2">
          This app is designed for portrait mode only.
        </p>
      </div>
    </div>
  );
}
