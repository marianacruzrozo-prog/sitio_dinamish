/* =================================
   LOADER
================================= */

window.addEventListener("load", () => {

    const loader = document.getElementById("loader");

    setTimeout(() => {

        loader.classList.add("hide");

    }, 2600);

});


/* =================================
   NAVBAR: FONDO AL HACER SCROLL
================================= */

const navbar = document.querySelector(".navbar");

function updateNavbarState() {

    if (window.scrollY > 40) {

        navbar.classList.add("is-scrolled");

    } else {

        navbar.classList.remove("is-scrolled");

    }

}

window.addEventListener("scroll", updateNavbarState, { passive: true });

updateNavbarState();


/* =================================
   MENÚ MOBILE
================================= */

const menuToggle = document.getElementById("menuToggle");

const navMenu = document.getElementById("navMenu");

menuToggle.addEventListener("click", () => {

    navMenu.classList.toggle("active");

});


/* =================================
   CERRAR MENÚ AL SELECCIONAR
================================= */

const navLinks = document.querySelectorAll("#navMenu a");

navLinks.forEach(link => {

    link.addEventListener("click", () => {

        navMenu.classList.remove("active");

    });

});


/* =================================
   ANIMACIÓN AL HACER SCROLL
================================= */

const revealElements =
    document.querySelectorAll(
        ".section-title, .about-text, .about-highlight, .service-card, .member-card, .project-card, .contact-info, .contact-form"
    );


revealElements.forEach(element => {

    element.classList.add("reveal");

});


const observer = new IntersectionObserver(

    (entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                entry.target.classList.add("active");

            }

        });

    },

    {
        threshold: 0.15
    }

);


revealElements.forEach(element => {

    observer.observe(element);

});


/* =================================
   FORMULARIO - FORMSPREE
================================= */

const contactForm = document.getElementById("contactForm");

if (contactForm) {

    contactForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const nombre = contactForm.querySelector(
            'input[name="nombre"]'
        ).value;

        const button = contactForm.querySelector(
            'button[type="submit"]'
        );

        const originalText = button.textContent;

        button.textContent = "ENVIANDO...";
        button.disabled = true;

        try {

            const response = await fetch(contactForm.action, {
                method: "POST",
                body: new FormData(contactForm),
                headers: {
                    "Accept": "application/json"
                }
            });

            if (response.ok) {

                alert(
                    `¡Gracias ${nombre}! Tu mensaje fue enviado correctamente a DINAMISH.`
                );

                contactForm.reset();

            } else {

                alert(
                    "Hubo un problema al enviar tu mensaje. Por favor, inténtalo nuevamente."
                );

            }

        } catch (error) {

            alert(
                "No se pudo enviar el mensaje. Revisa tu conexión e inténtalo nuevamente."
            );

        }

        button.textContent = originalText;
        button.disabled = false;

    });

}

/* =================================
   CARRUSELES (AUDIOVISUAL / VIDEO)
================================= */

function initCarousel(key) {

    const root = document.getElementById(`carousel-${key}`);

    if (!root) return;

    const track = root.querySelector(".carousel-track");
    const slides = Array.from(track.children);
    const dotsContainer = document.querySelector(`[data-carousel-dots="${key}"]`);
    const prevBtn = document.querySelector(`[data-carousel-prev="${key}"]`);
    const nextBtn = document.querySelector(`[data-carousel-next="${key}"]`);

    let index = 0;

    // Crea los indicadores (dots)
    slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.setAttribute("aria-label", `Ir a la diapositiva ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dotsContainer.appendChild(dot);
    });

    const dots = Array.from(dotsContainer.children);

    function update() {

        track.style.transform = `translateX(-${index * 100}%)`;

        dots.forEach((dot, i) => dot.classList.toggle("active", i === index));

        if (prevBtn) prevBtn.disabled = slides.length <= 1;
        if (nextBtn) nextBtn.disabled = slides.length <= 1;

        // Pausa los videos que ya no están visibles
        slides.forEach((slide, i) => {
            const video = slide.querySelector("video");
            if (video && i !== index) video.pause();
        });
    }

    function goTo(newIndex) {
        index = (newIndex + slides.length) % slides.length;
        update();
    }

    if (prevBtn) prevBtn.addEventListener("click", () => goTo(index - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => goTo(index + 1));

    // Deslizar con gestos táctiles (celular / tablet)
    let touchStartX = 0;

    track.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    track.addEventListener("touchend", (e) => {
        const delta = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) > 40) {
            goTo(delta > 0 ? index - 1 : index + 1);
        }
    });

    update();
}

document.querySelectorAll("[data-carousel-block]").forEach((block) => {
    const carouselEl = block.querySelector(".carousel");
    if (carouselEl) {
        const key = carouselEl.id.replace("carousel-", "");
        initCarousel(key);
    }
});
