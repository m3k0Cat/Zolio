/* ============================================
   ZOLIO - Main Application JavaScript
   ============================================ */

// ==========================================
//  1. PARTICLE BACKGROUND
// ==========================================
class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -1000, y: -1000 };
    this.resize();
    this.init();
    this.bindEvents();
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  init() {
    const count = Math.min(80, Math.floor((this.width * this.height) / 15000));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        hue: Math.random() > 0.7 ? 20 : 0 // some orange, some white
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.init();
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      if (p.hue > 0) {
        this.ctx.fillStyle = `hsla(${p.hue}, 100%, 55%, ${p.opacity})`;
      } else {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      }
      this.ctx.fill();

      // Draw connections
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          const alpha = (1 - dist / 120) * 0.08;
          this.ctx.strokeStyle = `rgba(255, 77, 0, ${alpha})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
        }
      }

      // Mouse interaction
      const mdx = p.x - this.mouse.x;
      const mdy = p.y - this.mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 150) {
        const force = (150 - mDist) / 150;
        p.x += (mdx / mDist) * force * 0.8;
        p.y += (mdy / mDist) * force * 0.8;
      }
    });

    requestAnimationFrame(() => this.animate());
  }
}

// ==========================================
//  2. THREE.JS 3D BOMB
// ==========================================
class Bomb3D {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      size: options.size || 1,
      interactive: options.interactive !== false,
      autoRotate: options.autoRotate !== false,
      ...options
    };
    this.mouse = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0 };
    this.isHovered = false;
    this.clock = new THREE.Clock();

    this.init();
    this.createBomb();
    this.createParticles();
    this.addLights();
    this.bindEvents();
    this.animate();
  }

  init() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 400;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.z = 4;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);
  }

  createBomb() {
    this.bombGroup = new THREE.Group();

    // Load bomb texture
    const textureLoader = new THREE.TextureLoader();
    const bombTexture = textureLoader.load('/timebomb.png', (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    });

    // Bomb body (sphere)
    const bombGeo = new THREE.SphereGeometry(
      1 * this.options.size,
      64,
      64
    );
    const bombMat = new THREE.MeshPhongMaterial({
      map: bombTexture,
      color: 0x333333,
      specular: 0x555555,
      shininess: 30,
      bumpMap: bombTexture,
      bumpScale: 0.05,
      emissive: 0x111111,
      emissiveIntensity: 0.1
    });
    this.bombMesh = new THREE.Mesh(bombGeo, bombMat);
    this.bombGroup.add(this.bombMesh);

    // Fuse stem (cylinder at top of bomb)
    const fuseBaseGeo = new THREE.CylinderGeometry(
      0.06 * this.options.size,
      0.08 * this.options.size,
      0.15 * this.options.size,
      16
    );
    const fuseBaseMat = new THREE.MeshPhongMaterial({
      color: 0x444444,
      specular: 0x222222,
      shininess: 20
    });
    const fuseBase = new THREE.Mesh(fuseBaseGeo, fuseBaseMat);
    fuseBase.position.y = 1.02 * this.options.size;
    this.bombGroup.add(fuseBase);

    // Fuse rope (curved line)
    const fuseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.1, 0).multiplyScalar(this.options.size),
      new THREE.Vector3(0.1, 1.3, 0.05).multiplyScalar(this.options.size),
      new THREE.Vector3(0.05, 1.5, -0.05).multiplyScalar(this.options.size),
      new THREE.Vector3(0.15, 1.7, 0.02).multiplyScalar(this.options.size)
    ]);

    const fuseGeo = new THREE.TubeGeometry(fuseCurve, 32, 0.02 * this.options.size, 8, false);
    const fuseMat = new THREE.MeshPhongMaterial({
      color: 0x888888,
      specular: 0x333333,
      shininess: 10
    });
    this.fuse = new THREE.Mesh(fuseGeo, fuseMat);
    this.bombGroup.add(this.fuse);

    // Fuse tip spark (point light + small sphere)
    const sparkGeo = new THREE.SphereGeometry(0.04 * this.options.size, 16, 16);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9
    });
    this.spark = new THREE.Mesh(sparkGeo, sparkMat);
    this.spark.position.copy(new THREE.Vector3(0.15, 1.7, 0.02).multiplyScalar(this.options.size));
    this.bombGroup.add(this.spark);

    // Spark point light
    this.sparkLight = new THREE.PointLight(0xff6600, 1.5, 3);
    this.sparkLight.position.copy(this.spark.position);
    this.bombGroup.add(this.sparkLight);

    this.scene.add(this.bombGroup);
  }

  createParticles() {
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 1.5 + Math.random() * 1;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() * 3 + 1;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMat = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.03,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.particleSystem = new THREE.Points(particleGeo, particleMat);
    this.scene.add(this.particleSystem);
  }

  addLights() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x222233, 0.6);
    this.scene.add(ambient);

    // Main directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 3, 5);
    this.scene.add(dirLight);

    // Orange rim light
    const rimLight = new THREE.PointLight(0xff4400, 0.8, 10);
    rimLight.position.set(-3, 1, -2);
    this.scene.add(rimLight);

    // Blue fill light
    const fillLight = new THREE.PointLight(0x4466ff, 0.3, 10);
    fillLight.position.set(2, -2, 3);
    this.scene.add(fillLight);
  }

  bindEvents() {
    if (!this.options.interactive) return;

    this.container.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    this.container.addEventListener('mouseenter', () => {
      this.isHovered = true;
    });

    this.container.addEventListener('mouseleave', () => {
      this.isHovered = false;
      this.mouse.x = 0;
      this.mouse.y = 0;
    });

    // Touch support
    this.container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    }, { passive: false });

    this.container.addEventListener('touchstart', () => {
      this.isHovered = true;
    });

    this.container.addEventListener('touchend', () => {
      this.isHovered = false;
      this.mouse.x = 0;
      this.mouse.y = 0;
    });

    window.addEventListener('resize', () => {
      const rect = this.container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const time = this.clock.getElapsedTime();

    if (this.bombGroup) {
      // Auto rotation
      const baseSpeed = this.isHovered ? 0.02 : 0.005;
      this.bombGroup.rotation.y += baseSpeed;

      // Mouse-driven rotation
      const targetX = this.mouse.y * 0.5;
      const targetY = this.mouse.x * 0.5;
      this.targetRotation.x += (targetX - this.targetRotation.x) * 0.05;
      this.targetRotation.y += (targetY - this.targetRotation.y) * 0.05;

      this.bombGroup.rotation.x = this.targetRotation.x;

      // Hover scale effect
      const targetScale = this.isHovered ? 1.15 : 1;
      const currentScale = this.bombGroup.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.05;
      this.bombGroup.scale.set(newScale, newScale, newScale);

      // Floating animation
      this.bombGroup.position.y = Math.sin(time * 1.5) * 0.08;
    }

    // Spark flicker
    if (this.spark) {
      this.spark.material.opacity = 0.6 + Math.sin(time * 15) * 0.4;
      const sparkScale = 0.8 + Math.sin(time * 12) * 0.4;
      this.spark.scale.set(sparkScale, sparkScale, sparkScale);
      this.sparkLight.intensity = 1 + Math.sin(time * 10) * 0.8;
    }

    // Rotate particles
    if (this.particleSystem) {
      this.particleSystem.rotation.y = time * 0.1;
      this.particleSystem.rotation.x = time * 0.05;
      this.particleSystem.material.opacity = this.isHovered ? 0.6 : 0.3;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// ==========================================
//  3. CURSOR GLOW
// ==========================================
function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  let mouseX = 0, mouseY = 0;
  let glowX = 0, glowY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function updateGlow() {
    glowX += (mouseX - glowX) * 0.08;
    glowY += (mouseY - glowY) * 0.08;
    glow.style.left = glowX + 'px';
    glow.style.top = glowY + 'px';
    requestAnimationFrame(updateGlow);
  }
  updateGlow();
}

// ==========================================
//  4. NAVBAR
// ==========================================
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile toggle
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  });

  // Close mobile menu on link click
  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// ==========================================
//  5. SCROLL REVEAL ANIMATIONS
// ==========================================
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  reveals.forEach(el => observer.observe(el));
}

// ==========================================
//  6. HERO ANIMATIONS (GSAP)
// ==========================================
function initHeroAnimations() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('.hero-badge', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    delay: 0.3
  })
  .to('.hero-title', {
    opacity: 1,
    y: 0,
    duration: 1
  }, '-=0.4')
  .to('.hero-subtitle', {
    opacity: 1,
    y: 0,
    duration: 0.8
  }, '-=0.6')
  .to('.hero-actions', {
    opacity: 1,
    y: 0,
    duration: 0.8
  }, '-=0.5')
  .to('.hero-stats', {
    opacity: 1,
    y: 0,
    duration: 0.8
  }, '-=0.5');
}

// ==========================================
//  7. COUNTER ANIMATION
// ==========================================
function initCounters() {
  const counters = document.querySelectorAll('.stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count'));
        const duration = 2000;
        const startTime = performance.now();

        function updateCounter(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(eased * target);
          el.textContent = current;

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.textContent = target;
          }
        }

        requestAnimationFrame(updateCounter);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

// ==========================================
//  8. SMOOTH SCROLL
// ==========================================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80;
        const targetPos = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({
          top: targetPos,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ==========================================
//  INITIALIZE EVERYTHING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Particle background
  const particleCanvas = document.getElementById('particleCanvas');
  if (particleCanvas) {
    new ParticleField(particleCanvas);
  }

  // 3D Bomb - Hero
  const bombContainer1 = document.getElementById('bombContainer');
  if (bombContainer1) {
    // Wait a tiny bit for the container to have dimensions
    setTimeout(() => {
      new Bomb3D(bombContainer1, { size: 1, autoRotate: true });
    }, 100);
  }

  // 3D Bomb - Timebomb section
  const bombContainer2 = document.getElementById('bombContainer2');
  if (bombContainer2) {
    setTimeout(() => {
      new Bomb3D(bombContainer2, { size: 0.9, autoRotate: true });
    }, 200);
  }

  // Initialize all modules
  initCursorGlow();
  initNavbar();
  initScrollReveal();
  initHeroAnimations();
  initCounters();
  initSmoothScroll();

  console.log('%c💣 Zolio\'s Website Loaded!', 'color: #ff4d00; font-size: 18px; font-weight: bold;');
});