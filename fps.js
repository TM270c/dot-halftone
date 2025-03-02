// fps.js

/**
 * Attach an FPS counter to the given video element. 
 * Displays FPS in the element with ID displayElementId.
 */
function attachFPSCounter(video, displayElementId) {
    let lastMediaTime = 0;
    let lastFrameNum = 0;
    let fpsRounder = [];
    let frameNotSeeked = true;
  
    function getFpsAverage() {
      return fpsRounder.reduce((a, b) => a + b, 0) / fpsRounder.length;
    }
  
    function updateFPS(now, metadata) {
      // Initialize if undefined
      if (lastMediaTime === undefined) lastMediaTime = metadata.mediaTime;
      if (lastFrameNum === undefined) lastFrameNum = metadata.presentedFrames;
  
      const mediaTimeDiff = Math.abs(metadata.mediaTime - lastMediaTime);
      const frameNumDiff = Math.abs(metadata.presentedFrames - lastFrameNum);
  
      // Avoid invalid divisions
      if (frameNumDiff > 0) {
        const diff = mediaTimeDiff / frameNumDiff;
        /**
         * We only add to the array if:
         *  1) diff is valid and less than 1 (keeps out weird spikes),
         *  2) the user hasn't just seeked (frameNotSeeked === true),
         *  3) playback rate is normal (1x speed),
         *  4) page is focused (optional, you can remove this check if you want).
         */
        if (diff && diff < 1 && frameNotSeeked && video.playbackRate === 1 && document.hasFocus()) {
          fpsRounder.push(diff);
          // Keep only the last 50 measurements for smoothing
          if (fpsRounder.length > 50) {
            fpsRounder.shift();
          }
  
          // Calculate a “rolling average” FPS
          const fps = Math.round(1 / getFpsAverage());
          // Update DOM
          document.getElementById(displayElementId).textContent = 
            `FPS: ${fps}, certainty: ${fpsRounder.length * 2}%`;
        }
      }
  
      frameNotSeeked = true;
      lastMediaTime = metadata.mediaTime;
      lastFrameNum = metadata.presentedFrames;
  
      // Request the next frame callback
      video.requestVideoFrameCallback(updateFPS);
    }
  
    // If the user seeks in the video, remove the last measurement and flag as not continuous
    video.addEventListener("seeked", () => {
      fpsRounder.pop();
      frameNotSeeked = false;
    });
  
    // Start monitoring
    video.requestVideoFrameCallback(updateFPS);
  }
  