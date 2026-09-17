const loader = document.getElementById("loader");
const bar = document.getElementById("loader-bar");
const progress = document.getElementById("loader-progress");

const game = document.querySelector("[data-game]");
const spinBtn = document.getElementById("spin-btn");
const reels = document.querySelectorAll(".reel");

const slotMachine = document.getElementById("slotmachine");
const epicBanner = document.querySelector("[data-epic-win]");
const coinBurst = document.querySelector(".coin-burst");
const coinRain = document.querySelector(".coin-rain");

const overlay = document.querySelector("[data-overlay]");
const finalPopup = document.querySelector("[data-final-popup]");

const prebuiltSymbols = {};

const spinQueue = [
  [
    ["5.webp", "6.webp", "9.webp"],
    ["9.webp", "5.webp", "2.webp"],
    ["7.webp", "6.webp", "3.webp"],
    ["6.webp", "2.webp", "3.webp"],
  ],
  [
    ["4.webp", "6.webp", "3.webp"],
    ["5.webp", "6.webp", "2.webp"],
    ["3.webp", "7.webp", "5.webp"],
    ["1.webp", "6.webp", "3.webp"],
  ],
  [
    ["4.webp", "1.webp", "7.webp"],
    ["3.webp", "6.webp", "5.webp"],
    ["4.webp", "9.webp", "9.webp"],
    ["7.webp", "9.webp", "8.webp"],
  ],
  [
    ["6.webp", "7.webp", "11.webp"],
    ["9.webp", "11.webp", "5.webp"],
    ["8.webp", "11.webp", "1.webp"],
    ["11.webp", "7.webp", "9.webp"],
  ],
];

const symbol = [...new Set(spinQueue.flat(2))];
const luckySymbol = "11.webp";
const coinImages = Array.from(
  { length: 4 },
  (_, index) => `./assets/coin-${index + 1}.webp`,
);

const wait = (delay) =>
  new Promise((resolve) => window.setTimeout(resolve, delay));

function waitForFiniteAnimations(elements) {
  return Promise.allSettled(
    elements.flatMap((element) =>
      element
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    ),
  );
}

