(function () {
  "use strict";
  const width = 1920, height = 1080, fps = 60, sampleRate = 48000;
  let libraryPromise;

  function loadLibrary() {
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "vendor/mediabunny.min.js";
        script.onload = () => resolve(window.Mediabunny);
        script.onerror = () => {
          script.remove();
          libraryPromise = null;
          reject(new Error("Could not load the MP4 encoder. Reload the viewer and try again."));
        };
        document.head.append(script);
      });
    }
    return libraryPromise;
  }

  async function prepareAudio(job, signal) {
    const {chart, speed, hitsounds, pitch, volume, song, stretch} = job;
    const decoder = new OfflineAudioContext(2, 1, sampleRate);
    const events = hitsounds ? chart.bgmEvents.concat(chart.keyEvents) : chart.bgmEvents;
    const buffers = new Map();
    let end = chart.duration;
    for (const event of events) {
      signal.throwIfAborted();
      if (!buffers.has(event.object)) {
        let buffer;
        if (event.maiSound) buffer = MaiAudio.createBuffer(decoder, event.object);
        else {
          if (!song) throw new Error("Open the song folder to include the track in the export.");
          buffer = await decoder.decodeAudioData(await song.arrayBuffer());
          if (!pitch && speed !== 1) buffer = stretch(buffer, speed, decoder);
        }
        buffers.set(event.object, buffer);
      }
      const buffer = buffers.get(event.object);
      const rate = !event.maiSound && pitch ? speed : 1;
      const length = event.audioDuration > 0 ? event.audioDuration / speed : buffer.duration / rate;
      end = Math.max(end, event.time + length * speed);
    }

    const renderChart = { ...chart, playbackEnd: end };
    const finish = Math.max(end, MaiClear.end(renderChart));
    const intro = MaiIntro.duration;
    // Give the final result a second on screen after the reveal has settled.
    const frames = Math.ceil((intro + finish / speed + 1) * fps);
    const mix = new OfflineAudioContext(2, frames * (sampleRate / fps), sampleRate);
    const main = mix.createGain(), effect = mix.createGain();
    main.gain.value = volume;
    effect.gain.value = 0.75;
    effect.connect(main); main.connect(mix.destination);
    for (const event of events) {
      const source = mix.createBufferSource();
      source.buffer = buffers.get(event.object);
      source.loop = Boolean(event.loop);
      source.playbackRate.value = !event.maiSound && pitch ? speed : 1;
      source.connect(event.maiSound ? effect : main);
      const at = intro + event.time / speed;
      source.start(at, (event.audioOffset || 0) / (!pitch && !event.maiSound ? speed : 1));
      if (event.audioDuration > 0) source.stop(at + event.audioDuration / speed);
    }
    signal.throwIfAborted();
    const audio = await mix.startRendering();
    return { chart: renderChart, frames, audio, finish };
  }

  function waitMedia(media, event, action, signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error("Background video did not respond.")), 20000);
      const ready = () => finish(), failed = () => finish(new Error("Cannot decode the background video."));
      const aborted = () => finish(signal.reason);
      function finish(error) {
        clearTimeout(timer);
        media.removeEventListener(event, ready); media.removeEventListener("error", failed);
        signal.removeEventListener("abort", aborted);
        if (error) reject(error); else resolve();
      }
      media.addEventListener(event, ready);
      media.addEventListener("error", failed);
      signal.addEventListener("abort", aborted, {once:true});
      try { action(); } catch (error) { finish(error); }
    });
  }

  // Use sequential decoding where available. Some browser-playable movies
  // require the native media element; seek that independent element per frame.
  async function openMovie(lib, file, offset, signal) {
    const input = new lib.Input({ source: new lib.BlobSource(file), formats: lib.ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (track && await track.canDecode()) {
        const start = await track.getFirstTimestamp();
        const sink = new lib.CanvasSink(track, {width:1080, height:1080, fit:"cover", poolSize:3});
        const iter = sink.canvases(start + offset);
        let current = await sink.getCanvas(start + offset);
        let next = (await iter.next()).value;
        return {
          async at(seconds) {
            while (next && next.timestamp <= start + seconds + 0.000001) {
              signal.throwIfAborted();
              current = next; next = (await iter.next()).value;
            }
            return current && { image:current.canvas, time:current.timestamp };
          },
          async close() { try { await iter.return(); } finally { input.dispose(); } }
        };
      }
    } catch (error) {
      signal.throwIfAborted();
      // The element can also handle containers outside the demuxer's formats.
    } finally {
      if (signal.aborted) input.dispose();
    }
    input.dispose();
    const movie = document.createElement("video"), url = URL.createObjectURL(file);
    const close = () => { movie.pause(); movie.removeAttribute("src"); movie.load(); URL.revokeObjectURL(url); };
    movie.preload = "auto"; movie.muted = true; movie.playsInline = true;
    try { await waitMedia(movie, "loadeddata", () => { movie.src = url; }, signal); }
    catch (error) { close(); throw error; }
    return {
      async at(seconds) {
        const time = Math.min(Math.max(0, movie.duration - 0.001), seconds);
        if (Math.abs(movie.currentTime - time) > 0.0001) {
          await waitMedia(movie, "seeked", () => { movie.currentTime = time; }, signal);
        }
        return { image: movie, time:movie.currentTime };
      },
      close
    };
  }

  async function selectVideoEncoder(lib, signal) {
    const bitrate = 32_000_000;
    for (const hardwareAcceleration of ["prefer-hardware", "no-preference"]) {
      for (const codec of ["avc", "vp9", "av1"]) {
        signal.throwIfAborted();
        const config = {codec, bitrate, hardwareAcceleration};
        if (await lib.canEncodeVideo(codec, {width, height, frameRate:fps, bitrate, hardwareAcceleration})) {
          return config;
        }
      }
    }
    throw new Error("This browser has no supported 1080p video encoder. Try a current Firefox, Chrome or Edge.");
  }

  async function render(job, signal, progress) {
    progress(0, "Checking encoders");
    const lib = await loadLibrary();
    const videoConfig = await selectVideoEncoder(lib, signal);
    const codecName = {avc:"H.264", vp9:"VP9", av1:"AV1"}[videoConfig.codec];
    const preference = videoConfig.hardwareAcceleration === "prefer-hardware" ? "GPU preferred" : "browser default";
    const rendering = `Rendering · ${codecName} · ${videoConfig.bitrate / 1_000_000} Mbps target (${preference})`;
    let audioCodec;
    for (const codec of ["aac", "opus", "pcm-s16"]) {
      if (await lib.canEncodeAudio(codec, {numberOfChannels:2, sampleRate, bitrate:192000})) { audioCodec = codec; break; }
    }
    if (!audioCodec) throw new Error("No MP4 audio encoder is available in this browser.");
    progress(0, "Preparing audio");
    const {chart, frames, audio, finish} = await prepareAudio(job, signal);
    signal.throwIfAborted();
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", {alpha:false});
    const parts = [];
    const output = new lib.Output({
      format:new lib.Mp4OutputFormat({fastStart:"fragmented"}),
      target:new lib.AppendOnlyStreamTarget(new WritableStream({ write(bytes) { parts.push(new Blob([bytes])); } }))
    });
    const video = new lib.CanvasSource(canvas, {...videoConfig, keyFrameInterval:2});
    const sound = new lib.AudioBufferSource({codec:audioCodec, bitrate:192000});
    const movieEvent = chart.bgaEvents.find(event => event.object === "video");
    let jacket, movie;
    try {
      output.addVideoTrack(video, {frameRate:fps});
      output.addAudioTrack(sound);
      if (job.cover) jacket = await createImageBitmap(job.cover);
      if (movieEvent) {
        if (!job.video) throw new Error("The chart's background video is missing.");
        progress(0, "Preparing video");
        movie = await openMovie(lib, job.video, movieEvent.mediaOffset || 0, signal);
      }
      await output.start();
      const chunkFrames = Math.min(frames, fps);
      let audioBlock = new AudioBuffer({numberOfChannels:2, sampleRate, length:chunkFrames * sampleRate / fps});
      let lastYield = performance.now();
      for (let frame = 0; frame < frames; frame++) {
        signal.throwIfAborted();
        const elapsed = frame / fps - MaiIntro.duration;
        const time = elapsed < 0 ? elapsed : Math.min(finish, elapsed * job.speed);
        let background = movie ? null : jacket, videoTime;
        if (movie && time >= movieEvent.time && time <= MaiClear.start(chart) + 0.24) {
          const sample = await movie.at(time - movieEvent.time + (movieEvent.mediaOffset || 0));
          background = sample?.image;
          videoTime = sample?.time;
        }
        MaiRenderer.draw({...job.field, chart, context, width, height, time, jacket,
          maiBackground:background, videoFrameTime:videoTime, outerColor:"#000000", bottomInset:0, infoScale:1.6});
        await video.add(frame / fps, 1 / fps);
        if ((frame + 1) % fps === 0 || frame === frames - 1) {
          const offset = Math.floor(frame / fps) * sampleRate;
          const length = Math.min(sampleRate, audio.length - offset);
          if (audioBlock.length !== length) audioBlock = new AudioBuffer({numberOfChannels:2, sampleRate, length});
          for (let ch = 0; ch < 2; ch++) audioBlock.copyToChannel(audio.getChannelData(ch).subarray(offset, offset + length), ch);
          await sound.add(audioBlock);
        }
        if (performance.now() - lastYield > 65) {
          progress((frame + 1) / frames, rendering);
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYield = performance.now();
        }
      }
      signal.throwIfAborted();
      progress(1, "Finishing MP4");
      video.close(); sound.close();
      await output.finalize();
      signal.throwIfAborted();
      return new Blob(parts, {type:"video/mp4"});
    } finally {
      try { if (output.state === "started") await output.cancel(); }
      finally { jacket?.close(); await movie?.close(); }
    }
  }

  window.MaiExport = {render};
})();
