import { getExerciseVideo } from './exercise-videos.js';

export function createExerciseVideo(exercise, { document = globalThis.document, findVideo = getExerciseVideo, isOnline = () => globalThis.navigator?.onLine !== false } = {}) {
  const video = findVideo(exercise);
  if (!video) return null;
  const details = document.createElement('details'); details.className = 'exercise-video';
  const summary = document.createElement('summary');
  const icon = document.createElement('span'); icon.className = 'exercise-video-icon';
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span'); label.textContent = 'Uitlegvideo van oefening';
  summary.append(icon, label);
  const content = document.createElement('div'); content.className = 'exercise-video-content';
  details.append(summary, content);
  details.addEventListener('toggle', () => {
    // Dichtklappen stopt ook de speler. Voor openvouwen is er geen YouTube-verzoek.
    if (!details.open) { content.replaceChildren(); return; }
    if (content.children.length) return;
    const frame = document.createElement('div'); frame.className = 'exercise-video-frame';
    if (isOnline()) {
      const player = document.createElement('iframe');
      player.src = `https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&rel=0`;
      player.title = `Uitleg: ${video.exercise}`; player.loading = 'lazy';
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      player.allow = 'encrypted-media; picture-in-picture; fullscreen'; player.allowFullscreen = true;
      frame.append(player);
    } else {
      const message = document.createElement('p'); message.textContent = 'De video heeft internet nodig.';
      frame.append(message);
    }
    const source = document.createElement('p'); source.className = 'video-source'; source.textContent = 'Bron: ';
    const link = document.createElement('a'); link.textContent = `${video.source} · YouTube`;
    link.href = `https://www.youtube.com/watch?v=${video.id}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(link); content.append(frame, source);
  });
  return details;
}

export function stopExerciseVideos(container) {
  for (const details of container.querySelectorAll('.exercise-video')) {
    details.open = false;
    details.querySelector('.exercise-video-content').replaceChildren();
  }
}
