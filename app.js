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

const imageThumbWrap = document.getElementById("imageThumbWrap");
const imageThumb = document.getElementById("imageThumb");
const logoThumbWrap = document.getElementById("logoThumbWrap");
const logoThumb = document.getElementById("logoThumb");

const styleSelector = document.getElementById("styleSelector");
const formatSelector = document.getElementById("formatSelector");

let selectedStyle = "clean";
let selectedFormat = "square";
let productImage = null;
let logoImage = null;
let originalProductFile = null;
let productObjectUrl = null;
let logoObjectUrl = null;
let processedProductUrl = null;
let bgRemoveReady = false;
let bgRemoveFn = null;
let bgRemoveLoading = null;

const formatMap = {
  square: { width: 1080, height: 1080, label: "Square 1:1 — 1080×1080" },
  portrait: { width: 1080, height: 1350, label: "Portrait 3:4 — 1080×1350" },
  story: { width: 1080, height: 1920, label: "Story 9:16 — 1080×1920" }
};

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
removeBgBtn.addEventListener("click", removeBackgroundFromProduct);

initBackgroundRemoval();

function updateSegmentedState(container, type, value) {
  const attr = type === "style" ? "data-style" : "data-format";
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

function refreshRemoveBgButtonState() {
  removeBgBtn.disabled = !(originalProductFile && bgRemoveReady);
}

function setStatus(text) {
  statusMsg.textContent = text;
}

async function initBackgroundRemoval() {
  try {
    setStatus("Učitavam remove background modul...");
    bgRemoveLoading = import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm");
    const mod = await bgRemoveLoading;
    bgRemoveFn = mod.removeBackground;
    bgRemoveReady = typeof bgRemoveFn === "function";
    refreshRemoveBgButtonState();
    setStatus("Upload slike i unesi naziv i cenu za generisanje.");
  } catch (error) {
    console.error("Background removal init failed:", error);
    bgRemoveReady = false;
    bgRemoveFn = null;
    refreshRemoveBgButtonState();
    setStatus("Remove background modul nije učitan. Ostatak aplikacije radi normalno.");
  }
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
      refreshRemoveBgButtonState();
      setStatus("Slika proizvoda učitana.");
    } else {
      revokeIfNeeded(logoObjectUrl);
      logoObjectUrl = objectUrl;
      logoImage = img;
      logoThumb.src = objectUrl;
      logoThumbWrap.classList.remove("hidden");
      setStatus("Logo učitan.");
    }
  };

  img.onerror = () => {
    revokeIfNeeded(objectUrl);
    setStatus("Greška pri učitavanju slike.");
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
    setStatus("Prvo učitaj sliku proizvoda.");
    return;
  }

  if (!bgRemoveReady || !bgRemoveFn) {
    setStatus("Remove background još nije spreman.");
    return;
  }

  try {
    removeBgBtn.disabled = true;
    removeBgBtn.classList.add("loading");
    removeBgBtn.textContent = "Obrada...";
    setStatus("Uklanjam pozadinu... prvi put može potrajati duže.");

    const resultBlob = await bgRemoveFn(originalProductFile, {
      publicPath: "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/"
    });

    revokeIfNeeded(processedProductUrl);
    processedProductUrl = createObjectUrl(resultBlob);

    const processedImage = await loadImageFromUrl(processedProductUrl);

    productImage = processedImage;
    imageThumb.src = processedProductUrl;
    imageThumbWrap.classList.remove("hidden");
    setStatus("Pozadina je uklonjena. Sada generiši vizual.");
  } catch (error) {
    console.error("Remove background failed:", error);
    setStatus("Remove background nije uspeo za ovu sliku. Probaj drugu sliku sa jasnijim proizvodom.");
  } finally {
    refreshRemoveBgButtonState();
    removeBgBtn.classList.remove("loading");
    removeBgBtn.textContent = "Remove background";
  }
}

