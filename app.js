(() => {
  const data = window.PROMPT_FILM_DATA;

  if (!data) {
    return;
  }

  const state = {
    activeCategoryIndex: 0,
    activePairIndex: 0,
    activeInteractionIndex: 0,
    autoPlay: false,
    autoPlayRaf: 0,
    autoPlayLastTime: 0,
    raf: 0,
  };

  const scenes = [...document.querySelectorAll(".scene")];
  const hudHint = document.getElementById("hud-hint");
  const hudTime = document.getElementById("hud-time");
  const hudTitle = document.getElementById("hud-title");
  const hudFill = document.getElementById("hud-fill");
  const typedText = document.getElementById("typed-text");
  const quickLink = document.getElementById("quick-link");

  const categoryChips = document.getElementById("category-chips");
  const browserMiniGrid = document.getElementById("browser-mini-grid");
  const categoryTitle = document.getElementById("category-title");
  const categoryCaption = document.getElementById("category-caption");
  const categoryImage = document.getElementById("category-image");

  const pairSteps = document.getElementById("pair-steps");
  const pairAuthor = document.getElementById("pair-author");
  const pairTitle = document.getElementById("pair-title");
  const pairPrompt = document.getElementById("pair-prompt");
  const pairImage = document.getElementById("pair-image");
  const pairCategory = document.getElementById("pair-category");
  const pairCounter = document.getElementById("pair-counter");

  const copyButton = document.getElementById("copy-button");
  const styleTags = document.getElementById("style-tags");
  const interactionLabel = document.getElementById("interaction-label");
  const interactionTitle = document.getElementById("interaction-title");
  const interactionText = document.getElementById("interaction-text");
  const interactionImage = document.getElementById("interaction-image");
  const interactionStrip = document.getElementById("interaction-strip");

  const meteorField = document.getElementById("meteor-field");

  const brandName = document.getElementById("brand-name");
  const brandDomain = document.getElementById("brand-domain");
  const brandTagline = document.getElementById("brand-tagline");
  const finalImage = document.getElementById("final-image");
  const galleryLinks = [...document.querySelectorAll("[data-gallery-link]")];

  const sceneIndexByName = Object.fromEntries(
    scenes.map((scene, index) => [scene.dataset.scene, index]),
  );
  const AUTO_PLAY_DURATION = 30000;
  const METEOR_TRIGGER = 0.38;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function formatPrompt(prompt) {
    const segments = prompt
      .split(/,\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

    return segments.map((item, index) => `${String(index + 1).padStart(2, "0")}  ${item}`).join("\n");
  }

  function buildCategories() {
    data.categories.forEach((item) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.textContent = item.name;
      chip.addEventListener("click", () => setCategory(indexOfCategory(item.name)));
      categoryChips.appendChild(chip);

      const tile = document.createElement("div");
      tile.className = "mini-tile";

      const image = document.createElement("img");
      image.loading = "lazy";
      image.alt = item.name;
      image.src = item.image;
      tile.appendChild(image);
      browserMiniGrid.appendChild(tile);
    });
  }

  function buildPairs() {
    data.promptPairs.forEach((item, index) => {
      const beat = document.createElement("div");
      beat.className = "beat-item";
      beat.innerHTML = `<strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.category)}`;
      beat.addEventListener("click", () => setPromptPair(index));
      pairSteps.appendChild(beat);
    });
  }

  function buildInteraction() {
    data.interactionModes.forEach((item, index) => {
      const tag = document.createElement("button");
      tag.className = "style-tag";
      tag.type = "button";
      tag.textContent = item.label;
      tag.addEventListener("click", () => setInteractionMode(index));
      styleTags.appendChild(tag);

      const stripCard = document.createElement("div");
      stripCard.className = "strip-card";
      stripCard.dataset.label = item.label;

      const image = document.createElement("img");
      image.loading = "lazy";
      image.alt = item.title;
      image.src = item.image;
      stripCard.appendChild(image);
      interactionStrip.appendChild(stripCard);
    });
  }

  function buildMeteorGallery() {
    data.meteorGallery.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "meteor-card";
      const lane = index % 4;
      const row = Math.floor(index / 4);
      const startX = -36 - row * 18 - lane * 2;
      const endX = 108 + row * 12 + lane * 3;
      const startY = 10 + lane * 18 + (row % 2) * 4;
      const yOffsets = [-5, 4, -3, 6];
      const endY = clamp(startY + yOffsets[lane] + row * 2, 8, 82);
      const startRotate = -24 + lane * 5;
      const endRotate = 14 + (row % 3) * 8;
      const delay = row * 0.16 + lane * 0.02;

      card.dataset.startX = String(startX);
      card.dataset.endX = String(endX);
      card.dataset.startY = String(startY);
      card.dataset.endY = String(endY);
      card.dataset.startRotate = String(startRotate);
      card.dataset.endRotate = String(endRotate);
      card.dataset.delay = String(delay);

      const image = document.createElement("img");
      image.loading = "lazy";
      image.alt = item.title;
      image.src = item.image;
      card.appendChild(image);
      meteorField.appendChild(card);
    });
  }

  function buildBrand() {
    brandName.textContent = data.brand.name;
    brandDomain.textContent = data.brand.domain;
    brandTagline.textContent = data.brand.tagline;
    finalImage.src = data.finalFrame.image;

    galleryLinks.forEach((link) => {
      link.href = data.relatedPage.href;
    });

    if (quickLink) {
      quickLink.textContent = data.relatedPage.quickLabel;
    }
  }

  function indexOfCategory(name) {
    return data.categories.findIndex((item) => item.name === name);
  }

  function setCategory(index) {
    state.activeCategoryIndex = clamp(index, 0, data.categories.length - 1);
    const active = data.categories[state.activeCategoryIndex];
    categoryTitle.textContent = active.name;
    categoryCaption.textContent = active.note;
    categoryImage.src = active.image;

    [...categoryChips.children].forEach((chip, chipIndex) => {
      chip.classList.toggle("active", chipIndex === state.activeCategoryIndex);
    });
  }

  function setPromptPair(index) {
    state.activePairIndex = clamp(index, 0, data.promptPairs.length - 1);
    const active = data.promptPairs[state.activePairIndex];
    pairAuthor.textContent = active.author;
    pairTitle.textContent = active.title;
    pairPrompt.textContent = formatPrompt(active.prompt);
    pairImage.src = active.image;
    pairCategory.textContent = active.category;
    pairCounter.textContent = `${String(state.activePairIndex + 1).padStart(2, "0")} / ${String(data.promptPairs.length).padStart(2, "0")}`;

    [...pairSteps.children].forEach((beat, beatIndex) => {
      beat.classList.toggle("active", beatIndex === state.activePairIndex);
    });
  }

  function setInteractionMode(index) {
    state.activeInteractionIndex = clamp(index, 0, data.interactionModes.length - 1);
    const active = data.interactionModes[state.activeInteractionIndex];
    interactionLabel.textContent = active.label;
    interactionTitle.textContent = active.title;
    interactionText.textContent = active.text;
    interactionImage.src = active.image;

    [...styleTags.children].forEach((tag, tagIndex) => {
      tag.classList.toggle("active", tagIndex === state.activeInteractionIndex);
    });
  }

  function updateIntro(progress) {
    const normalized = clamp(progress / 0.72, 0, 1);
    const length = Math.floor(data.introPrompt.length * normalized);
    typedText.textContent = data.introPrompt.slice(0, length);
  }

  function updateMeteor(progress) {
    const cards = [...meteorField.children];
    const activeProgress = clamp((progress - METEOR_TRIGGER) / (1 - METEOR_TRIGGER), 0, 1);

    cards.forEach((card, index) => {
      const depth = 0.75 + (index % 5) * 0.06;
      const delay = Number(card.dataset.delay || 0);
      const motion = clamp((activeProgress - delay) / (1 - delay), 0, 1);
      const startX = Number(card.dataset.startX || -40);
      const endX = Number(card.dataset.endX || 116);
      const startY = Number(card.dataset.startY || 12);
      const endY = Number(card.dataset.endY || 72);
      const startRotate = Number(card.dataset.startRotate || -18);
      const endRotate = Number(card.dataset.endRotate || 18);
      const x = startX + (endX - startX) * motion;
      const y = startY + (endY - startY) * motion;
      const rotate = startRotate + (endRotate - startRotate) * motion;
      const fadeIn = clamp(motion * 4.2, 0, 1);
      const fadeOut = clamp((1.04 - motion) * 1.45, 0, 1);
      const opacity = fadeIn * fadeOut;
      const scale = depth + motion * 0.2;

      card.style.transform = `translate3d(${x}vw, ${y}vh, 0) rotate(${rotate}deg) scale(${scale})`;
      card.style.opacity = opacity.toFixed(3);
    });
  }

  function updateInteractionButton(progress) {
    const copied = progress > 0.18 && progress < 0.42;
    copyButton.textContent = copied ? "Copied" : "Copy";
    copyButton.classList.toggle("active", copied);
  }

  function findSceneProgress(scene) {
    const rect = scene.getBoundingClientRect();
    const scrollSpan = Math.max(scene.offsetHeight - window.innerHeight, 1);
    const progress = clamp(-rect.top / scrollSpan, 0, 1);
    scene.style.setProperty("--progress", progress.toFixed(4));
    return progress;
  }

  function getActiveScene(progressList) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    scenes.forEach((scene, index) => {
      const rect = scene.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - window.innerHeight / 2);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return { scene: scenes[closestIndex], index: closestIndex, progress: progressList[closestIndex] };
  }

  function updateHud(activeScene) {
    hudTime.textContent = activeScene.scene.dataset.time;
    hudTitle.textContent = activeScene.scene.dataset.title;
    const fill = ((activeScene.index + activeScene.progress) / scenes.length) * 100;
    hudFill.style.width = `${fill.toFixed(2)}%`;
  }

  function updateScenes() {
    state.raf = 0;
    const progressList = scenes.map(findSceneProgress);
    const activeScene = getActiveScene(progressList);
    updateHud(activeScene);

    updateIntro(progressList[sceneIndexByName.intro] ?? 0);

    const categoryProgress = progressList[sceneIndexByName.categories] ?? 0;
    const categoryIndex = clamp(
      Math.floor(categoryProgress * data.categories.length),
      0,
      data.categories.length - 1,
    );
    setCategory(categoryIndex);

    const pairProgress = progressList[sceneIndexByName.prompt] ?? 0;
    const pairIndex = clamp(
      Math.floor(pairProgress * data.promptPairs.length),
      0,
      data.promptPairs.length - 1,
    );
    setPromptPair(pairIndex);

    const interactionProgress = progressList[sceneIndexByName.interaction] ?? 0;
    const interactionIndex = clamp(
      Math.floor(interactionProgress * data.interactionModes.length),
      0,
      data.interactionModes.length - 1,
    );
    setInteractionMode(interactionIndex);
    updateInteractionButton(interactionProgress);

    updateMeteor(progressList[sceneIndexByName.meteor] ?? 0);
  }

  function requestTick() {
    if (state.raf) {
      return;
    }

    state.raf = window.requestAnimationFrame(updateScenes);
  }

  function getScrollLimit() {
    return Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
  }

  function updateAutoPlayUi() {
    hudHint.textContent = state.autoPlay ? "Auto On" : "Enter Play";
    hudHint.classList.toggle("active", state.autoPlay);
  }

  function stopAutoPlay() {
    state.autoPlay = false;
    state.autoPlayLastTime = 0;
    updateAutoPlayUi();

    if (state.autoPlayRaf) {
      window.cancelAnimationFrame(state.autoPlayRaf);
      state.autoPlayRaf = 0;
    }
  }

  function autoPlayStep(timestamp) {
    if (!state.autoPlay) {
      state.autoPlayRaf = 0;
      return;
    }

    if (!state.autoPlayLastTime) {
      state.autoPlayLastTime = timestamp;
    }

    const delta = timestamp - state.autoPlayLastTime;
    state.autoPlayLastTime = timestamp;

    const scrollLimit = getScrollLimit();
    const speed = scrollLimit / AUTO_PLAY_DURATION;
    const nextY = Math.min(window.scrollY + delta * speed, scrollLimit);

    window.scrollTo({
      top: nextY,
      behavior: "auto",
    });
    requestTick();

    if (nextY >= scrollLimit - 1) {
      stopAutoPlay();
      return;
    }

    state.autoPlayRaf = window.requestAnimationFrame(autoPlayStep);
  }

  function startAutoPlay() {
    if (state.autoPlay) {
      return;
    }

    const scrollLimit = getScrollLimit();

    if (window.scrollY >= scrollLimit - 2) {
      window.scrollTo({
        top: 0,
        behavior: "auto",
      });
    }

    state.autoPlay = true;
    state.autoPlayLastTime = 0;
    updateAutoPlayUi();
    state.autoPlayRaf = window.requestAnimationFrame(autoPlayStep);
  }

  function toggleAutoPlay() {
    if (state.autoPlay) {
      stopAutoPlay();
      return;
    }

    startAutoPlay();
  }

  function handleKeydown(event) {
    if (
      event.target instanceof Element &&
      event.target.closest("button, a")
    ) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      toggleAutoPlay();
      return;
    }

    if (event.key === "Escape" && state.autoPlay) {
      event.preventDefault();
      stopAutoPlay();
    }
  }

  function handleManualInterruption() {
    if (state.autoPlay) {
      stopAutoPlay();
    }
  }

  function copyActivePrompt() {
    const item = data.promptPairs[state.activePairIndex];

    navigator.clipboard?.writeText(item.prompt).catch(() => {});
    copyButton.textContent = "Copied";
    copyButton.classList.add("active");

    window.setTimeout(() => {
      updateInteractionButton(0);
    }, 1000);
  }

  function init() {
    buildCategories();
    buildPairs();
    buildInteraction();
    buildMeteorGallery();
    buildBrand();

    setCategory(0);
    setPromptPair(0);
    setInteractionMode(0);
    updateIntro(0);
    updateMeteor(0);
    updateAutoPlayUi();

    copyButton.addEventListener("click", copyActivePrompt);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("wheel", handleManualInterruption, { passive: true });
    window.addEventListener("touchstart", handleManualInterruption, { passive: true });
    window.addEventListener("pointerdown", handleManualInterruption, { passive: true });
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick);
    requestTick();
  }

  init();
})();
