document.addEventListener('DOMContentLoaded', function() {
  const burger = document.querySelector('#menu-toggle') || document.querySelector('.mobile-burger');
  const mobileMenu = document.getElementById('mobileMenu') || document.getElementById('mobile-nav');
  const closeBtn = mobileMenu ? mobileMenu.querySelector('.close-mobile') : null;

  if (!burger || !mobileMenu) return;

  const openMenu = () => {
    mobileMenu.classList.add('open');
    burger.classList.add('open');
    document.body.classList.add('menu-open');
  };

  const closeMenu = () => {
    mobileMenu.classList.remove('open');
    burger.classList.remove('open');
    document.body.classList.remove('menu-open');
  };

  burger.addEventListener('click', e => {
    e.stopPropagation();
    if (mobileMenu.classList.contains('open')) closeMenu();
    else openMenu();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      closeMenu();
    });
  }

  // Ferme au clic hors du menu
  mobileMenu.addEventListener('click', e => {
    if (e.target === mobileMenu) closeMenu();
  });

  // Ferme au resize si on dépasse le breakpoint
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && mobileMenu.classList.contains('open')) closeMenu();
  });
});

// ===== Slideshow automatique =====
document.addEventListener('DOMContentLoaded', function() {
  const slides = document.querySelectorAll('#slideshow .slide');
  if (!slides.length) return; // sécurité

  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('visible');
    current = (current + 1) % slides.length;
    slides[current].classList.add('visible');
  }, 2500); // 2.5 secondes par image
});

// ===== Gestion du menu de langue =====
document.addEventListener('DOMContentLoaded', function() {
  const langSelector = document.querySelector('.lang-selector');
  if (!langSelector) return;

  const btn = langSelector.querySelector('.lang-current');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    langSelector.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    langSelector.classList.remove('open');
  });
});

document.addEventListener('keydown', function(e) {
  // 8 = code Backspace
  if(e.key === "Backspace") {
    // Vérifie que le focus n'est pas sur un input ou textarea
    const tag = document.activeElement.tagName.toLowerCase();
    if(tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();         // empêche le comportement par défaut
      window.history.back();      // retourne à la page précédente
    }
  }
});

// ============================
// SLIDE + FADE + BLUR ON SCROLL
// ============================

document.addEventListener("DOMContentLoaded", function() {
    const faders = document.querySelectorAll(".fade-in");

    const appearOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const appearOnScroll = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
        });
    }, appearOptions);

    faders.forEach(el => {
        appearOnScroll.observe(el);
    });
});

  /* Box hover pour mobile */
document.querySelectorAll('.beamer-box').forEach(box => {
  box.addEventListener('touchstart', () => box.classList.add('hover'));
  box.addEventListener('touchend', () => box.classList.remove('hover'));
});



// ============================
// Rendre les images cliquables 
// ============================

const images = document.querySelectorAll(".clickable-img");
const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");
const closeBtn = document.getElementById("closeModal");

images.forEach(img => {
  img.addEventListener("click", function() {
    modal.style.display = "flex";
    modalImg.src = this.src;
    document.body.style.overflow = "hidden";
  });
});

closeBtn.addEventListener("click", function() {
  modal.style.display = "none";
  document.body.style.overflow = "auto";
});

modal.addEventListener("click", function(e) {
  if (e.target === modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
});