function generateVisual() {
  const name = sanitizeText(productNameInput.value.trim());
  const rawPrice = sanitizeText(priceInput.value.trim());
  const rawOldPrice = sanitizeText(oldPriceInput.value.trim());
  const badge = getBadgeText();

  if (!productImage) {
    setStatus("Dodaj sliku proizvoda.");
    return;
  }

  if (!name || !rawPrice) {
    setStatus("Naziv i nova cena su obavezni.");
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

  setStatus("Vizual generisan.");
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
  selectedFormat = "square";
  updateSegmentedState(styleSelector, "style", selectedStyle);
  updateSegmentedState(formatSelector, "format", selectedFormat);

  nameCount.textContent = "0";
  refreshRemoveBgButtonState();
  removeBgBtn.classList.remove("loading");
  removeBgBtn.textContent = "Remove background";

  applyCanvasSize();
  drawPlaceholder();
  downloadBtn.disabled = true;
  setStatus("Upload slike i unesi naziv i cenu za generisanje.");
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

  const theme = getTheme(selectedStyle);
  drawBackground(width, height, theme);
  drawCard(width, height, theme);

  const layout = getLayout(width, height);

  if (badge) {
    drawBadge(layout.badgeX, layout.badgeY, layout.badgeW, layout.badgeH, badge, theme);
  }

  if (logoImage) {
    drawLogo(logoImage, layout.logoX, layout.logoY, layout.logoW, layout.logoH);
  }

  if (selectedStyle === "bold") {
    drawAmbientGlow(layout.productX, layout.productY, layout.productW, layout.productH);
  }

  drawProductShadow(layout.productX, layout.productY, layout.productW, layout.productH);
  drawProductImage(productImage, layout.productX, layout.productY, layout.productW, layout.productH);

  drawProductName(name, layout.textX, layout.nameY, layout.textW, theme);
  drawPriceGroup(price, oldPrice, layout, theme);
}

function getTheme(style) {
  if (style === "bold") {
    return {
      gradientTop: "#ff3d54",
      gradientMiddle: "#ff6a3d",
      gradientBottom: "#ff9a00",
      cardFill: "rgba(255,255,255,0.10)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.84)",
      priceFill: "#fff6f8",
      priceText: "#d90452",
      oldPriceText: "rgba(255,255,255,0.92)",
      oldPriceLine: "#ffffff",
      badgeFill: "#f8ea24",
      badgeText: "#121212"
    };
  }

  if (style === "dark") {
    return {
      gradientTop: "#171c28",
      gradientMiddle: "#121827",
      gradientBottom: "#0d1018",
      cardFill: "rgba(255,255,255,0.05)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.72)",
      priceFill: "#ffffff",
      priceText: "#111827",
      oldPriceText: "rgba(255,255,255,0.86)",
      oldPriceLine: "rgba(255,255,255,0.95)",
      badgeFill: "#7c6cf2",
      badgeText: "#ffffff"
    };
  }

  return {
    gradientTop: "#ffffff",
    gradientMiddle: "#f5f8ff",
    gradientBottom: "#eef4ff",
    cardFill: "rgba(255,255,255,0.76)",
    text: "#141b29",
    muted: "#5d6778",
    priceFill: "#ffffff",
    priceText: "#ef4444",
    oldPriceText: "#4b5563",
    oldPriceLine: "#6b7280",
    badgeFill: "#141b29",
    badgeText: "#ffffff"
  };
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
    height * 0.25,
    10,
    width / 2,
    height * 0.25,
    width * 0.52
  );

  if (selectedStyle === "bold") {
    spotlight.addColorStop(0, "rgba(255,255,255,0.23)");
    spotlight.addColorStop(1, "rgba(255,255,255,0)");
  } else if (selectedStyle === "dark") {
    spotlight.addColorStop(0, "rgba(124,108,242,0.22)");
    spotlight.addColorStop(1, "rgba(124,108,242,0)");
  } else {
    spotlight.addColorStop(0, "rgba(124,108,242,0.14)");
    spotlight.addColorStop(1, "rgba(124,108,242,0)");
  }

  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, width, height);
}

