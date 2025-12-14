<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  oscillationSpeed: number;
  oscillationDistance: number;
  angle: number;
  layer: number; // For parallax depth
  trail: { x: number; y: number }[]; // Trail history
}

interface WindGust {
  x: number;
  y: number;
  radius: number;
  strength: number;
  direction: number;
  life: number;
  maxLife: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationId: number;
let particles: Particle[] = [];
let windGusts: WindGust[] = [];
let mouseX = 0;
let mouseY = 0;
let isMouseMoving = false;
let mouseTimeout: ReturnType<typeof setTimeout>;
let time = 0;

// Wind configuration
const PARTICLE_COUNT = 120;
const BASE_WIND_SPEED = 0.8;
const WIND_VARIATION = 0.3;
const TRAIL_LENGTH = 5;

// Global wind direction (changes slowly over time)
let globalWindAngle = 0;
let targetWindAngle = 0;

function createParticle(canvas: HTMLCanvasElement, atMouse = false): Particle {
  const x = atMouse ? mouseX : Math.random() * canvas.width;
  const y = atMouse ? mouseY : Math.random() * canvas.height;
  const layer = Math.random(); // 0-1, affects speed and size (parallax)

  return {
    x,
    y,
    size: (Math.random() * 2 + 0.5) * (0.5 + layer * 0.5),
    speedX: 0,
    speedY: 0,
    opacity: (Math.random() * 0.4 + 0.1) * (0.3 + layer * 0.7),
    oscillationSpeed: Math.random() * 0.03 + 0.01,
    oscillationDistance: Math.random() * 40 + 15,
    angle: Math.random() * Math.PI * 2,
    layer,
    trail: [],
  };
}

function createWindGust(canvas: HTMLCanvasElement): WindGust {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 200 + 100,
    strength: Math.random() * 2 + 1,
    direction: globalWindAngle + (Math.random() - 0.5) * 0.5,
    life: 0,
    maxLife: Math.random() * 120 + 60,
  };
}

function initParticles(canvas: HTMLCanvasElement) {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle(canvas));
  }
}

