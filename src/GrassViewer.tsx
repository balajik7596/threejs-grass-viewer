import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module"; 
import grassTextureSrc from "./grass.png"; 

const GrassViewer = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [grassCount, setGrassCount] = useState(100000); // Default grass count
  const [windSpeed, setWindSpeed] = useState(2.0); // Default wind speed

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    container.innerHTML = "";

    // Scene and Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 50, 50);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // FPS Stats
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Grass Texture
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load(grassTextureSrc);
    grassTexture.magFilter = THREE.LinearFilter;
    grassTexture.minFilter = THREE.LinearMipmapLinearFilter;

    // Grass Instancing I am using instanceing instead of creating huge number of meshses that uses lot of memory and draw calls
    const MAX_BATCH_SIZE = 50000;
    const grassGeometry = new THREE.PlaneGeometry(0.6, 2);
    grassGeometry.translate(0, 1, 0);
    const offsets = new Float32Array(grassCount * 4); 

    for (let i = 0; i < grassCount; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      const y = 0;
      const height = Math.random() * 0.7 + 0.8; 

      offsets[i * 4] = x;
      offsets[i * 4 + 1] = y;
      offsets[i * 4 + 2] = z;
      offsets[i * 4 + 3] = height; 
    }

    const offsetAttribute = new THREE.InstancedBufferAttribute(offsets, 4);

    // Shader Material 
    const grassMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float time;
        uniform float windSpeed;
        attribute vec4 offset; //  vec4 (x, y, z, height)
        varying vec2 vUv;
        void main() {
            vec3 pos = position * vec3(1.0, offset.w, 1.0); // Scale height
            pos += offset.xyz;
            float sway = sin(time * windSpeed + pos.x * 0.5 + pos.z * 0.3) * 0.2;
            pos.x += sway;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
      fragmentShader: `
        uniform sampler2D grassTexture;
        varying vec2 vUv;
        void main() {
            vec4 texColor = texture2D(grassTexture, vUv);
            if (texColor.a < 0.1) discard;
            gl_FragColor = texColor;
        }
    `,
      uniforms: {
        time: { value: 0 },
        windSpeed: { value: windSpeed }, 
        grassTexture: { value: grassTexture },
      },
      transparent: true,
      side: THREE.DoubleSide, 
    });

    // Batched Grass Instancing
    const batches: THREE.InstancedMesh[] = [];
    for (let i = 0; i < grassCount; i += MAX_BATCH_SIZE) {
      const batchSize = Math.min(MAX_BATCH_SIZE, grassCount - i);
      const instancedMesh = new THREE.InstancedMesh(
        grassGeometry,
        grassMaterial,
        batchSize
      );

      instancedMesh.geometry.setAttribute("offset", offsetAttribute);
      instancedMesh.instanceMatrix.needsUpdate = true;
      scene.add(instancedMesh);
      batches.push(instancedMesh);
    }

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      stats.begin();
      requestAnimationFrame(animate);
      grassMaterial.uniforms.time.value += clock.getDelta();
      grassMaterial.uniforms.windSpeed.value = windSpeed; 
      controls.update();
      renderer.render(scene, camera);
      stats.end();
    };
    animate();

    // Cleanup
    return () => {
      controls.dispose();
      document.body.removeChild(stats.dom);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      batches.forEach((batch) => scene.remove(batch));
    };
  }, [grassCount, windSpeed]);

  return (
    <div>
      {/* Controls UI */}
      <div
        style={{
          position: "absolute",
          top: "50px",
          left: "5px",
          zIndex: 10,
          color: "#fff",
          background: "rgba(0, 0, 0, 0.7)",
          padding: "10px",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "10px", 
          fontSize: "14px",
        }}
      >
        {/* Grass Count*/}
        <div>
          <strong>Grass Count:</strong> {grassCount}
        </div>

        {/* Grass Count selector dropdown */}
        <div>
          <label style={{ marginRight: "10px" }}>Grass Count:</label>
          <select
            onChange={(e) => setGrassCount(parseInt(e.target.value))}
            value={grassCount}
            style={{
              padding: "5px",
              fontSize: "16px",
              background: "#fff",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            <option value={100000}>100,000</option>
            <option value={150000}>150,000</option>
            <option value={250000}>250,000</option>
            <option value={500000}>500,000</option>
          </select>
        </div>

        {/* Wind Speed Slider */}
        <div>
          <label>Wind Speed: {windSpeed.toFixed(1)} m/s</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={windSpeed}
            onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
            style={{
              width: "200px",
              marginLeft: "10px",
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* Three.js canvas */}
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
};

export default GrassViewer;