function getBackgroundImageUrl(elem) {
  if (!elem) return null;
  const style = getComputedStyle(elem);
  const match = style.backgroundImage.match(/url\(['"]?(.+?)['"]?\)/);
  return match ? match[1] : null;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });
}

async function preloadLoaderResources() {
  const loaderResources = [
    "./assets/load-bg.webp",
    "./assets/load-panel.webp",
    "./assets/load-progress.webp",
    "./assets/logo.webp",
    "./assets/char.webp",
    "./assets/bg.webp",
    "./assets/slotmachine.webp",

    ...Array.from(document.images)
      .map((img) => img.src)
      .filter(
        (src) =>
          src.includes("load") ||
          src.includes("char") ||
          src.includes("logo") ||
          src.includes("bg") ||
          src.includes("slotmachine"),
      ),
  ];

  const promises = loaderResources.map(loadImage);
  await Promise.all(promises);
}

let indicatorPercent = 0;

function moveIndicatorSmooth(targetPercent) {
  const step = () => {
    if (indicatorPercent < targetPercent) {
      indicatorPercent += Math.min(1, targetPercent - indicatorPercent);
      updateIndicator(indicatorPercent);
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

function updateIndicator(percent) {
  progress.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
}

async function preloadAllFonts() {
  const fonts = new Set();

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) {
          const family = rule.style
            .getPropertyValue("font-family")
            .replace(/["']/g, "");
          const weight = rule.style.getPropertyValue("font-weight") || "400";

          fonts.add(`${weight} 1em ${family}`);
        }
      }
    } catch (e) {}
  }

  await Promise.all(Array.from(fonts).map((font) => document.fonts.load(font)));
}

async function preloadGameResources() {
  const allElems = document.querySelectorAll("*");
  const cssBackgrounds = Array.from(allElems)
    .map(getBackgroundImageUrl)
    .filter(Boolean);

  const imgElems = Array.from(document.images).map((img) => img.src);
  const symbolResources = symbol.map((s) => `./assets/symbols/${s}`);
  const allResources = [
    ...cssBackgrounds,
    ...imgElems,
    ...symbolResources,
    ...coinImages,
  ];

  let loadedCount = 0;
  const totalCount = allResources.length;

  const loadingPromises = allResources.map((src) =>
    loadImage(src).then(() => {
      loadedCount++;
      moveIndicatorSmooth(Math.round((loadedCount / totalCount) * 100));
    }),
  );

  const fontPromise = preloadAllFonts();

  await Promise.all([...loadingPromises, fontPromise]);

  symbol.concat(luckySymbol).forEach((sym) => {
    prebuiltSymbols[sym] = createBox(sym);
  });
}

let spinsLeft = 3;
let spinning = false;
let coinRainTimer = null;

spinBtn.addEventListener("click", spin);

async function spin() {
  spinBtn.classList.add("disabled");

  if (spinning || spinsLeft === 0) return;
  spinning = true;
  spinsLeft--;

  const isLastSpin = spinsLeft === 0;
  const spinPromises = [];
  const spinIndex = 3 - (spinsLeft + 1);
  const currentSpinResults = spinQueue[spinIndex + 1];
  const delayBetweenReels = 100;

  for (let i = 0; i < reels.length; i++) {
    const reel = reels[i];
    const boxes = reel.querySelector(".boxes");

    const box = boxes.children[0];
    const styles = getComputedStyle(box);
    const boxHeight =
      box.getBoundingClientRect().height +
      parseFloat(styles.marginBlockStart || 0) +
      parseFloat(styles.marginBlockEnd || 0);

    const final4 = currentSpinResults[i];

    const prefill = getRandomSymbols(15, isLastSpin ? [luckySymbol] : []);
    const spinSequence = final4.concat(prefill);
    boxes.style.transition = "none";

    for (let j = spinSequence.length - 1; j >= 0; j--) {
      const sym = spinSequence[j];
      const box = createBox(sym);
      box.dataset.symbol = sym;
      boxes.insertBefore(box, boxes.firstChild);
    }

    boxes.offsetHeight;

    const newHeight = spinSequence.length * boxHeight;
    boxes.style.transform = `translateY(-${newHeight}px)`;

    const promise = new Promise((resolve) => {
      setTimeout(() => {
        boxes.style.transition = "transform 0.3s ease-out";
        boxes.style.transform = `translateY(-${newHeight + 16}px)`;

        boxes.addEventListener(
          "transitionend",
          () => {
            boxes.style.transition =
              "transform 1s cubic-bezier(0.7, 0.7, 0.2, 1.07)";
            boxes.style.transform = "translateY(0)";

            boxes.addEventListener(
              "transitionend",
              () => {
                const visible = Array.from(boxes.children)
                  .slice(0, 3)
                  .map((n) => n.cloneNode(true));

                boxes.style.transition = "none";
                boxes.style.transform = "translateY(0)";
                boxes.innerHTML = "";

                visible.forEach((n) => {
                  boxes.appendChild(n);
                  if (n.dataset.symbol === luckySymbol) {
                    n.querySelector("img").style.removeProperty("animation");
                    n.classList.add("lucky-bounce");
                  }
                });

                resolve();
              },
              { once: true },
            );
          },
          { once: true },
        );
      }, delayBetweenReels * i);
    });

    spinPromises.push(promise);
  }

  await Promise.all(spinPromises);

  spinning = false;

  if (!isLastSpin) {
    spinBtn.classList.remove("disabled");
  }

  if (isLastSpin) {
    const luckyBoxes = Array.from(reels).flatMap((reel) =>
      Array.from(reel.querySelectorAll(".lucky-bounce")),
    );
    await waitForFiniteAnimations(luckyBoxes);

    animWinLines();
    await waitForFiniteAnimations([
      document.getElementById("lines"),
      document.getElementById("main-line"),
    ]);

    await highlightLuckySymbols();
  }
}

function animWinLines() {
  const lines = document.getElementById("lines");
  const mainLine = document.getElementById("main-line");

  lines.classList.add("show");
  mainLine.classList.add("show");
}

function initStart() {
  const initialSymbols = spinQueue[0];

  reels.forEach((reel, index) => {
    const boxes = reel.querySelector(".boxes");
    boxes.innerHTML = "";

    initialSymbols[index].forEach((sym) => {
      const box = createBox(sym);
      box.dataset.symbol = sym;
      boxes.appendChild(box);
    });

    boxes.style.transition = "none";
    boxes.style.transform = "translateY(0)";
  });
}

function createBox(sym) {
  if (prebuiltSymbols[sym]) {
    return prebuiltSymbols[sym].cloneNode(true);
  }

  const box = document.createElement("div");
  box.className = "box";
  const img = document.createElement("img");
  img.src = `./assets/symbols/${sym}`;
  img.alt = sym;
  img.draggable = false;
  box.appendChild(img);
  box.dataset.symbol = sym;
  return box;
}

function getRandomSymbol(exclude = []) {
  const excl = Array.isArray(exclude) ? exclude : [exclude];
  const filtered = symbol.filter((s) => !excl.includes(s));
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function getRandomSymbols(count, exclude = []) {
  const excl = Array.isArray(exclude) ? exclude : [exclude];
  const res = [];
  for (let i = 0; i < count; i++) {
    res.push(getRandomSymbol(excl));
  }
  return res;
}

async function highlightLuckySymbols() {
  slotMachine.classList.add("shake");
  await waitForFiniteAnimations([slotMachine]);

  document.getElementById("main-line").classList.add("win-pulse");

  reels.forEach((reel) => {
    const boxes = reel.querySelectorAll(".box");
    boxes.forEach((box) => {
      if (box.dataset.symbol === luckySymbol) {
        box.classList.remove("lucky-bounce");
        box.classList.add("lucky-container");
      } else {
        box.classList.remove("lucky-container");
      }
    });
  });

  epicBanner.setAttribute("data-open", "true");
  playCoinBurst();
  playCoinRain();

  await wait(1300);
  // showFinalPopup();
}

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getRootRem = () =>
  parseFloat(getComputedStyle(document.documentElement).fontSize);

function coinTransform(x, y, scale, rotation) {
  return `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale}) rotate(${rotation}deg)`;
}

function createCoin(container, index, size, x, y, zIndex, className = "") {
  const coin = document.createElement("div");
  const image = new Image();

  coin.className = `win-coin${className ? ` ${className}` : ""}`;
  coin.style.setProperty("--coin-size", `${size}rem`);
  coin.style.left = `${x}px`;
  coin.style.top = `${y}px`;
  coin.style.zIndex = String(zIndex + Math.round(size * 10));

  image.src = coinImages[index % coinImages.length];
  image.alt = "";
  coin.appendChild(image);
  container.appendChild(coin);

  return coin;
}

function playCoinBurst() {
  coinBurst.replaceChildren();
  const origin = getBurstOrigin();

  for (let index = 0; index < 100; index++) {
    const delay = Math.floor(index / 3) * 300 + (index % 3) * 24;
    window.setTimeout(() => createBurstCoin(index, origin), delay);
  }
}

function getBurstOrigin() {
  const width = coinBurst.clientWidth;
  const height = coinBurst.clientHeight;
  const sourceWidth = width * (7.5 / 24);

  return {
    width,
    height,
    sourceWidth,
    sourceLeft: (width - sourceWidth) / 2,
    y: height * 0.89,
    rem: getRootRem(),
  };
}

function playCoinRain() {
  let index = 0;

  window.clearInterval(coinRainTimer);
  coinRain.replaceChildren();

  const spawnCoin = () => createRainCoin(index++);
  spawnCoin();
  coinRainTimer = window.setInterval(spawnCoin, 260);
}

function createRainCoin(index) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const rem = getRootRem();
  const size = randomBetween(0.8, 1.25) * 2.5;
  const edgeInset = rem * 1.4;
  const screenMinX = edgeInset;
  const screenMaxX = width - edgeInset;
  const startX = randomBetween(screenMinX, screenMaxX);
  const startY = -rem * randomBetween(2.5, 4.5);
  const targetX = clamp(
    startX + randomBetween(-0.11, 0.11) * width,
    screenMinX,
    screenMaxX,
  );
  const targetY = height + rem * randomBetween(1, 2.2);
  const driftX = targetX - startX;
  const fallY = targetY - startY;
  const turns = randomBetween(-90, 90);
  const duration = randomBetween(6200, 8000);
  const coin = createCoin(
    coinRain,
    index,
    size,
    startX,
    startY,
    320,
    "rain-coin",
  );

  const animation = coin.animate(
    [
      {
        opacity: 0,
        transform: coinTransform(0, 0, 0.65, 0),
      },
      {
        offset: 0.08,
        opacity: 1,
        transform: coinTransform(driftX * 0.06, fallY * 0.08, 1, turns * 0.08),
      },
      {
        offset: 0.74,
        opacity: 1,
        transform: coinTransform(
          driftX * 0.74,
          fallY * 0.74,
          0.9,
          turns * 0.74,
        ),
      },
      {
        opacity: 0,
        transform: coinTransform(driftX, fallY + rem * 0.6, 0.62, turns),
      },
    ],
    {
      duration,
      easing: "cubic-bezier(.22,.55,.38,1)",
      fill: "forwards",
    },
  );

  animation.onfinish = () => coin.remove();
}

function createBurstCoin(index, origin) {
  const size = randomBetween(1.05, 1.9) * 2.3;
  const sourceX = randomBetween(
    origin.sourceLeft,
    origin.sourceLeft + origin.sourceWidth,
  );
  const edgeInset = origin.rem * 1.45;
  const targetX = clamp(
    sourceX + randomBetween(-0.325, 0.325) * origin.width,
    edgeInset,
    origin.width - edgeInset,
  );
  const targetY = origin.height - origin.rem * randomBetween(1.2, 2.35);
  const fallX = targetX - sourceX;
  const fallY = targetY - origin.y;
  const launchX = fallX * randomBetween(0.08, 0.2);
  const launchY = -origin.rem * randomBetween(0.9, 2.65);
  const bounceY = fallY - origin.rem * randomBetween(0.45, 0.9);
  const turns = randomBetween(-150, 150);
  const duration = randomBetween(650, 870);
  const coin = createCoin(coinBurst, index, size, sourceX, origin.y, 350);

  coin.animate(
    [
      {
        opacity: 0,
        transform: coinTransform(0, 0, 0.35, 0),
      },
      {
        offset: 0.12,
        opacity: 1,
        transform: coinTransform(
          launchX * 0.2,
          launchY * 0.28,
          1,
          turns * 0.12,
        ),
      },
      {
        offset: 0.48,
        opacity: 1,
        transform: coinTransform(launchX, launchY, 1, turns * 0.48),
      },
      {
        offset: 0.78,
        opacity: 1,
        transform: coinTransform(fallX, fallY, 0.8, turns),
      },
      {
        offset: 0.9,
        opacity: 1,
        transform: coinTransform(fallX * 1.01, bounceY, 0.74, turns + 35),
      },
      {
        opacity: 1,
        transform: coinTransform(
          fallX * 1.02,
          fallY + origin.rem * 0.18,
          0.7,
          turns + 55,
        ),
      },
    ],
    {
      duration,
      easing: "cubic-bezier(.18,.78,.28,1)",
      fill: "forwards",
    },
  );
}

function showFinalPopup() {
  finalPopup.setAttribute("data-open", "true");
  overlay.setAttribute("data-visible", "true");

  let timeLeft = 15 * 60;
  const countdownEl = document.getElementById("countdown");

  const timerId = setInterval(() => {
    timeLeft--;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const display = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    countdownEl.textContent = display;
    countdownEl.setAttribute("data-text", display);

    if (timeLeft <= 0) {
      clearInterval(timerId);
      document.getElementById("text-timer").style.display = "none";
      document.getElementById("text-timer-end").style.display = "flex";
    }
  }, 1000);
}

document.addEventListener("DOMContentLoaded", async function () {
  await preloadLoaderResources();
  await preloadGameResources();

  initStart();

  setTimeout(() => {
    game.setAttribute("data-open", "true");

    loader.style.display = "none";
  }, 50);
});
