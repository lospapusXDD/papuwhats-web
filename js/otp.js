// ═════════════════════════════════════════════════════════════════════════════
// MOTOR DE ANIMACIÓN: ÓRBITA Y VUELO DE PARTÍCULAS / DÍGITOS OTP (6 DÍGITOS)
// ═════════════════════════════════════════════════════════════════════════════

let currentOtpCode = "471928";
let otpParticles = [];
let otpAnimRunning = false;
let otpResendSeconds = 25;
let otpResendInterval = null;

function showOtpVerificationModal(targetNick, code = "471928") {
  currentOtpCode = String(code).padStart(6, "0").slice(0, 6);
  document.getElementById("otp-target-user").textContent = `@${targetNick}`;
  document.getElementById("sms-code-preview").textContent = `2FA: ${currentOtpCode} es tu código de verificación`;
  
  // Limpiar 6 slots
  for (let i = 0; i < 6; i++) {
    const slot = document.getElementById(`otp-slot-${i}`);
    if (slot) {
      slot.textContent = "";
      slot.classList.remove("filled", "glow-implode");
    }
  }
  const hiddenInput = document.getElementById("otp-hidden-input");
  hiddenInput.value = "";

  // Mostrar modal y toast SMS
  const modal = document.getElementById("modal-otp-screen");
  modal.classList.remove("hidden");

  const smsToast = document.getElementById("sms-toast");
  smsToast.classList.add("hidden");

  // Iniciar timer de reenvío
  startOtpResendTimer();

  // El toast emergente entra tras 500ms
  setTimeout(() => {
    smsToast.classList.remove("hidden");
  }, 500);

  // Escuchar entrada de teclado manual (para Authy / Google Authenticator)
  hiddenInput.focus();
  hiddenInput.oninput = () => {
    const val = hiddenInput.value.replace(/[^0-9]/g, "").slice(0, 6);
    for (let i = 0; i < 6; i++) {
      const slot = document.getElementById(`otp-slot-${i}`);
      if (!slot) continue;
      if (i < val.length) {
        slot.textContent = val[i];
        slot.classList.add("filled");
      } else {
        slot.textContent = "";
        slot.classList.remove("filled");
      }
    }
    if (val.length === 6) {
      setTimeout(confirmOtpManual, 200);
    }
  };
}

function closeOtpScreen() {
  document.getElementById("modal-otp-screen").classList.add("hidden");
  document.getElementById("sms-toast").classList.add("hidden");
  if (otpResendInterval) clearInterval(otpResendInterval);
  otpAnimRunning = false;
}

function startOtpResendTimer() {
  if (otpResendInterval) clearInterval(otpResendInterval);
  otpResendSeconds = 25;
  const timerText = document.getElementById("otp-timer-text");
  timerText.textContent = `Reenviar en ${otpResendSeconds}s`;

  otpResendInterval = setInterval(() => {
    otpResendSeconds--;
    if (otpResendSeconds <= 0) {
      clearInterval(otpResendInterval);
      timerText.textContent = "Reenviar Código";
      timerText.onclick = () => {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        showOtpVerificationModal(document.getElementById("otp-target-user").textContent.replace("@", ""), newCode);
      };
    } else {
      timerText.textContent = `Reenviar en ${otpResendSeconds}s`;
    }
  }, 1000);
}

