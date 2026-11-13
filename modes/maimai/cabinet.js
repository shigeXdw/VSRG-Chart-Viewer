(function () {
  "use strict";
  const root = new URL("../../", document.currentScript.src);
  const presets = {
    left: {label:"Left angle", width:1080, height:1920, fov:17, position:[-153,51,213], target:[-23.3031,12.5,3]},
    right: {label:"Right angle", width:1080, height:1920, fov:17, position:[153,51,213], target:[23.3031,12.5,3]},
    center: {label:"Centered station", width:1080, height:1920, fov:18.5, position:[-27.3031,51,253], target:[-27.3031,12.5,3]},
    both: {label:"Both centered", width:1920, height:1080, fov:17, position:[0,55,290], target:[0,12,3]},
    angled: {label:"Both angled", width:1920, height:1080, fov:17, position:[-105,65,278], target:[0,12,3]}
  };
  let enabled = false,
    loading,
    view,
    settings;

  function script(path) {
    return new Promise((resolve, reject) => {
      const element = document.createElement("script");
      element.src = new URL(path, root).href;
      element.onload = resolve;
      element.onerror = () => {
        element.remove();
        reject(new Error("Could not load " + path));
      };
      document.head.append(element);
    });
  }
  async function open(options) {
    settings = options;
    enabled = true;
    if (view) {
      view.show();
      return;
    }
    if (loading) return;
    const status = document.createElement("div");
    status.className = "machine-model-status";
    status.textContent = "Loading 3D cabinet…";
    options.host.append(status);
    loading = (async () => {
      await Promise.all([
        window.MaiThree || script("vendor/three.min.js?v=3"),
        window.MaiCabinetMesh || script("assets/maimai-cabinet/mesh.js?v=12")
      ]);
      if (enabled) {
        view = build(settings);
        view.show();
      }
      status.remove();
    })()
      .catch((error) => {
        status.textContent = "3D cabinet unavailable. " + error.message;
      })
      .finally(() => {
        loading = null;
      });
  }
  function build({ host, shell, menu, canvas, monitor, press, buttons, exportOptions }) {
    const T = window.MaiThree;
    const scene = new T.Scene(),
      uiScene = new T.Scene();
    const camera = new T.PerspectiveCamera(33, 1, 1, 650);
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setPixelRatio(exportOptions ? 1 : Math.min(devicePixelRatio || 1, 1.75));
    renderer.domElement.className = "machine-model-canvas";
    renderer.domElement.setAttribute(
      "aria-label",
      "3D DX cabinet. Drag to rotate, right-drag or Shift-drag to pan, scroll to zoom."
    );
    const css = new T.CSS3DRenderer();
    css.domElement.className = "machine-model-screens";
    host.append(renderer.domElement, css.domElement);
    const controls = new T.OrbitControls(camera, host);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    controls.enableDamping = !reducedMotion.matches;
    controls.dampingFactor = 0.09;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.8;
    controls.minDistance = 35;
    controls.maxDistance = 430;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.65;
    controls.target.set(0, 0, 0);
    scene.add(new T.HemisphereLight(0xb8d4ff, 0x252737, 0.9));
    const key = new T.DirectionalLight(0xe8edff, 1.35);
    key.position.set(-90, 110, 150);
    scene.add(key);
    const fill = new T.DirectionalLight(0xa4c6ff, 0.65);
    fill.position.set(90, 20, -100);
    scene.add(fill);
    function geometry(data) {
      function bytes(value) {
        return fflate.unzlibSync(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
      }
      const positions = bytes(data.vertices),
        indices = bytes(data.indices);
      const normals = bytes(data.normals);
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.BufferAttribute(
          new Float32Array(positions.buffer, positions.byteOffset, positions.byteLength / 4),
          3
        )
      );
      g.setAttribute(
        "normal",
        new T.BufferAttribute(
          new Int16Array(normals.buffer, normals.byteOffset, normals.byteLength / 2),
          3,
          true
        )
      );
      g.setIndex(
        new T.BufferAttribute(
          new Uint32Array(indices.buffer, indices.byteOffset, indices.byteLength / 4),
          1
        )
      );
      for (const group of data.groups) g.addGroup(...group);
      if (data.uv) {
        const uv = bytes(data.uv);
        g.setAttribute(
          "uv",
          new T.BufferAttribute(new Uint16Array(uv.buffer, uv.byteOffset, uv.byteLength / 2), 2, true)
        );
      }
      return g;
    }
    // Satin-gloss molded shell; keep it dielectric with restrained highlights.
    const plastic = new T.MeshStandardMaterial({ color: 0xe2e1df, roughness: 0.26, metalness: 0 });
    const dark = new T.MeshStandardMaterial({ color: 0x11151e, roughness: 0.64 });
    const ringPlastic = new T.MeshStandardMaterial({ color: 0xa49ca7, roughness: 0.18, metalness: 0 });
    const buttonBake = document.createElement("canvas");
    buttonBake.width = 256;
    buttonBake.height = 128;
    const buttonPixels = fflate.unzlibSync(Uint8Array.from(atob(MaiCabinetMesh.buttonLightmap), c => c.charCodeAt(0)));
    buttonBake.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buttonPixels), 256, 128), 0, 0);
    const buttonTexture = new T.CanvasTexture(buttonBake);
    buttonTexture.generateMipmaps = false;
    buttonTexture.minFilter = T.LinearFilter;
    const wallColors = Array.from({ length: 8 }, () => new T.Color(0));
    const lampMaterials = Array.from(
      { length: 8 },
      () =>
        new T.MeshStandardMaterial({
          color: 0xaaa2ad,
          roughness: 0.14,
          metalness: 0,
          emissiveIntensity: 1.5
        })
    );
    // Shared precomputed diffuser pattern: LEDs behind the wall, not a solid
    // emissive stripe. The low scattering tail softens the molded corner.
    for (const [index, material] of lampMaterials.entries()) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.buttonDiffusion = { value: buttonTexture };
        shader.uniforms.wallLight = { value: wallColors[index] };
        shader.vertexShader = "varying vec3 lampPosition, lampNormal;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\nlampPosition = position; lampNormal = normal;");
        shader.fragmentShader = "uniform sampler2D buttonDiffusion;\nuniform vec3 wallLight;\nvarying vec3 lampPosition, lampNormal;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `
          #include <emissivemap_fragment>
          float radius = length(lampPosition.xy);
          float a = mod(atan(lampPosition.x, lampPosition.y) + 6.28318530718, 0.78539816339) - 0.3926990817;
          float transmitted = texture2D(buttonDiffusion, vec2((radius * sin(a) + 5.0) / 10.0,
            (lampPosition.z + 0.15) / 1.2)).r;
          // Regular hits illuminate the whole diffuser, including its sides.
          // A broad internal-light lobe retains the plastic's molded shape.
          float interior = texture2D(buttonDiffusion, vec2((radius * sin(a) + 5.0) / 10.0, 0.46)).r;
          float capDiffusion = 0.65 + 0.7 * interior * interior
            * exp(-pow((radius - 17.2) / 2.8, 2.0));
          totalEmissiveRadiance *= capDiffusion;
          float outward = max(0.0, dot(normalize(lampNormal), vec3(normalize(lampPosition.xy), 0.0)));
          float wall = exp(-pow((radius - 19.46) / 0.42, 2.0)) * outward;
          float scattered = 0.055 * exp(-pow((radius - 19.3) / 0.85, 2.0));
          totalEmissiveRadiance += wallLight * 3.2 * transmitted * transmitted * (wall + scattered);
          // Light inside the hollow cap spreads beneath its top surface too.
          // Let it decay inward from the outer wall without a painted boundary.
          float inwardDistance = max(0.0, 19.4 - radius);
          float cavityBleed = 0.48 * exp(-inwardDistance / 2.1)
            * (0.3 + 0.7 * max(0.0, normalize(lampNormal).z));
          totalEmissiveRadiance += wallLight * interior * interior * cavityBleed;
        `);
      };
    }
    const lampColors = lampMaterials.map((material) => material.emissive);
    const buttonSpillShader = `
      uniform sampler2D buttonDiffusion;
      uniform vec3 cabinetLamps[8], buttonLamps[8];
      vec3 buttonSpill(vec2 p) {
        float angle = mod(atan(p.x, p.y) + 6.28318530718, 6.28318530718);
        float sector = floor(angle / 0.78539816339);
        float radius = length(p);
        vec3 spill = vec3(0.0);
        // Both sources reach across side gaps. Wall light decays from the
        // outer rim; full-cap light decays from the entire cap perimeter.
        for (int neighbor = -1; neighbor <= 1; neighbor++) {
          int index = int(mod(sector + float(neighbor) + 8.0, 8.0));
          float delta = angle - (float(index) + 0.5) * 0.78539816339;
          vec2 capLocal = vec2(radius * sin(delta), radius * cos(delta) - 17.2);
          float wallSpill = texture2D(buttonDiffusion,
            vec2((capLocal.x + 7.0) / 14.0, (capLocal.y - 2.2 + 7.0) / 15.0)).g;
          spill += cabinetLamps[index] * wallSpill * wallSpill;
          vec2 outside = max(abs(capLocal) - vec2(2.7, 2.1), 0.0);
          float halo = exp(-dot(outside, outside) / 2.56);
          spill += buttonLamps[index] * halo * 0.28;
        }
        return spill;
      }
    `;
    ringPlastic.onBeforeCompile = (shader) => {
      shader.uniforms.buttonDiffusion = { value: buttonTexture };
      shader.uniforms.cabinetLamps = { value: wallColors };
      shader.uniforms.buttonLamps = { value: lampColors };
      shader.vertexShader = "varying vec3 ringPosition, ringNormal;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nringPosition = position; ringNormal = normal;");
      shader.fragmentShader = "varying vec3 ringPosition, ringNormal;\n" + buttonSpillShader + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `
        #include <emissivemap_fragment>
        totalEmissiveRadiance += buttonSpill(ringPosition.xy) * 1.2 * max(0.0, normalize(ringNormal).z);
      `);
    };
    const rimColor = new T.Color(0x72bcff);
    const canopyColor = new T.Color(0xff9652);
    const sideColor = new T.Color(0xff79c5);
    // An original perforated diffuser face, mapped onto the existing side pod.
    // This is a tiny static texture; no new lights, transparent shells or bloom.
    const grille = document.createElement("canvas");
    grille.width = grille.height = 128;
    const grilleContext = grille.getContext("2d");
    grilleContext.fillStyle = "#eff7f6";
    grilleContext.fillRect(0, 0, 128, 128);
    grilleContext.fillStyle = "#687c84";
    for (let row = 0; row < 17; row++) for (let col = 0; col < 17; col++) {
      const x = col * 8 + (row % 2) * 4, y = row * 8;
      grilleContext.beginPath();
      grilleContext.arc(x, y, 1.15, 0, Math.PI * 2);
      grilleContext.fill();
    }
    const grilleTexture = new T.CanvasTexture(grille);
    grilleTexture.colorSpace = T.SRGBColorSpace;
    const lightingCanvas = document.createElement("canvas");
    lightingCanvas.width = lightingCanvas.height = 256;
    const lightingBytes = fflate.unzlibSync(
      Uint8Array.from(atob(MaiCabinetMesh.lightmap), (c) => c.charCodeAt(0))
    );
    lightingCanvas
      .getContext("2d")
      .putImageData(new ImageData(new Uint8ClampedArray(lightingBytes), 256, 256), 0, 0);
    const lightingTexture = new T.CanvasTexture(lightingCanvas);
    lightingTexture.generateMipmaps = false;
    lightingTexture.minFilter = T.LinearFilter;
    // A small baked falloff texture avoids shadow maps, full-screen bloom,
    // per-button lights, and artifacts from the CAD model's large triangles.
    function litBody(material, region = 0) {
      const result = material.clone();
      if (region === 2) result.roughness = 0.38; // Preserve the canopy diffuser finish.
      result.onBeforeCompile = (shader) => {
        shader.uniforms.cabinetRegion = { value: region };
        shader.uniforms.cabinetRim = { value: rimColor };
        shader.uniforms.cabinetCanopy = { value: canopyColor };
        shader.uniforms.cabinetSide = { value: sideColor };
        shader.uniforms.cabinetGrille = { value: grilleTexture };
        shader.uniforms.cabinetLamps = { value: wallColors };
        shader.uniforms.buttonLamps = { value: lampColors };
        shader.uniforms.cabinetLightmap = { value: lightingTexture };
        shader.uniforms.buttonDiffusion = { value: buttonTexture };
        shader.vertexShader = "varying vec3 cabinetPosition, cabinetNormal;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          cabinetPosition = position;
          cabinetNormal = normal;
        `
        );
        shader.fragmentShader =
          `
          uniform float cabinetRegion;
          uniform vec3 cabinetRim, cabinetCanopy, cabinetSide;
          uniform sampler2D cabinetLightmap, cabinetGrille;
          varying vec3 cabinetPosition, cabinetNormal;
        ` + buttonSpillShader + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `
          #include <color_fragment>
          vec3 cp = cabinetPosition;
          vec3 cn = normalize(cabinetNormal);
          vec2 lampUV = vec2(cp.x - (cp.x < 0.0 ? -27.3031 : 27.3031),
            (cp.y - 6.2026) * 0.9417419 - (cp.z - 8.0824) * 0.3363364) / 60.0 + 0.5;
          vec4 lightmap = texture2D(cabinetLightmap, lampUV);
          float facing = max(0.0, dot(cn, vec3(0.0, 0.3363364, 0.9417419)));
          float skinDepth = (cp.y - 6.2026) * 0.3363364 + (cp.z - 8.0824) * 0.9417419;
          // Internal light wraps around molded curves; it isn't front-lit paint.
          float diffusion = (0.38 + 0.62 * facing) * smoothstep(-3.0, 0.5, skinDepth);
          // The converter assigns the complete molded canopy and its inset
          // speaker face separately. No spatial mask cuts across either part.
          float faceHeight = dot(cp.yz, vec2(0.663, 0.749));
          float speaker = step(2.5, cabinetRegion);
          float canopyShell = step(1.5, cabinetRegion) * (1.0 - speaker);
          // LED diffusion stays within the plastic, measured from its lip.
          float canopyStrip = exp(-pow((faceHeight - 34.2) / 5.5, 2.0));
          float canopy = canopyShell * (0.45 + 0.55 * canopyStrip)
            * (0.75 + 0.25 * max(0.0, cn.z));
          float rear = 1.0 - smoothstep(-16.0, -14.0, cp.z);
          float support = max(smoothstep(42.5, 44.0, cp.y)
            * (1.0 - smoothstep(-10.0, -9.0, cp.z)),
            step(49.501, abs(cp.x)) * step(41.0, cp.y)
            * (1.0 - smoothstep(-9.0, -8.8, cp.z)));
          diffuseColor.rgb *= mix(1.0, lightmap.b, facing);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.009, 0.012, 0.018), max(speaker, max(rear, support)));
          // Transmission dominates the lit diffuser. Keeping a full white
          // diffuse response underneath would wash every LED color to cream.
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.17, 0.19), canopyShell * 0.9);
          // The circular pods face sideways along +/-X. Model-space masks
          // follow their actual molded surfaces, including the outer wall.
          vec2 podPosition = cp.yz - vec2(36.3555, -9.095);
          float podRadius = length(podPosition);
          float podMask = smoothstep(49.8, 51.0, abs(cp.x)) * (1.0 - smoothstep(8.8, 9.3, podRadius));
          float podFacing = smoothstep(0.2, 0.8, abs(cn.x));
          float podFace = (1.0 - smoothstep(4.55, 4.9, podRadius)) * podFacing;
          float podRing = exp(-pow((podRadius - 6.45) / 0.25, 2.0)) * podFacing;
          float podBand = exp(-pow((podRadius - 7.65) / 0.78, 4.0));
          vec3 podGrille = texture2D(cabinetGrille, podPosition / 9.8 + 0.5).rgb;
          vec3 podPlastic = mix(vec3(0.026, 0.034, 0.047), podGrille * 0.8, podFace);
          podPlastic = mix(podPlastic, vec3(0.62, 0.65, 0.69), podBand * 0.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, podPlastic, podMask);
        `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `
          #include <emissivemap_fragment>
          vec3 milkRim = mix(cabinetRim, vec3(0.88, 0.95, 1.0), smoothstep(0.5, 1.0, lightmap.r) * 0.4);
          vec3 milkCanopy = mix(cabinetCanopy, vec3(1.0, 0.96, 0.87), canopyStrip * 0.06);
          vec2 ringPosition = (lampUV - 0.5) * 60.0;
          totalEmissiveRadiance += milkRim * lightmap.r * diffusion * 0.8
            + milkCanopy * canopy * 1.1
            + buttonSpill(ringPosition) * facing * 1.4
            + podMask * (vec3(0.56, 0.94, 1.0) * podRing * 2.0
              + cabinetSide * podBand * 1.4 + podGrille * podFace * 0.55);
        `
        );
      };
      return result;
    }
    const body = new T.Mesh(geometry(MaiCabinetMesh.body), [litBody(plastic), litBody(dark), litBody(plastic, 2), litBody(dark, 3)]);
    scene.add(body);
    const occluders = [body];
    scene.add(new T.Mesh(geometry(MaiCabinetMesh.console), [plastic, dark]));
    const footGeometry = geometry(MaiCabinetMesh.foot);
    for (const x of [-47, 47])
      for (const z of [-13, 12]) {
        const foot = new T.Mesh(footGeometry, [plastic, dark]);
        foot.position.set(x, -60.3, z);
        scene.add(foot);
      }
    // Each material belongs to one actual raised cap in the source mesh.
    const ringMaterials = [ringPlastic, ...lampMaterials];
    const ringGeometry = geometry(MaiCabinetMesh.ring);
    const buttonRings = [],
      surfaces = [];
    const angle = -Math.atan2(0.3363364, 0.9417419);
    const normal = new T.Vector3(0, 0.3363364, 0.9417419);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = T.LinearFilter;
    texture.generateMipmaps = false;
    const displayMaterial = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
    // Upload explicit RGBA pixels for the export monitor. This avoids relying
    // on offscreen 2D-canvas / WebGL interop while the live cabinet also renders.
    const monitorTexture = exportOptions ? new T.DataTexture(
      new Uint8Array(exportOptions.monitorCanvas.width * exportOptions.monitorCanvas.height * 4),
      exportOptions.monitorCanvas.width, exportOptions.monitorCanvas.height
    ) : null;
    if (monitorTexture) {
      monitorTexture.colorSpace = T.SRGBColorSpace;
      monitorTexture.minFilter = monitorTexture.magFilter = T.LinearFilter;
      monitorTexture.flipY = true;
      monitorTexture.generateMipmaps = false;
    }
    const screenMeshes = [],
      spillLights = [];
    const sample = document.createElement("canvas");
    sample.width = sample.height = 16;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    let lastSample = 0,
      samplingBlocked = false;
    const spillColor = new T.Color();
    function mirror(source) {
      const copies = new WeakMap();
      function duplicate(node) {
        const copy = node.cloneNode(false);
        copies.set(node, copy);
        if (copy.nodeType === Node.ELEMENT_NODE && copy.id) {
          copy.dataset.sourceId = copy.id;
          copy.removeAttribute("id");
        }
        for (const child of node.childNodes) copy.appendChild(duplicate(child));
        return copy;
      }
      const copy = duplicate(source);
      copy.setAttribute("aria-hidden", "true");
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const target = copies.get(mutation.target);
          if (!target) continue;
          if (mutation.type === "childList") {
            target.replaceChildren(...Array.from(mutation.target.childNodes, duplicate));
          } else if (mutation.type === "characterData") target.nodeValue = mutation.target.nodeValue;
          else if (mutation.attributeName !== "id") {
            const value = mutation.target.getAttribute(mutation.attributeName);
            if (value === null) target.removeAttribute(mutation.attributeName);
            else target.setAttribute(mutation.attributeName, value);
          }
        }
      }).observe(source, { subtree: true, childList: true, attributes: true, characterData: true });
      return copy;
    }
    const openingMaterial = new T.MeshBasicMaterial({
      color: 0x000000,
      opacity: 0,
      blending: T.NoBlending,
      depthWrite: true,
      toneMapped: false
    });
    // Short, event-driven screen wipes; no extra render target or bloom pass.
    const transitionMaterial = new T.MeshBasicMaterial({
      color: 0xe4f8ef, transparent: true, opacity: 0, depthWrite: false, toneMapped: false
    });
    const transitionScreens = [];
    let transitionStart = -Infinity;
    function surface(element, className, center, physicalWidth, pixelWidth, pixelHeight, depth = 0.12) {
      const wrapper = document.createElement("div");
      wrapper.className = className;
      wrapper.style.width = pixelWidth + "px";
      wrapper.style.height = pixelHeight + "px";
      wrapper.append(element);
      const object = new T.CSS3DObject(wrapper);
      object.position.copy(center).addScaledVector(normal, depth);
      object.rotation.x = angle;
      object.scale.setScalar(physicalWidth / pixelWidth);
      // CSS screens sit behind WebGL. Write a transparent, depth-tested opening
      // at each glass surface; nearer cabinet geometry then covers it normally.
      const isMenu = className === "machine-model-menu";
      const opening = new T.Mesh(
        isMenu
          ? new T.CircleGeometry(14.39, 128)
          : new T.PlaneGeometry(physicalWidth, (physicalWidth * pixelHeight) / pixelWidth),
        openingMaterial
      );
      opening.position.copy(object.position);
      opening.rotation.copy(object.rotation);
      opening.renderOrder = -1;
      scene.add(opening);
      const wipe = new T.Mesh(opening.geometry, transitionMaterial);
      wipe.position.copy(object.position).addScaledVector(normal, 0.012);
      wipe.rotation.copy(object.rotation);
      wipe.visible = false;
      wipe.renderOrder = 5;
      scene.add(wipe);
      transitionScreens.push(wipe);
      object.userData.opening = opening;
      wrapper.style.pointerEvents = "none";
      uiScene.add(object);
      surfaces.push(object);
      return object;
    }
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 256;
    const glowContext = glowCanvas.getContext("2d");
    const glowGradient = glowContext.createRadialGradient(128, 128, 0, 128, 128, 128);
    glowGradient.addColorStop(0, "#ffffff00");
    glowGradient.addColorStop(0.85, "#ffffff00");
    glowGradient.addColorStop(0.9, "#e8f5ff70");
    glowGradient.addColorStop(0.94, "#e8f5ff30");
    glowGradient.addColorStop(1, "#ffffff00");
    glowContext.fillStyle = glowGradient;
    glowContext.fillRect(0, 0, 256, 256);
    const glowMaterial = new T.MeshBasicMaterial({
      map: new T.CanvasTexture(glowCanvas),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.55
    });
    // Seat the glass behind the inner lip (ring-local Z=-0.148), not
    // behind the raised button plate. Its radius overlaps the 14.318 lip
    // so the bezel hides the screen edge even at grazing viewing angles.
    const screenDepth = 1.68;
    for (const [index, x] of [-27.3031, 27.3031].entries()) {
      const center = new T.Vector3(x, 6.2026, 8.0824);
      const ring = new T.Mesh(ringGeometry, ringMaterials);
      ring.rotation.x = angle;
      ring.position.copy(center).addScaledVector(normal, 1.86);
      scene.add(ring);
      buttonRings.push(ring);
      const display = new T.Mesh(new T.CircleGeometry(14.39, 128), displayMaterial);
      display.position.copy(center).addScaledVector(normal, screenDepth);
      display.rotation.x = angle;
      scene.add(display);
      screenMeshes.push(display);
      const glow = new T.Mesh(new T.PlaneGeometry(45, 45), glowMaterial);
      glow.position.copy(center).addScaledVector(normal, 0.2);
      glow.rotation.x = angle;
      scene.add(glow);
      const spill = new T.PointLight(0xd9d4f1, 80, 65, 2);
      spill.position.copy(center).addScaledVector(normal, 18);
      scene.add(spill);
      spillLights.push(spill);
      if (exportOptions) {
        const top = new T.Mesh(new T.PlaneGeometry(29.43, 29.43 * 350 / 900),
          new T.MeshBasicMaterial({map:monitorTexture, toneMapped:false}));
        top.position.set(x, 35.1191, -2.2433).addScaledVector(normal, 0.12);
        top.rotation.x = angle;
        scene.add(top);
      } else {
        // A 68% inset screen preserves the menu's container-relative typography.
        const content = index ? mirror(menu) : menu;
        surface(content, "machine-model-menu", center, 28.78 / 0.68, 900, 900, screenDepth);
        const top = index ? mirror(monitor) : monitor;
        surface(top, "machine-model-monitor", new T.Vector3(x, 35.1191, -2.2433), 29.43, 900, 350);
      }
    }
    let width = 0, height = 0, frame = 0, dirtyTexture = true;
    if (exportOptions) {
      const preset = presets[exportOptions.preset];
      controls.enabled = false;
      renderer.setClearColor(0x000000, 1);
      renderer.setSize(preset.width, preset.height);
      camera.aspect = preset.width / preset.height;
      camera.fov = preset.fov;
      camera.position.set(...preset.position);
      camera.lookAt(...preset.target);
      camera.updateProjectionMatrix();
      return {
        canvas: renderer.domElement,
        light(index, power, color, kind) {
          (kind === "wall" ? wallColors : lampColors)[index].set(color).multiplyScalar(power);
        },
        render(seconds, monitorPixels) {
          dirtyTexture = true;
          if (monitorPixels) {
            monitorTexture.image.data = monitorPixels.data;
            monitorTexture.needsUpdate = true;
          }
          renderScene(seconds * 1000);
          return renderer.domElement;
        },
        dispose() {
          controls.dispose();
          const geometries = new Set(), materials = new Set(), textures = new Set([
            texture, monitorTexture, buttonTexture, lightingTexture, grilleTexture
          ]);
          scene.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            if (object.material) for (const material of [].concat(object.material)) {
              materials.add(material);
              for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
            }
          });
          for (const item of [...geometries, ...materials, ...textures, openingMaterial, transitionMaterial]) item.dispose();
          renderer.dispose(); renderer.forceContextLoss(); host.replaceChildren();
        }
      };
    }

    const toolbar = document.createElement("div");
    toolbar.className = "machine-model-tools";
    const help = document.createElement("span");
    help.textContent = "Drag to rotate · Right-drag / Shift-drag to pan · Scroll to zoom";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset view";
    const attribution = document.createElement("a");
    attribution.href = "https://makerworld.com/en/models/1126413-maimaidx-style-model";
    attribution.target = "_blank";
    attribution.rel = "noopener";
    attribution.textContent = "Model by 藍玉CiAN · CC BY-NC-SA";
    toolbar.append(help, reset, attribution);
    host.append(toolbar);
    function resetView() {
      resize();
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      const distance = Math.max(245, 115 / Math.max(camera.aspect, 0.3));
      controls.maxDistance = Math.max(430, distance * 1.7);
      camera.position.set(0, 67, distance);
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enableDamping = damping;
    }
    reset.onclick = resetView;
    toolbar.addEventListener("pointerdown", (e) => e.stopPropagation());
    toolbar.addEventListener("wheel", (e) => e.stopPropagation());
    function resize() {
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height || (box.width === width && box.height === height)) return;
      width = box.width;
      height = box.height;
      renderer.setSize(width, height);
      css.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const raycaster = new T.Raycaster(),
      pointer = new T.Vector2();
    let down;
    host.addEventListener("pointerdown", (e) => {
      if (!enabled || e.target.closest(".machine-model-tools")) return;
      down = {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
        moved: false,
        select: e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && e.isPrimary
      };
      host.focus({ preventScroll: true });
    });
    host.addEventListener("pointermove", (e) => {
      if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5)
        down.moved = true;
    });
    host.addEventListener("pointerup", (e) => {
      if (!down || down.id !== e.pointerId) return;
      const select = down.select && !down.moved;
      down = null;
      if (!select) return;
      const box = host.getBoundingClientRect();
      pointer.set(((e.clientX - box.left) / width) * 2 - 1, 1 - ((e.clientY - box.top) / height) * 2);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...occluders, ...buttonRings], false)[0];
      if (hit && buttonRings.includes(hit.object)) {
        const key = hit.face.materialIndex;
        if (key >= 1 && key <= 8) press(key);
      }
    });
    host.addEventListener("pointercancel", () => {
      down = null;
    });
    function tick(now) {
      if (!enabled || host.hidden) {
        frame = 0;
        return;
      }
      if (!host.offsetWidth || document.hidden) {
        frame = requestAnimationFrame(tick);
        return;
      }
      resize();
      controls.update();
      renderScene(now);
      frame = requestAnimationFrame(tick);
    }
    function renderScene(now) {
      const transitionProgress = Math.min(1, (now - transitionStart) / 460);
      transitionMaterial.opacity = 0.9 * Math.pow(1 - transitionProgress, 2);
      for (const screen of transitionScreens) screen.visible = transitionProgress < 1;
      // Slow cabinet LED cycle; only uniform colors change, the falloff stays baked.
      const seconds = !exportOptions && reducedMotion.matches ? 0 : now * 0.001;
      canopyColor.setHSL((0.04 + seconds / 42) % 1, 0.98, 0.44);
      sideColor.setHSL((0.86 + seconds / 42) % 1, 0.78, 0.56);
      if (dirtyTexture && canvas.width && canvas.height) {
        texture.needsUpdate = true;
        dirtyTexture = false;
      }
      for (const object of surfaces) {
        const facing = normal.dot(camera.position.clone().sub(object.position).normalize()) > 0.02;
        object.visible =
          facing && (!object.element.classList.contains("machine-model-menu") || !menu.hidden);
        object.userData.opening.visible = object.visible;
      }
      for (const display of screenMeshes) display.visible = menu.hidden;
      if (now - lastSample > 125) {
        lastSample = now;
        if (!menu.hidden) {
          spillColor.set(menu.style.getPropertyValue("--tone") || "#d9d4f1");
          for (const spill of spillLights) {
            spill.color.lerp(spillColor, 0.3);
            spill.intensity = 85;
          }
        } else if (!samplingBlocked && canvas.width && canvas.height) {
          try {
            sampleContext.drawImage(canvas, 0, 0, 16, 16);
            const data = sampleContext.getImageData(0, 0, 16, 16).data;
            let r = 0,
              g = 0,
              b = 0;
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            const peak = Math.max(r, g, b, 1);
            spillColor.setRGB(r / peak, g / peak, b / peak, T.SRGBColorSpace);
            for (const spill of spillLights) {
              spill.color.lerp(spillColor, 0.3);
              spill.intensity = 120 * Math.min(1, peak / 12000);
            }
          } catch {
            samplingBlocked = true;
          }
        }
      }
      renderer.render(scene, camera);
      if (!exportOptions) css.render(uiScene, camera);
    }
    resize();
    resetView();
    buttons.forEach((button, index) => {
      lampColors[index]
        .set(button.style.getPropertyValue("--light") || "#65deff")
        .multiplyScalar(Number(button.style.getPropertyValue("--power") || 0));
      wallColors[index]
        .set(button.style.getPropertyValue("--wall-light") || "#65deff")
        .multiplyScalar(Number(button.style.getPropertyValue("--wall-power") || 0));
    });
    return {
      show() {
        host.classList.add("machine-model-active");
        host.tabIndex = -1;
        host.focus({ preventScroll: true });
        controls.enabled = true;
        dirtyTexture = true;
        if (!frame) frame = requestAnimationFrame(tick);
      },
      hide() {
        controls.enabled = false;
        down = null;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
      },
      draw() {
        dirtyTexture = true;
      },
      transition() {
        if (!reducedMotion.matches) transitionStart = performance.now();
      },
      light(index, power, color, kind) {
        (kind === "wall" ? wallColors : lampColors)[index].set(color).multiplyScalar(power);
      }
    };
  }
  window.MaiCabinet = {
    presets,
    async createExport(canvas, monitorCanvas, preset) {
      if (!presets[preset]) throw new Error("Unknown machine camera preset.");
      await Promise.all([
        window.MaiThree || script("vendor/three.min.js?v=3"),
        window.MaiCabinetMesh || script("assets/maimai-cabinet/mesh.js?v=12")
      ]);
      const host = document.createElement("div"), menu = document.createElement("div");
      menu.hidden = true;
      return build({host, menu, canvas, buttons:[], exportOptions:{preset, monitorCanvas}});
    },
    open,
    close() {
      enabled = false;
      view?.hide();
    },
    draw() {
      view?.draw();
    },
    transition() {
      view?.transition();
    },
    light(i, power, color, kind) {
      view?.light(i, power, color, kind);
    }
  };
})();
