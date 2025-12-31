/**
 * Advanced Interactions System
 * Scroll animations, parallax, magnetic effects, and more
 */

// ============================================
// SCROLL REVEAL ANIMATIONS
// ============================================
function initScrollReveal() {
  const revealElements = document.querySelectorAll('[data-reveal]');

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const delay = el.dataset.revealDelay || '0';

          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('revealed');

          // Unobserve after reveal (one-time animation)
          observer.unobserve(el);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  revealElements.forEach(el => observer.observe(el));
}

// ============================================
// PARALLAX ON SCROLL
// ============================================
function initParallax() {
  const parallaxElements = document.querySelectorAll('[data-parallax]');

  if (!parallaxElements.length) return;

  let ticking = false;

  function updateParallax() {
    const scrollY = window.scrollY;

    parallaxElements.forEach(el => {
      const element = el as HTMLElement;
      const speed = parseFloat(element.dataset.parallax || '0.5');
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + scrollY;
      const relativeScroll = scrollY - elementTop + window.innerHeight;

      if (relativeScroll > 0 && relativeScroll < window.innerHeight + rect.height) {
        const yOffset = (relativeScroll - window.innerHeight / 2) * speed;
        element.style.transform = `translateY(${yOffset}px)`;
      }
    });

    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    },
    { passive: true }
  );
}

// ============================================
// MOUSE FOLLOWER / GLOW EFFECT
// ============================================
function initMouseGlow() {
  const glowContainers = document.querySelectorAll('[data-mouse-glow]');

  glowContainers.forEach(container => {
    const el = container as HTMLElement;

    // Create glow element
    const glow = document.createElement('div');
    glow.className = 'mouse-glow';
    el.appendChild(glow);
    el.style.position = 'relative';
    el.style.overflow = 'hidden';

    el.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
      glow.style.opacity = '1';
    });

    el.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });
  });
}

// ============================================
// MAGNETIC BUTTONS
// ============================================
function initMagneticButtons() {
  const magneticElements = document.querySelectorAll('[data-magnetic]');

  magneticElements.forEach(el => {
    const element = el as HTMLElement;
    const strength = parseFloat(element.dataset.magnetic || '0.3');

    element.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;

      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'translate(0, 0)';
      element.style.transition = 'transform 0.3s cubic-bezier(0.33, 1, 0.68, 1)';
    });

    element.addEventListener('mouseenter', () => {
      element.style.transition = 'transform 0.1s ease-out';
    });
  });
}

// ============================================
// 3D TILT EFFECT ON CARDS
// ============================================
function initTiltCards() {
  const tiltElements = document.querySelectorAll('[data-tilt]');

  tiltElements.forEach(el => {
    const element = el as HTMLElement;
    const intensity = parseFloat(element.dataset.tilt || '10');

    element.style.transformStyle = 'preserve-3d';
    element.style.transition = 'transform 0.1s ease-out';

    element.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -intensity;
      const rotateY = ((x - centerX) / centerX) * intensity;

      element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      element.style.transition = 'transform 0.5s cubic-bezier(0.33, 1, 0.68, 1)';
    });
  });
}

// ============================================
// TEXT SPLIT ANIMATION
// ============================================
function initTextSplit() {
  const splitElements = document.querySelectorAll('[data-split-text]');

  splitElements.forEach(el => {
    const element = el as HTMLElement;
    const text = element.textContent || '';
    const type = element.dataset.splitText || 'chars'; // 'chars' or 'words'

    element.innerHTML = '';
    element.style.opacity = '1';

    if (type === 'chars') {
      text.split('').forEach((char, i) => {
        const span = document.createElement('span');
        span.className = 'split-char';
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.style.animationDelay = `${i * 30}ms`;
        element.appendChild(span);
      });
    } else {
      text.split(' ').forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'split-word';
        span.textContent = word;
        span.style.animationDelay = `${i * 100}ms`;
        element.appendChild(span);

        if (i < text.split(' ').length - 1) {
          element.appendChild(document.createTextNode(' '));
        }
      });
    }
  });
}

// ============================================
// SMOOTH COUNTER ANIMATION
// ============================================
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const target = parseInt(el.dataset.counter || '0', 10);
          const duration = parseInt(el.dataset.counterDuration || '2000', 10);
          const suffix = el.dataset.counterSuffix || '';
          const prefix = el.dataset.counterPrefix || '';

          animateCounter(el, target, duration, prefix, suffix);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(el => observer.observe(el));
}

function animateCounter(
  el: HTMLElement,
  target: number,
  duration: number,
  prefix: string,
  suffix: string
): void {
  const start = performance.now();

  function update(currentTime: number) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out-expo)
    const eased = 1 - Math.pow(2, -10 * progress);
    const current = Math.floor(eased * target);

    el.textContent = `${prefix}${current}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = `${prefix}${target}${suffix}`;
    }
  }

  requestAnimationFrame(update);
}

// ============================================
// SCROLL PROGRESS INDICATOR
// ============================================
function initScrollProgress() {
  const progressBar = document.querySelector('[data-scroll-progress]') as HTMLElement;
  if (!progressBar) return;

  window.addEventListener(
    'scroll',
    () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;

      progressBar.style.width = `${progress}%`;
    },
    { passive: true }
  );
}

// ============================================
// STAGGER CHILDREN ANIMATION
// ============================================
function initStaggerChildren() {
  const staggerContainers = document.querySelectorAll('[data-stagger]');

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const container = entry.target as HTMLElement;
          const children = container.children;
          const delay = parseInt(container.dataset.stagger || '100', 10);

          Array.from(children).forEach((child, i) => {
            const el = child as HTMLElement;
            el.style.transitionDelay = `${i * delay}ms`;
            el.classList.add('stagger-revealed');
          });

          observer.unobserve(container);
        }
      });
    },
    { threshold: 0.1 }
  );

  staggerContainers.forEach(el => observer.observe(el));
}

// ============================================
// CURSOR TRAIL EFFECT
// ============================================
function _initCursorTrail() {
  const trailContainer = document.querySelector('[data-cursor-trail]');
  if (!trailContainer) return;

  const dots: HTMLElement[] = [];
  const numDots = 12;
  const positions: Array<{ x: number; y: number }> = Array.from({ length: numDots }, () => ({
    x: 0,
    y: 0,
  }));

  for (let i = 0; i < numDots; i++) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.style.opacity = `${1 - i / numDots}`;
    dot.style.transform = `scale(${1 - (i / numDots) * 0.5})`;
    document.body.appendChild(dot);
    dots.push(dot);
  }

  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animate() {
    positions[0] = { x: mouseX, y: mouseY };

    for (let i = 1; i < numDots; i++) {
      positions[i].x += (positions[i - 1].x - positions[i].x) * 0.3;
      positions[i].y += (positions[i - 1].y - positions[i].y) * 0.3;
    }

    dots.forEach((dot, i) => {
      dot.style.left = `${positions[i].x}px`;
      dot.style.top = `${positions[i].y}px`;
    });

    requestAnimationFrame(animate);
  }

  animate();
}

// ============================================
// INIT ALL
// ============================================
export function initInteractions() {
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

function init() {
  initScrollReveal();
  initParallax();
  initMouseGlow();
  initMagneticButtons();
  initTiltCards();
  initTextSplit();
  initCounters();
  initScrollProgress();
  initStaggerChildren();
  // _initCursorTrail(); // Uncomment if you want cursor trail
}

// Auto-init
initInteractions();