function drawCard(width, height, theme) {
  const inset = Math.round(width * 0.055);
  const cardX = inset;
  const cardY = inset;
  const cardW = width - inset * 2;
  const cardH = height - inset * 2;

  ctx.fillStyle = theme.cardFill;
  roundRect(ctx, cardX, cardY, cardW, cardH, Math.round(width * 0.04), true, false);

  if (selectedStyle === "clean") {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
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
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((-3 * Math.PI) / 180);

  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = theme.badgeFill;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2, true, false);

  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, -w / 2 + 10, -h / 2 + 10, w - 20, h * 0.38, h / 3, true, false);

  ctx.fillStyle = theme.badgeText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitTextCenter(text.toUpperCase(), 0, 4, w - 40, Math.floor(h * 0.38), 22, 900);

  ctx.restore();
}

function drawLogo(img, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  drawContainedImage(img, x, y, w, h);
  ctx.restore();
}

function drawAmbientGlow(x, y, w, h) {
  const glow = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    w * 0.12,
    x + w / 2,
    y + h / 2,
    w * 0.65
  );
  glow.addColorStop(0, "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 80, y - 80, w + 160, h + 160);
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

  const fontSize = selectedFormat === "story" ? 62 : selectedFormat === "portrait" ? 56 : 44;
  const minSize = 28;
  const lines = wrapTextAdaptive(text, maxWidth, fontSize, minSize, 2, 900);

  ctx.font = `900 ${lines.fontSize}px Arial`;
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

    const oldPriceY = y - 22;

    ctx.font = `800 ${fontSize}px Arial`;
    ctx.fillStyle = theme.oldPriceText;
    ctx.fillText(oldPrice, centerX, oldPriceY);

    const oldWidth = ctx.measureText(oldPrice).width;
    ctx.strokeStyle = theme.oldPriceLine;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(centerX - oldWidth / 2, oldPriceY - fontSize / 3);
    ctx.lineTo(centerX + oldWidth / 2, oldPriceY - fontSize / 3);
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
  ctx.globalAlpha = 0.28;
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
    fitTextCenter(
      amount,
      centerX,
      centerY,
      w - 60,
      selectedFormat === "story" ? 118 : selectedFormat === "portrait" ? 104 : 82,
      34,
      900
    );
    return;
  }

  let amountSize = selectedFormat === "story" ? 118 : selectedFormat === "portrait" ? 104 : 82;
  let currencySize = Math.round(amountSize * 0.38);

  while (amountSize > 34) {
    ctx.font = `900 ${amountSize}px Arial`;
    const amountWidth = ctx.measureText(amount).width;

    ctx.font = `900 ${currencySize}px Arial`;
    const currencyWidth = ctx.measureText(currency).width;

    const totalWidth = amountWidth + 18 + currencyWidth;
    if (totalWidth <= w - 70) break;

    amountSize -= 2;
    currencySize = Math.round(amountSize * 0.38);
  }

  ctx.font = `900 ${amountSize}px Arial`;
  const amountWidth = ctx.measureText(amount).width;

  ctx.font = `900 ${currencySize}px Arial`;
  const currencyWidth = ctx.measureText(currency).width;

  const totalWidth = amountWidth + 18 + currencyWidth;
  let startX = centerX - totalWidth / 2;

  ctx.textAlign = "left";
  ctx.font = `900 ${amountSize}px Arial`;
  ctx.fillText(amount, startX, centerY + 4);

  startX += amountWidth + 18;
  ctx.font = `900 ${currencySize}px Arial`;
  ctx.fillText(currency, startX, centerY + 10);
}

function fitTextCenter(text, centerX, centerY, maxWidth, startSize, minSize, weight) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${weight} ${size}px Arial`;
  ctx.fillText(text, centerX, centerY);
}

function wrapTextAdaptive(text, maxWidth, startSize, minSize, maxLines, weight) {
  let fontSize = startSize;

  while (fontSize >= minSize) {
    ctx.font = `${weight} ${fontSize}px Arial`;
    const lines = wrapText(text, maxWidth);
    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
    fontSize -= 2;
  }

  ctx.font = `${weight} ${minSize}px Arial`;
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