function animate(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  time += 0.016; // ~60fps

  // Slowly change global wind direction
  if (Math.random() < 0.005) {
    targetWindAngle = (Math.random() - 0.5) * 0.6; // -0.3 to 0.3 radians
  }
  globalWindAngle += (targetWindAngle - globalWindAngle) * 0.01;

  // Spawn wind gusts occasionally
  if (Math.random() < 0.02 && windGusts.length < 3) {
    windGusts.push(createWindGust(canvas));
  }

  // Update wind gusts
  windGusts = windGusts.filter((gust) => {
    gust.life++;
    return gust.life < gust.maxLife;
  });

  // Calculate global wind with variation
  const windStrength = BASE_WIND_SPEED + Math.sin(time * 0.5) * WIND_VARIATION;
  const windX = Math.cos(globalWindAngle) * windStrength;
  const windY = Math.sin(globalWindAngle) * windStrength * 0.3;

  // Sort particles by layer for proper depth rendering
  const sortedParticles = [...particles].sort((a, b) => a.layer - b.layer);

  sortedParticles.forEach((particle) => {
    // Store trail position
    particle.trail.unshift({ x: particle.x, y: particle.y });
    if (particle.trail.length > TRAIL_LENGTH) {
      particle.trail.pop();
    }

    // Oscillating movement (turbulence)
    particle.angle += particle.oscillationSpeed;
    const turbulenceX =
      Math.sin(particle.angle + particle.x * 0.01) * particle.oscillationDistance * 0.015;
    const turbulenceY =
      Math.cos(particle.angle * 0.7 + particle.y * 0.01) * particle.oscillationDistance * 0.01;

    // Layer-based wind speed (parallax effect)
    const layerMultiplier = 0.4 + particle.layer * 0.6;

    // Apply wind force
    particle.speedX += windX * layerMultiplier * 0.1;
    particle.speedY += windY * layerMultiplier * 0.1;

    // Wind gust influence
    windGusts.forEach((gust) => {
      const dx = particle.x - gust.x;
      const dy = particle.y - gust.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < gust.radius) {
        const gustProgress = gust.life / gust.maxLife;
        const gustIntensity = Math.sin(gustProgress * Math.PI) * gust.strength;
        const influence = (1 - distance / gust.radius) * gustIntensity * 0.15;
        particle.speedX += Math.cos(gust.direction) * influence;
        particle.speedY += Math.sin(gust.direction) * influence * 0.5;
      }
    });

    // Mouse influence (creates a swirl/disturbance)
    if (isMouseMoving) {
      const dx = particle.x - mouseX;
      const dy = particle.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 180) {
        const force = (180 - distance) / 180;
        // Create a swirling effect
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        particle.speedX += Math.cos(angle) * force * 0.15;
        particle.speedY += Math.sin(angle) * force * 0.15;
        // Plus some outward push
        particle.speedX += (dx / distance) * force * 0.08;
        particle.speedY += (dy / distance) * force * 0.08;
      }
    }

    // Apply movement with turbulence
    particle.x += particle.speedX + turbulenceX;
    particle.y += particle.speedY + turbulenceY;

    // Dampen speed (air resistance)
    particle.speedX *= 0.96;
    particle.speedY *= 0.96;

    // Wrap around edges with smooth transition
    if (particle.x > canvas.width + 20) {
      particle.x = -20;
      particle.y = Math.random() * canvas.height;
      particle.trail = [];
    }
    if (particle.x < -20) {
      particle.x = canvas.width + 20;
      particle.trail = [];
    }
    if (particle.y > canvas.height + 20) {
      particle.y = -20;
      particle.trail = [];
    }
    if (particle.y < -20) {
      particle.y = canvas.height + 20;
      particle.trail = [];
    }

    // Draw particle trail (wind streak effect)
    if (particle.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      particle.trail.forEach((pos, i) => {
        if (i === 0) {
          ctx.lineTo(pos.x, pos.y);
        }
      });
      const speed = Math.sqrt(particle.speedX ** 2 + particle.speedY ** 2);
      const trailOpacity = Math.min(particle.opacity * speed * 0.3, particle.opacity * 0.4);
      ctx.strokeStyle = `rgba(255, 255, 255, ${trailOpacity})`;
      ctx.lineWidth = particle.size * 0.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Draw particle with soft glow
    const gradient = ctx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      particle.size * 3,
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${particle.opacity})`);
    gradient.addColorStop(0.4, `rgba(200, 230, 255, ${particle.opacity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  // Draw subtle connections between close particles (air current visualization)
  particles.forEach((particle, index) => {
    particles.slice(index + 1, index + 6).forEach((otherParticle) => {
      // Only connect particles in similar layers
      if (Math.abs(particle.layer - otherParticle.layer) > 0.3) return;

      const dx = particle.x - otherParticle.x;
      const dy = particle.y - otherParticle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 80) {
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(otherParticle.x, otherParticle.y);
        const alpha = 0.06 * (1 - distance / 80) * ((particle.layer + otherParticle.layer) / 2);
        ctx.strokeStyle = `rgba(180, 220, 255, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });
  });

  // Draw wind gust visualization (subtle)
  windGusts.forEach((gust) => {
    const gustProgress = gust.life / gust.maxLife;
    const alpha = Math.sin(gustProgress * Math.PI) * 0.03;
    const gradient = ctx.createRadialGradient(gust.x, gust.y, 0, gust.x, gust.y, gust.radius);
    gradient.addColorStop(0, `rgba(200, 230, 255, ${alpha})`);
    gradient.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.beginPath();
    ctx.arc(gust.x, gust.y, gust.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  animationId = requestAnimationFrame(() => animate(canvas, ctx));
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  isMouseMoving = true;

  clearTimeout(mouseTimeout);
  mouseTimeout = setTimeout(() => {
    isMouseMoving = false;
  }, 150);
}

function handleResize() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initParticles(canvas);
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  initParticles(canvas);
  animate(canvas, ctx);

  window.addEventListener('resize', handleResize);
  window.addEventListener('mousemove', handleMouseMove);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('mousemove', handleMouseMove);
  clearTimeout(mouseTimeout);
});
</script>

<template>
  <canvas ref="canvasRef" class="pointer-events-none fixed inset-0 z-0" />
</template>
