(function () {
  "use strict";

  // One transparent GPU layer for each note-head pass. Clip-space W comes
  // directly from the camera, so texture coordinates are perspective-correct.
  // The main renderer retains Canvas geometry and a non-WebGL fallback.
  const layers = new WeakMap();
  function createLayer() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false });
    if (!gl || typeof gl.getParameter(gl.VERSION) !== "string") return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error("Surface shader compilation failed"); }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `
      attribute vec4 a_position;
      attribute vec2 a_uv;
      varying vec2 v_uv;
      void main() { gl_Position = a_position; v_uv = a_uv; }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_opacity;
      varying vec2 v_uv;
      void main() { gl_FragColor = texture2D(u_texture, v_uv) * u_opacity; }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, 6 * 6 * 4, gl.DYNAMIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position"), uv = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 24, 16);
    gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
    const opacity = gl.getUniformLocation(program, "u_opacity");
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const textures = new Map(), vertices = new Float32Array(36);
    let lost = false, count = 0, slowCopies = 0;
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); lost = true; textures.clear(); });
    return {
      begin(width, height, ratio) {
        if (lost || gl.isContextLost()) return false;
        if (slowCopies >= 6) {
          for (const texture of textures.values()) gl.deleteTexture(texture);
          textures.clear();
          canvas.width = canvas.height = 1;
          lost = true;
          return false;
        }
        const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); count = 0;
        return true;
      },
      draw(image, quad, width, height, region, alpha = 1) {
        let texture = textures.get(image);
        if (!texture) {
          texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          if (textures.size >= 192) { const oldest = textures.keys().next().value; gl.deleteTexture(textures.get(oldest)); textures.delete(oldest); }
          textures.set(image, texture);
        } else gl.bindTexture(gl.TEXTURE_2D, texture);
        const left = region ? region[0] / image.width : 0, top = region ? region[1] / image.height : 0;
        const right = region ? (region[0] + region[2]) / image.width : 1, bottom = region ? (region[1] + region[3]) / image.height : 1;
        const indices = [0, 1, 2, 0, 2, 3], coords = [[left, top], [right, top], [right, bottom], [left, bottom]];
        gl.uniform1f(opacity, alpha);
        for (let i = 0; i < 6; i++) {
          const index = indices[i], point = quad[index], w = point.cameraDepth / 1024, offset = i * 6;
          vertices[offset] = (point.x / width * 2 - 1) * w;
          vertices[offset + 1] = (1 - point.y / height * 2) * w;
          vertices[offset + 2] = 0; vertices[offset + 3] = w;
          vertices[offset + 4] = coords[index][0]; vertices[offset + 5] = coords[index][1];
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices); gl.drawArrays(gl.TRIANGLES, 0, 6); count++;
      },
      end(context, width, height) {
        if (!count) return;
        const start = performance.now();
        context.drawImage(canvas, 0, 0, width, height);
        // Some browser/driver combinations synchronously read back the entire
        // framebuffer here, several times per frame. Use Canvas projection
        // after sustained slow copies; ignore isolated compilation/GC stalls.
        slowCopies = Math.max(0, slowCopies + (performance.now() - start >= 3 ? 1 : -1));
      }
    };
  }

  function begin(context, field) {
    if (!layers.has(context)) {
      let layer = null;
      try { layer = createLayer(); } catch (_) { /* Unsupported driver: retain Canvas projection. */ }
      layers.set(context, layer);
    }
    const layer = layers.get(context), matrix = context.getTransform?.();
    const ratio = Math.hypot(matrix?.a || 1, matrix?.b || 0);
    return layer?.begin(field.width, field.height, ratio) ? layer : null;
  }
  window.UgcSurfaces = Object.freeze({ begin });
})();
