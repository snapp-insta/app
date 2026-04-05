const canvas = document.getElementById("promoCanvas");
const ctx = canvas.getContext("2d");

const productImageInput = document.getElementById("productImage");
const logoImageInput = document.getElementById("logoImage");
const productNameInput = document.getElementById("productName");
const priceInput = document.getElementById("price");
const oldPriceInput = document.getElementById("oldPrice");
const badgeSelect = document.getElementById("badge");
const customBadgeInput = document.getElementById("customBadge");

const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const removeBgBtn = document.getElementById("removeBgBtn");

const previewMeta = document.getElementById("previewMeta");
const statusMsg = document.getElementById("statusMsg");
const nameCount = document.getElementById("nameCount");
const removeBgNote = document.getElementById("removeBgNote");

const imageThumbWrap = document.getElementById("imageThumbWrap");
const imageThumb = document.getElementById("imageThumb");
const logoThumbWrap = document.getElementById("logoThumbWrap");
const logoThumb = document.getElementById("logoThumb");

const styleSelector = document.getElementById("styleSelector");
const variantSelector = document.getElementById("variantSelector");
const formatSelector = document.getElementById("formatSelector");

let selectedStyle = "clean";
let selectedVariant = "retail";
let selectedFormat = "square";

let productImage = null;
let logoImage = null;
let originalProductFile = null;
let productObjectUrl = null;
let logoObjectUrl = null;
let processedProductUrl = null;

let bgRemoveFn = null;
let bgReady = false;

const variantMap = {
  clean: [
    { value: "retail", label: "Retail" },
    { value: "pharmacy", label: "Pharmacy" },
    { value: "fresh", label: "Fresh" }
  ],
  bold: [
    { value: "promo", label: "Promo" },
    { value: "discount", label: "Discount" },
    { value: "pharmacypromo", label: "Pharmacy" }
  ],
  dark: [
    { value: "premium", label: "Premium" },
    { value: "luxegold", label: "Gold" },
    { value: "clinical", label: "Clinical" }
  ]
};

const formatMap = {
  square: { width: 1080, height: 1080, label: "Square 1:1 — 1080×1080" },
  portrait: { width: 1080, height: 1350, label: "Portrait 3:4 — 1080×1350" },
  story: { width: 1080, height: 1920, label: "Story 9:16 — 1080×1920" }
};

initBackgroundRemoval();

productNameInput.addEventListener("input", () => {
  nameCount.textContent = productNameInput.value.length;
});

badgeSelect.addEventListener("change", () => {
  customBadgeInput.disabled = badgeSelect.value !== "custom";
  if (badgeSelect.value !== "custom") {
    customBadgeInput.value = "";
  }
});

productImageInput.addEventListener("change", (e) => {
  originalProductFile = e.target.files?.[0] || null;
  handleImageUpload(e, "product");
});

logoImageInput.addEventListener("change", (e) => handleImageUpload(e, "logo"));

styleSelector.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-style]");
  if (!btn) return;

  selectedStyle = btn.dataset.style;
  updateSegmentedState(styleSelector, "style", selectedStyle);

  const variants = variantMap[selectedStyle];
  selectedVariant = variants[0].value;
  renderVariantButtons();
});

formatSelector.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-format]");
  if (!btn) return;
  selectedFormat = btn.dataset.format;
  updateSegmentedState(formatSelector, "format", selectedFormat);
  applyCanvasSize();
  drawPlaceholder();
});

generateBtn.addEventListener("click", generateVisual);
downloadBtn.addEventListener("click", downloadVisual);
resetBtn.addEventListener("click", resetApp);

if (removeBgBtn) {
  removeBgBtn.addEventListener("click", removeBackgroundFromProduct);
}

renderVariantButtons();

function setHelperNote(text) {
  if (removeBgNote) {
    removeBgNote.textContent = text;
  }
}

function updateRemoveBgUi() {
  if (!removeBgBtn) return;

  removeBgBtn.disabled = !(bgReady && originalProductFile);

  if (!bgReady) {
    setHelperNote("Background removal se učitava… ako potraje, osveži stranicu i sačekaj par sekundi.");
  } else if (!originalProductFile) {
    setHelperNote("Prvo učitaj sliku proizvoda.");
  } else {
    setHelperNote("Klikni na Remove background. Prvi put obrada može trajati malo duže.");
  }
}

async function initBackgroundRemoval() {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm");
    bgRemoveFn = mod.removeBackground;
    bgReady = typeof bgRemoveFn === "function";
  } catch (err) {
    console.error("Background removal import error:", err);
    bgReady = false;
    bgRemoveFn = null;
  } finally {
    updateRemoveBgUi();
  }
}

