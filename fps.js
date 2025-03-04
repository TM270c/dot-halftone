/**
 * Attach an FPS counter to a video element.
 * Displays the FPS (and a “certainty” percentage) in the element with the given ID.
 */
function attachFPSCounter(video, displayElementId) {
  let lastMediaTime = 0;
  let lastFrameNum = 0;
  const fpsValues = [];
  let continuous = true;
  const displayElement = document.getElementById(displayElementId);

  function updateFPS(_, { mediaTime, presentedFrames }) {
    const mediaDiff = Math.abs(mediaTime - lastMediaTime);
    const frameDiff = Math.abs(presentedFrames - lastFrameNum);
    if (frameDiff > 0) {
      const diff = mediaDiff / frameDiff;
      if (diff && diff < 1 && continuous && video.playbackRate === 1 && document.hasFocus()) {
        fpsValues.push(diff);
        if (fpsValues.length > 50) fpsValues.shift();
        const avgFps = Math.round(1 / (fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length));
        displayElement.textContent = `FPS: ${avgFps}, certainty: ${fpsValues.length * 2}%`;
      }
    }
    continuous = true;
    lastMediaTime = mediaTime;
    lastFrameNum = presentedFrames;
    video.requestVideoFrameCallback(updateFPS);
  }

  video.addEventListener("seeked", () => {
    fpsValues.pop();
    continuous = false;
  });
  video.requestVideoFrameCallback(updateFPS);
}
