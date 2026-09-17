document.getElementById("year").textContent = new Date().getFullYear();

// ===== Contadores com IntersectionObserver (easeOutCubic) =====
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
function animateCount(el, to) {
  const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
  const prefix = el.getAttribute("data-prefix") || "";
  const suffix = el.getAttribute("data-suffix") || "";
  const duration = 1400; // ms
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / duration, 1);
    const value = to * easeOutCubic(p);
    const formatted = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
    el.textContent = prefix + formatted + suffix;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
const counters = document.querySelectorAll(".counter");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const to = parseFloat(el.getAttribute("data-value")) || 0;
        animateCount(el, to);
        io.unobserve(el);
      }
    });
  },
  { threshold: 0.4 }
);
counters.forEach((el) => io.observe(el));

// Clique na imagem para avançar carrossel
// Carrossel multi-itens + autoplay
const multiInit = () => {
  const isMdUp = window.matchMedia("(min-width: 768px)").matches;
  const minPerSlide = isMdUp ? 3 : 1;
  document.querySelectorAll(".carousel.multi .carousel-item").forEach((el) => {
    // remove clones antigos
    el.querySelectorAll(".cloned").forEach((c) => c.remove());
    let next = el.nextElementSibling;
    for (let i = 1; i < minPerSlide; i++) {
      if (!next) next = el.parentNode.firstElementChild;
      const clone = next.querySelector("img").cloneNode(true);
      clone.classList.add("cloned", "ms-md-3");
      if (isMdUp) clone.style.width = "360px";
      el.appendChild(clone);
      next = next.nextElementSibling;
    }
  });
};
multiInit();
window.addEventListener("resize", multiInit);

const carousels = [
  document.getElementById("depoCarousel"),
  document.getElementById("ofertasCarousel"),
].filter(Boolean);
carousels.forEach((el) => {
  const carousel = new bootstrap.Carousel(el, {
    interval: 3200,
    ride: "carousel",
    pause: "hover",
    wrap: true,
  });
  el.addEventListener("click", (e) => {
    if (e.target.tagName === "IMG") carousel.next();
  });
});