function renderVariantButtons() {
  if (!variantSelector) return;

  variantSelector.innerHTML = "";
  const variants = variantMap[selectedStyle];

  variants.forEach((variant, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `seg-btn${variant.value === selectedVariant || (index === 0 && !selectedVariant) ? " active" : ""}`;
    button.setAttribute("data-variant", variant.value);
    button.innerHTML = `<span>${variant.label}</span><small>${getVariantHint(selectedStyle, variant.value)}</small>`;

    button.addEventListener("click", () => {
      selectedVariant = variant.value;
      updateSegmentedState(variantSelector, "variant", selectedVariant);
    });

    variantSelector.appendChild(button);
  });
}

function getVariantHint(style, variant) {
  const map = {
    clean: {
      retail: "Neutral retail",
      pharmacy: "Apoteka look",
      fresh: "Mint / healthy"
    },
    bold: {
      promo: "Standard promo",
      discount: "Jači akcijski",
      pharmacypromo: "Urednija akcija"
    },
    dark: {
      premium: "Subtle premium",
      luxegold: "Gold spotlight",
      clinical: "Med-tech dark"
    }
  };

  return map[style]?.[variant] || "";
}

function updateSegmentedState(container, type, value) {
  if (!container) return;
  const attr = type === "style" ? "data-style" : type === "format" ? "data-format" : "data-variant";

  [...container.querySelectorAll(".seg-btn")].forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute(attr) === value);
  });
}

function revokeIfNeeded(url) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function createObjectUrl(fileOrBlob) {
  return URL.createObjectURL(fileOrBlob);
}

function handleImageUpload(event, kind) {
  const file = event.target.files?.[0];
  if (!file) return;

  const objectUrl = createObjectUrl(file);
  const img = new Image();

  img.onload = () => {
    if (kind === "product") {
      revokeIfNeeded(productObjectUrl);
      revokeIfNeeded(processedProductUrl);
      productObjectUrl = objectUrl;
      processedProductUrl = null;
      productImage = img;
      imageThumb.src = objectUrl;
      imageThumbWrap.classList.remove("hidden");
      statusMsg.textContent = "Slika proizvoda učitana.";
      updateRemoveBgUi();
    } else {
      revokeIfNeeded(logoObjectUrl);
      logoObjectUrl = objectUrl;
      logoImage = img;
      logoThumb.src = objectUrl;
      logoThumbWrap.classList.remove("hidden");
      statusMsg.textContent = "Logo učitan.";
    }
  };

  img.onerror = () => {
    revokeIfNeeded(objectUrl);
    statusMsg.textContent = "Greška pri učitavanju slike.";
  };

  img.src = objectUrl;
}

async function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function applyCanvasSize() {
  const f = formatMap[selectedFormat];
  canvas.width = f.width;
  canvas.height = f.height;
  previewMeta.textContent = f.label;
}

function getBadgeText() {
  if (badgeSelect.value === "custom") {
    return sanitizeText(customBadgeInput.value.trim());
  }
  return sanitizeText(badgeSelect.value.trim());
}

async function removeBackgroundFromProduct() {
  if (!originalProductFile) {
    statusMsg.textContent = "Prvo učitaj sliku proizvoda.";
    return;
  }

  if (!bgReady || !bgRemoveFn) {
    statusMsg.textContent = "Remove background trenutno nije spreman. Osveži stranicu i pokušaj ponovo.";
    return;
  }

  try {
    removeBgBtn.disabled = true;
    removeBgBtn.classList.add("loading");
    removeBgBtn.textContent = "Obrada...";
    statusMsg.textContent = "Uklanjam pozadinu... prvi put može trajati malo duže.";

    const resultBlob = await bgRemoveFn(originalProductFile);

    revokeIfNeeded(processedProductUrl);
    processedProductUrl = createObjectUrl(resultBlob);

    const processedImage = await loadImageFromUrl(processedProductUrl);

    productImage = processedImage;
    imageThumb.src = processedProductUrl;
    imageThumbWrap.classList.remove("hidden");
    statusMsg.textContent = "Pozadina je uklonjena. Sada generiši vizual.";
  } catch (error) {
    console.error("Remove background error:", error);
    statusMsg.textContent = "Remove background nije uspeo za ovu sliku. Probaj drugu sliku sa jasnijim proizvodom.";
  } finally {
    if (removeBgBtn) {
      removeBgBtn.classList.remove("loading");
      removeBgBtn.textContent = "Remove background";
    }
    updateRemoveBgUi();
  }
}