// ─── Secuencia de Física de Órbita e Implosión en Canvas ───
function triggerOtpOrbitAnimation() {
  const smsToast = document.getElementById("sms-toast");
  const fillBtn = document.getElementById("btn-sms-fill");
  const canvas = document.getElementById("otp-particle-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // 1. Obtener coordenadas de origen (botón FILL)
  const btnRect = fillBtn.getBoundingClientRect();
  const startX = btnRect.left + btnRect.width / 2;
  const startY = btnRect.top + btnRect.height / 2;

  // 2. Obtener centro de la órbita (arriba de las casillas)
  const slotsContainer = document.getElementById("otp-slots-container");
  const containerRect = slotsContainer.getBoundingClientRect();
  const orbitCenterX = containerRect.left + containerRect.width / 2;
  const orbitCenterY = containerRect.top - 40;

  // 3. Obtener posiciones finales de los 6 slots
  const slotTargets = [];
  for (let i = 0; i < 6; i++) {
    const slotEl = document.getElementById(`otp-slot-${i}`);
    if (slotEl) {
      const sRect = slotEl.getBoundingClientRect();
      slotTargets.push({
        x: sRect.left + sRect.width / 2,
        y: sRect.top + sRect.height / 2
      });
    }
  }

  // Ocultar notificación flotante
  smsToast.classList.add("hidden");

  // Crear 6 partículas de dígitos
  const digits = currentOtpCode.split("");
  const totalDigits = digits.length;

  otpParticles = digits.map((char, index) => ({
    digit: char,
    targetIndex: index,
    x: startX,
    y: startY,
    angle: (index * (Math.PI * 2 / totalDigits)), // distribución simétrica en el círculo
    orbitRadius: 52,
    state: "FLY_TO_ORBIT", // FLY_TO_ORBIT -> ORBITING -> IMPLODE_TO_SLOT
    flightProgress: 0,
    orbitTime: 0,
    implodeProgress: 0,
    alpha: 1,
    scale: 0.8
  }));

  otpAnimRunning = true;
  const startTime = performance.now();

  function animateLoop(now) {
    if (!otpAnimRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let allCompleted = true;

    otpParticles.forEach((p) => {
      // FASE 1: Vuelo hacia el centro de órbita
      if (p.state === "FLY_TO_ORBIT") {
        allCompleted = false;
        p.flightProgress += 0.038;
        if (p.flightProgress >= 1) {
          p.flightProgress = 1;
          p.state = "ORBITING";
        }
        const ease = easeOutCubic(p.flightProgress);
        p.x = startX + (orbitCenterX - startX) * ease;
        p.y = startY + (orbitCenterY - startY) * ease - Math.sin(ease * Math.PI) * 60;
        p.scale = 0.8 + ease * 0.4;
      }
      // FASE 2: Órbita circular paramétrica (3D Elipse)
      else if (p.state === "ORBITING") {
        allCompleted = false;
        p.orbitTime += 0.045;
        p.angle += 0.09; // velocidad angular de giro

        p.x = orbitCenterX + Math.cos(p.angle) * p.orbitRadius;
        p.y = orbitCenterY + Math.sin(p.angle) * (p.orbitRadius * 0.65);

        if (p.orbitTime > 1.1) {
          p.state = "IMPLODE_TO_SLOT";
          p.implodeStartX = p.x;
          p.implodeStartY = p.y;
        }
      }
      // FASE 3: Caída e implosión hacia el slot correspondiente
      else if (p.state === "IMPLODE_TO_SLOT") {
        p.implodeProgress += 0.06;
        const target = slotTargets[p.targetIndex];

        if (p.implodeProgress >= 1) {
          p.implodeProgress = 1;
          p.alpha = 0;

          const slotEl = document.getElementById(`otp-slot-${p.targetIndex}`);
          if (slotEl && !slotEl.classList.contains("filled")) {
            slotEl.textContent = p.digit;
            slotEl.classList.add("filled", "glow-implode");
            if (window.AndroidNative && window.AndroidNative.vibratePhone) {
              window.AndroidNative.vibratePhone();
            }
          }
        } else {
          allCompleted = false;
          const ease = easeInQuad(p.implodeProgress);
          p.x = p.implodeStartX + (target.x - p.implodeStartX) * ease;
          p.y = p.implodeStartY + (target.y - p.implodeStartY) * ease;
          p.scale = 1.2 - ease * 0.25;
        }
      }

      // Dibujar partícula / número en Canvas con resplandor neón
      if (p.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.scale(p.scale, p.scale);

        ctx.shadowColor = "#ffda79";
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(18, 26, 32, 0.95)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffda79";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.digit, 0, 1);

        ctx.restore();
      }
    });

    if (!allCompleted) {
      requestAnimationFrame(animateLoop);
    } else {
      otpAnimRunning = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      document.getElementById("otp-hidden-input").value = currentOtpCode;
      setTimeout(confirmOtpManual, 350);
    }
  }

  requestAnimationFrame(animateLoop);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function easeInQuad(x) {
  return x * x;
}

function confirmOtpManual() {
  const entered = Array.from(document.querySelectorAll(".otp-slot")).map(s => s.textContent).join("");
  if (entered.length < 6) return;

  const card = document.getElementById("otp-card");
  card.style.transform = "scale(0.95)";
  card.style.opacity = "0";

  setTimeout(() => {
    closeOtpScreen();
    card.style.transform = "";
    card.style.opacity = "";
    if (window.onOtpVerifiedCallback) {
      window.onOtpVerifiedCallback(entered);
    }
  }, 300);
}