function generateVisual() {
  const name = sanitizeText(productNameInput.value.trim());
  const rawPrice = sanitizeText(priceInput.value.trim());
  const rawOldPrice = sanitizeText(oldPriceInput.value.trim());
  const badge = getBadgeText();

  if (!productImage) {
    statusMsg.textContent = "Dodaj sliku proizvoda.";
    return;
  }

  if (!name || !rawPrice) {
    statusMsg.textContent = "Naziv i nova cena su obavezni.";
    return;
  }

  const price = normalizePrice(rawPrice);
  const oldPrice = rawOldPrice ? normalizePrice(rawOldPrice) : "";

  applyCanvasSize();
  drawComposition({
    name,
    price,
    oldPrice,
    badge
  });

  statusMsg.textContent = `Vizual generisan. Stil: ${selectedStyle} / ${selectedVariant}`;
  downloadBtn.disabled = false;
}

function downloadVisual() {
  const safeName = (productNameInput.value.trim() || "promo")
    .toLowerCase()
    .replace(/[^a-z0-9šđčćž]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  const link = document.createElement("a");
  link.download = `${safeName || "promo"}-${selectedFormat}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetApp() {
  productImageInput.value = "";
  logoImageInput.value = "";
  productNameInput.value = "";
  priceInput.value = "";
  oldPriceInput.value = "";
  badgeSelect.value = "";
  customBadgeInput.value = "";
  customBadgeInput.disabled = true;

  productImage = null;
  logoImage = null;
  originalProductFile = null;

  revokeIfNeeded(productObjectUrl);
  revokeIfNeeded(logoObjectUrl);
  revokeIfNeeded(processedProductUrl);

  productObjectUrl = null;
  logoObjectUrl = null;
  processedProductUrl = null;

  imageThumbWrap.classList.add("hidden");
  logoThumbWrap.classList.add("hidden");
  imageThumb.removeAttribute("src");
  logoThumb.removeAttribute("src");

  selectedStyle = "clean";
  selectedVariant = "retail";
  selectedFormat = "square";

  updateSegmentedState(styleSelector, "style", selectedStyle);
  renderVariantButtons();
  updateSegmentedState(formatSelector, "format", selectedFormat);

  nameCount.textContent = "0";

  if (removeBgBtn) {
    removeBgBtn.classList.remove("loading");
    removeBgBtn.textContent = "Remove background";
  }

  updateRemoveBgUi();

  applyCanvasSize();
  drawPlaceholder();
  downloadBtn.disabled = true;
  statusMsg.textContent = "Upload slike i unesi naziv i cenu za generisanje.";
}

function sanitizeText(value) {
  return value.replace(/[<>]/g, "");
}

function normalizePrice(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const hasCurrency = /(rsd|din|eur|€|\$)/i.test(trimmed);
  if (hasCurrency) {
    return trimmed
      .replace(/\s+/g, " ")
      .replace(/rsd/gi, "RSD")
      .replace(/din/gi, "DIN")
      .replace(/eur/gi, "EUR")
      .trim();
  }

  if (/^\d+[.,]?\d*$/.test(trimmed)) {
    return `${trimmed.replace(",", ".")} RSD`;
  }

  return trimmed;
}

function splitPriceAndCurrency(priceText) {
  const match = priceText.match(/^(.+?)\s*(RSD|DIN|EUR|€|\$)$/i);
  if (!match) return { amount: priceText, currency: "" };
  return {
    amount: match[1].trim(),
    currency: match[2].toUpperCase()
  };
}

function getTheme(style, variant) {
  const themes = {
    clean: {
      retail: {
        gradientTop: "#ffffff",
        gradientMiddle: "#f6f9ff",
        gradientBottom: "#eef4ff",
        spotlightColor: "rgba(124,108,242,0.10)",
        spotlightScale: 0.42,
        cardFill: "rgba(255,255,255,0.82)",
        cardStroke: "rgba(255,255,255,0.78)",
        text: "#111827",
        titleFont: 'Arial, Helvetica, sans-serif',
        priceFont: 'Arial, Helvetica, sans-serif',
        oldPriceText: "#606a78",
        oldPriceLine: "#9da6b2",
        priceFill: "#ffffff",
        priceText: "#ef4444",
        badgeStyle: "clean3d",
        badgeFill: "#ef4444",
        badgeFill2: "#ff6a5c",
        badgeText: "#ffffff",
        badgeShadow: "rgba(167, 24, 24, 0.28)",
        badgeHighlight: "rgba(255,255,255,0.22)",
        texture: "none"
      },
      pharmacy: {
        gradientTop: "#fbfdff",
        gradientMiddle: "#f4f9ff",
        gradientBottom: "#ebf4ff",
        spotlightColor: "rgba(255,255,255,0.62)",
        spotlightScale: 0.50,
        cardFill: "rgba(255,255,255,0.90)",
        cardStroke: "rgba(215,228,245,0.82)",
        text: "#1e293b",
        titleFont: 'Arial, Helvetica, sans-serif',
        priceFont: 'Arial, Helvetica, sans-serif',
        oldPriceText: "#6b7a8d",
        oldPriceLine: "#9eb0c6",
        priceFill: "#ffffff",
        priceText: "#e53935",
        badgeStyle: "cleanFlat",
        badgeFill: "#e53935",
        badgeFill2: "#ef5350",
        badgeText: "#ffffff",
        badgeShadow: "rgba(177, 36, 36, 0.18)",
        badgeHighlight: "rgba(255,255,255,0.16)",
        texture: "microdotsBlue"
      },
      fresh: {
        gradientTop: "#fbfffd",
        gradientMiddle: "#f2fff8",
        gradientBottom: "#e6fff4",
        spotlightColor: "rgba(255,255,255,0.36)",
        spotlightScale: 0.46,
        cardFill: "rgba(255,255,255,0.84)",
        cardStroke: "rgba(221,245,235,0.88)",
        text: "#064e3b",
        titleFont: 'Arial, Helvetica, sans-serif',
        priceFont: 'Arial, Helvetica, sans-serif',
        oldPriceText: "#5b7a70",
        oldPriceLine: "#8ab3a3",
        priceFill: "#ffffff",
        priceText: "#10b981",
        badgeStyle: "clean3d",
        badgeFill: "#10b981",
        badgeFill2: "#34d399",
        badgeText: "#ffffff",
        badgeShadow: "rgba(16, 130, 97, 0.22)",
        badgeHighlight: "rgba(255,255,255,0.20)",
        texture: "grainSoft"
      }
    },

    bold: {
      promo: {
        gradientTop: "#ff3d54",
        gradientMiddle: "#ff6a3d",
        gradientBottom: "#ff9a00",
        spotlightColor: "rgba(255,255,255,0.24)",
        spotlightScale: 0.52,
        cardFill: "rgba(255,255,255,0.10)",
        cardStroke: "rgba(255,255,255,0)",
        text: "#ffffff",
        titleFont: '"Poppins", Arial, Helvetica, sans-serif',
        priceFont: '"Poppins", Arial, Helvetica, sans-serif',
        oldPriceText: "rgba(255,255,255,0.94)",
        oldPriceLine: "#ffffff",
        priceFill: "#fff6f8",
        priceText: "#d90452",
        badgeStyle: "bold",
        badgeFill: "#f8ea24",
        badgeFill2: "#ffe948",
        badgeText: "#121212",
        badgeShadow: "rgba(0,0,0,0.20)",
        badgeHighlight: "rgba(255,255,255,0.24)",
        texture: "none"
      },
      discount: {
        gradientTop: "#ff233c",
        gradientMiddle: "#ff5d2a",
        gradientBottom: "#ffd000",
        spotlightColor: "rgba(255,255,255,0.30)",
        spotlightScale: 0.56,
        cardFill: "rgba(255,255,255,0.10)",
        cardStroke: "rgba(255,255,255,0)",
        text: "#ffffff",
        titleFont: '"Poppins", Arial, Helvetica, sans-serif',
        priceFont: '"Poppins", Arial, Helvetica, sans-serif',
        oldPriceText: "rgba(255,255,255,0.96)",
        oldPriceLine: "#ffffff",
        priceFill: "#fff8f8",
        priceText: "#d90429",
        badgeStyle: "boldBig",
        badgeFill: "#ffe500",
        badgeFill2: "#fff17a",
        badgeText: "#111111",
        badgeShadow: "rgba(0,0,0,0.24)",
        badgeHighlight: "rgba(255,255,255,0.26)",
        texture: "grainPromo"
      },
      pharmacypromo: {
        gradientTop: "#fff1f2",
        gradientMiddle: "#ffd9db",
        gradientBottom: "#ffc9cc",
        spotlightColor: "rgba(255,255,255,0.42)",
        spotlightScale: 0.44,
        cardFill: "rgba(255,255,255,0.68)",
        cardStroke: "rgba(255,255,255,0.40)",
        text: "#3a2020",
        titleFont: '"Poppins", Arial, Helvetica, sans-serif',
        priceFont: '"Poppins", Arial, Helvetica, sans-serif',
        oldPriceText: "#774a4a",
        oldPriceLine: "#a86565",
        priceFill: "#ffffff",
        priceText: "#d62828",
        badgeStyle: "cleanFlat",
        badgeFill: "#d62828",
        badgeFill2: "#ef5350",
        badgeText: "#ffffff",
        badgeShadow: "rgba(130, 35, 35, 0.18)",
        badgeHighlight: "rgba(255,255,255,0.14)",
        texture: "none"
      }
    },

    dark: {
      premium: {
        gradientTop: "#161b24",
        gradientMiddle: "#121821",
        gradientBottom: "#0b1017",
        spotlightColor: "rgba(255,255,255,0.22)",
        spotlightScale: 0.54,
        cardFill: "rgba(255,255,255,0.045)",
        cardStroke: "rgba(255,255,255,0.08)",
        text: "#ffffff",
        titleFont: 'Arial, Helvetica, sans-serif',
        priceFont: 'Arial, Helvetica, sans-serif',
        oldPriceText: "rgba(255,255,255,0.84)",
        oldPriceLine: "rgba(255,255,255,0.92)",
        priceFill: "#f8f6ef",
        priceText: "#14171f",
        badgeStyle: "darkSubtle",
        badgeFill: "#707887",
        badgeFill2: "#9da5b1",
        badgeText: "#ffffff",
        badgeShadow: "rgba(0,0,0,0.28)",
        badgeHighlight: "rgba(255,255,255,0.14)",
        texture: "none"
      },
      luxegold: {
        gradientTop: "#12151b",
        gradientMiddle: "#0f1218",
        gradientBottom: "#080a0e",
        spotlightColor: "rgba(255,244,210,0.24)",
        spotlightScale: 0.60,
        cardFill: "rgba(255,255,255,0.04)",
        cardStroke: "rgba(255,255,255,0.07)",
        text: "#ffffff",
        titleFont: 'Arial, Helvetica, sans-serif',
        priceFont: 'Arial, Helvetica, sans-serif',
        oldPriceText: "rgba(255,255,255,0.82)",
        oldPriceLine: "rgba(255,255,255,0.88)",
        priceFill: "#f8f2e6",
        priceText: "#17140d",
        badgeStyle: "gold",
        badgeFill: "#d4af37",
        badgeFill2: "#f2df9c",
        badgeText: "#2a220f",
        badgeShadow: "rgba(0,0,0,0.32)",
        badgeHighlight: "rgba(255,255,255,0.26)",
        texture: "grainLuxury"
      },
      clinical: {
        gradientTop: "#0f172a",
        gradientMiddle: "#111c35",
        gradientBottom: "#0a1426",
        spotlightColor: "rgba(255,255,255,0.34)",
        spotlightScale: 0.62,
        cardFill: "rgba(255,255,255,0.05)",
        cardStroke: "rgba(255,255,255,0.08)",
        text: "#ffffff",
        titleFont: 'Arial, Helvetica, sans-serif',
        priceFont: 'Arial, Helvetica, sans-serif',
        oldPriceText: "rgba(214,225,241,0.88)",
        oldPriceLine: "rgba(214,225,241,0.94)",
        priceFill: "#f7fbff",
        priceText: "#11213c",
        badgeStyle: "clinical",
        badgeFill: "#eef4ff",
        badgeFill2: "#ffffff",
        badgeText: "#20324f",
        badgeShadow: "rgba(0,0,0,0.18)",
        badgeHighlight: "rgba(255,255,255,0.30)",
        texture: "microgridClinical"
      }
    }
  };

  return themes[style]?.[variant] || themes.clean.retail;
}

function setCanvasFont(weight, size, family) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function drawPlaceholder() {
  const { width, height } = formatMap[selectedFormat];
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#f8fafc");
  bg.addColorStop(1, "#e5ebf2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height * 0.32, 30, width / 2, height * 0.32, width * 0.45);
  glow.addColorStop(0, "rgba(124,108,242,0.16)");
  glow.addColorStop(1, "rgba(124,108,242,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#8792a3";
  ctx.font = `700 ${Math.max(30, Math.floor(width * 0.045))}px Arial`;
  ctx.fillText("Instant Promo", width / 2, height * 0.44);

  ctx.fillStyle = "#9aa3b1";
  ctx.font = `400 ${Math.max(18, Math.floor(width * 0.022))}px Arial`;
  ctx.fillText("Preview će se pojaviti ovde", width / 2, height * 0.49);
}

function drawComposition({ name, price, oldPrice, badge }) {
  const { width, height } = formatMap[selectedFormat];
  ctx.clearRect(0, 0, width, height);

  const theme = getTheme(selectedStyle, selectedVariant);

  drawBackground(width, height, theme);
  drawTexture(width, height, theme);
  drawCard(width, height, theme);

  const layout = getLayout(width, height);

  if (badge) {
    drawBadge(layout.badgeX, layout.badgeY, layout.badgeW, layout.badgeH, badge, theme);
  }

  if (logoImage) {
    drawLogo(logoImage, layout.logoX, layout.logoY, layout.logoW, layout.logoH);
  }

  if (selectedStyle === "bold") {
    drawAmbientGlow(layout.productX, layout.productY, layout.productW, layout.productH, "rgba(255,255,255,0.18)");
  }

  if (selectedStyle === "dark") {
    drawAmbientGlow(layout.productX, layout.productY, layout.productW, layout.productH, "rgba(255,255,255,0.13)");
  }

  drawProductShadow(layout.productX, layout.productY, layout.productW, layout.productH);
  drawProductImage(productImage, layout.productX, layout.productY, layout.productW, layout.productH);

  drawProductName(name, layout.textX, layout.nameY, layout.textW, theme);
  drawPriceGroup(price, oldPrice, layout, theme);
}

function drawBackground(width, height, theme) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, theme.gradientTop);
  bg.addColorStop(0.52, theme.gradientMiddle);
  bg.addColorStop(1, theme.gradientBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const spotlight = ctx.createRadialGradient(
    width / 2,
    height * 0.28,
    10,
    width / 2,
    height * 0.28,
    width * theme.spotlightScale
  );
  spotlight.addColorStop(0, theme.spotlightColor);
  spotlight.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, width, height);
}

function drawTexture(width, height, theme) {
  if (theme.texture === "none") return;

  ctx.save();

  if (theme.texture === "microdotsBlue") {
    ctx.fillStyle = "rgba(80,120,180,0.06)";
    const step = Math.max(24, Math.floor(width / 36));
    const radius = Math.max(1.3, width * 0.0016);
    for (let y = step; y < height; y += step) {
      for (let x = step; x < width; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (theme.texture === "grainSoft") {
    for (let i = 0; i < 1200; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const a = Math.random() * 0.035;
      ctx.fillStyle = `rgba(16,185,129,${a})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  }

  if (theme.texture === "grainPromo") {
    for (let i = 0; i < 1600; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const a = Math.random() * 0.05;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }

  if (theme.texture === "grainLuxury") {
    for (let i = 0; i < 1100; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const a = Math.random() * 0.03;
      ctx.fillStyle = `rgba(212,175,55,${a})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  }

  if (theme.texture === "microgridClinical") {
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    const step = Math.max(34, Math.floor(width / 26));

    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCard(width, height, theme) {
  const inset = Math.round(width * 0.055);
  const cardX = inset;
  const cardY = inset;
  const cardW = width - inset * 2;
  const cardH = height - inset * 2;

  ctx.fillStyle = theme.cardFill;
  roundRect(ctx, cardX, cardY, cardW, cardH, Math.round(width * 0.04), true, false);

  if (theme.cardStroke && theme.cardStroke !== "rgba(255,255,255,0)") {
    ctx.strokeStyle = theme.cardStroke;
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, Math.round(width * 0.04), false, true);
  }
}

function getLayout(width, height) {
  if (selectedFormat === "story") {
    return {
      badgeX: 88,
      badgeY: 92,
      badgeW: 300,
      badgeH: 104,
      logoX: width - 260,
      logoY: 92,
      logoW: 150,
      logoH: 58,
      productX: 150,
      productY: 250,
      productW: width - 300,
      productH: 760,
      textX: 112,
      textW: width - 224,
      nameY: 1140,
      priceBoxX: 112,
      priceBoxY: 1410,
      priceBoxW: width - 224,
      priceBoxH: 220
    };
  }

  if (selectedFormat === "portrait") {
    return {
      badgeX: 82,
      badgeY: 84,
      badgeW: 270,
      badgeH: 96,
      logoX: width - 240,
      logoY: 84,
      logoW: 138,
      logoH: 54,
      productX: 160,
      productY: 205,
      productW: width - 320,
      productH: 560,
      textX: 96,
      textW: width - 192,
      nameY: 860,
      priceBoxX: 96,
      priceBoxY: 1088,
      priceBoxW: width - 192,
      priceBoxH: 170
    };
  }

  return {
    badgeX: 74,
    badgeY: 74,
    badgeW: 250,
    badgeH: 88,
    logoX: width - 220,
    logoY: 74,
    logoW: 130,
    logoH: 50,
    productX: 220,
    productY: 185,
    productW: width - 440,
    productH: 380,
    textX: 84,
    textW: width - 168,
    nameY: 660,
    priceBoxX: 84,
    priceBoxY: 828,
    priceBoxW: width - 168,
    priceBoxH: 138
  };
}

function drawBadge(x, y, w, h, text, theme) {
  if (theme.badgeStyle === "gold") {
    drawPremiumBadge(x, y, w, h, text, theme);
    return;
  }

  if (theme.badgeStyle === "clinical") {
    drawClinicalBadge(x, y, w, h, text, theme);
    return;
  }

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  const angle =
    theme.badgeStyle === "bold" || theme.badgeStyle === "boldBig"
      ? (-3 * Math.PI) / 180
      : theme.badgeStyle === "clean3d"
        ? (-2 * Math.PI) / 180
        : 0;

  ctx.rotate(angle);

  ctx.shadowColor = theme.badgeShadow;
  ctx.shadowBlur = theme.badgeStyle === "boldBig" ? 22 : theme.badgeStyle === "clean3d" ? 14 : 10;
  ctx.shadowOffsetY = theme.badgeStyle === "boldBig" ? 12 : 8;

  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, theme.badgeFill2);
  grad.addColorStop(1, theme.badgeFill);
  ctx.fillStyle = grad;

  const radius =
    theme.badgeStyle === "cleanFlat" ? Math.round(h * 0.42) :
    theme.badgeStyle === "boldBig" ? Math.round(h * 0.52) :
    Math.round(h * 0.50);

  roundRect(ctx, -w / 2, -h / 2, w, h, radius, true, false);

  ctx.shadowColor = "transparent";
  ctx.fillStyle = theme.badgeHighlight;
  roundRect(ctx, -w / 2 + 10, -h / 2 + 8, w - 20, h * 0.34, Math.round(h * 0.24), true, false);

  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontFamily =
    theme.badgeStyle === "bold" || theme.badgeStyle === "boldBig"
      ? '"Poppins", Arial, Helvetica, sans-serif'
      : 'Arial, Helvetica, sans-serif';

  const startSize =
    theme.badgeStyle === "boldBig"
      ? Math.floor(h * 0.42)
      : Math.floor(h * 0.36);

  fitTextCenterWithFamily(text.toUpperCase(), 0, 4, w - 36, startSize, 20, 900, fontFamily);

  ctx.restore();
}

function drawPremiumBadge(x, y, w, h, text, theme) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  ctx.shadowColor = theme.badgeShadow;
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 12;

  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, "#f7e7b8");
  grad.addColorStop(0.45, theme.badgeFill2);
  grad.addColorStop(1, theme.badgeFill);
  ctx.fillStyle = grad;

  roundRect(ctx, -w / 2, -h / 2, w, h, Math.round(h * 0.32), true, false);

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 2;
  roundRect(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.round(h * 0.30), false, true);

  ctx.fillStyle = theme.badgeHighlight;
  roundRect(ctx, -w / 2 + 12, -h / 2 + 10, w - 24, h * 0.28, Math.round(h * 0.18), true, false);

  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitTextCenterWithFamily(text.toUpperCase(), 0, 2, w - 40, Math.floor(h * 0.34), 20, 900, 'Arial, Helvetica, sans-serif');

  ctx.restore();
}

function drawClinicalBadge(x, y, w, h, text, theme) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  ctx.shadowColor = theme.badgeShadow;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;

  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, theme.badgeFill2);
  grad.addColorStop(1, theme.badgeFill);
  ctx.fillStyle = grad;

  roundRect(ctx, -w / 2, -h / 2, w, h, Math.round(h * 0.28), true, false);

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(170,190,220,0.42)";
  ctx.lineWidth = 2;
  roundRect(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.round(h * 0.26), false, true);

  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitTextCenterWithFamily(text.toUpperCase(), 0, 2, w - 40, Math.floor(h * 0.33), 20, 900, 'Arial, Helvetica, sans-serif');

  ctx.restore();
}

function drawLogo(img, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  drawContainedImage(img, x, y, w, h);
  ctx.restore();
}

function drawAmbientGlow(x, y, w, h, color) {
  const glow = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    w * 0.10,
    x + w / 2,
    y + h / 2,
    w * 0.66
  );
  glow.addColorStop(0, color);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 90, y - 90, w + 180, h + 180);
}

function drawProductShadow(x, y, w, h) {
  ctx.save();

  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 24;

  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h - 2, w * 0.34, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawProductImage(img, x, y, w, h) {
  drawContainedImage(img, x, y, w, h);
}

function drawContainedImage(img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let drawW, drawH, drawX, drawY;

  if (imgRatio > boxRatio) {
    drawW = w;
    drawH = w / imgRatio;
    drawX = x;
    drawY = y + (h - drawH) / 2;
  } else {
    drawH = h;
    drawW = h * imgRatio;
    drawX = x + (w - drawW) / 2;
    drawY = y;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawProductName(text, x, y, maxWidth, theme) {
  ctx.fillStyle = theme.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const startSize = selectedFormat === "story" ? 62 : selectedFormat === "portrait" ? 56 : 44;
  const minSize = 28;
  const lines = wrapTextAdaptiveWithFamily(text, maxWidth, startSize, minSize, 2, 900, theme.titleFont);

  setCanvasFont(900, lines.fontSize, theme.titleFont);
  const lineHeight = Math.round(lines.fontSize * 1.08);
  lines.lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawPriceGroup(price, oldPrice, layout, theme) {
  const x = layout.priceBoxX;
  const y = layout.priceBoxY;
  const w = layout.priceBoxW;
  const h = layout.priceBoxH;

  if (oldPrice) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const centerX = x + w / 2;
    const fontSize =
      selectedFormat === "story" ? 64 :
      selectedFormat === "portrait" ? 52 : 44;

    setCanvasFont(800, fontSize, theme.priceFont);
    ctx.fillStyle = theme.oldPriceText;

    const oldY = y - (selectedFormat === "story" ? 46 : selectedFormat === "portrait" ? 36 : 30);
    ctx.fillText(oldPrice, centerX, oldY);

    const oldWidth = ctx.measureText(oldPrice).width;
    ctx.strokeStyle = theme.oldPriceLine;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(centerX - oldWidth / 2, oldY - fontSize * 0.32);
    ctx.lineTo(centerX + oldWidth / 2, oldY - fontSize * 0.32);
    ctx.stroke();
  }

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.14)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = theme.priceFill;
  roundRect(ctx, x, y, w, h, Math.round(h * 0.38), true, false);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = selectedStyle === "dark" ? 0.18 : 0.28;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x + 20, y + 14, w - 40, Math.round(h * 0.32), Math.round(h * 0.18), true, false);
  ctx.restore();

  const split = splitPriceAndCurrency(price);
  const amount = split.amount;
  const currency = split.currency;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.priceText;

  const centerY = y + h / 2 + 2;
  const centerX = x + w / 2;

  if (!currency) {
    fitTextCenterWithFamily(
      amount,
      centerX,
      centerY,
      w - 60,
      selectedFormat === "story" ? 118 : selectedFormat === "portrait" ? 104 : 82,
      34,
      900,
      theme.priceFont
    );
    return;
  }

  let amountSize = selectedFormat === "story" ? 118 : selectedFormat === "portrait" ? 104 : 82;
  let currencySize = Math.round(amountSize * 0.38);

  while (amountSize > 34) {
    setCanvasFont(900, amountSize, theme.priceFont);
    const amountWidth = ctx.measureText(amount).width;

    setCanvasFont(900, currencySize, theme.priceFont);
    const currencyWidth = ctx.measureText(currency).width;

    const totalWidth = amountWidth + 18 + currencyWidth;
    if (totalWidth <= w - 70) break;

    amountSize -= 2;
    currencySize = Math.round(amountSize * 0.38);
  }

  setCanvasFont(900, amountSize, theme.priceFont);
  const amountWidth = ctx.measureText(amount).width;

  setCanvasFont(900, currencySize, theme.priceFont);
  const currencyWidth = ctx.measureText(currency).width;

  const totalWidth = amountWidth + 18 + currencyWidth;
  let startX = centerX - totalWidth / 2;

  ctx.textAlign = "left";
  setCanvasFont(900, amountSize, theme.priceFont);
  ctx.fillText(amount, startX, centerY + 4);

  startX += amountWidth + 18;
  setCanvasFont(900, currencySize, theme.priceFont);
  ctx.fillText(currency, startX, centerY + 10);
}

function fitTextCenterWithFamily(text, centerX, centerY, maxWidth, startSize, minSize, weight, family) {
  let size = startSize;
  while (size > minSize) {
    setCanvasFont(weight, size, family);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  setCanvasFont(weight, size, family);
  ctx.fillText(text, centerX, centerY);
}

function wrapTextAdaptiveWithFamily(text, maxWidth, startSize, minSize, maxLines, weight, family) {
  let fontSize = startSize;

  while (fontSize >= minSize) {
    setCanvasFont(weight, fontSize, family);
    const lines = wrapText(text, maxWidth);
    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
    fontSize -= 2;
  }

  setCanvasFont(weight, minSize, family);
  let lines = wrapText(text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = truncateToWidth(lines[maxLines - 1], maxWidth);
  }
  return { lines, fontSize: minSize };
}

function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function truncateToWidth(text, maxWidth) {
  let output = text;
  while (ctx.measureText(output + "...").width > maxWidth && output.length > 0) {
    output = output.slice(0, -1);
  }
  return output + "...";
}

function roundRect(ctxRef, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctxRef.beginPath();
  ctxRef.moveTo(x + r, y);
  ctxRef.lineTo(x + width - r, y);
  ctxRef.quadraticCurveTo(x + width, y, x + width, y + r);
  ctxRef.lineTo(x + width, y + height - r);
  ctxRef.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctxRef.lineTo(x + r, y + height);
  ctxRef.quadraticCurveTo(x, y + height, x, y + height - r);
  ctxRef.lineTo(x, y + r);
  ctxRef.quadraticCurveTo(x, y, x + r, y);
  ctxRef.closePath();

  if (fill) ctxRef.fill();
  if (stroke) ctxRef.stroke();
}

applyCanvasSize();
drawPlaceholder();
updateRemoveBgUi();